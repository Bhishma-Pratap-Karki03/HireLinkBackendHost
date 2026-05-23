const fs = require("fs"); // Used to read/write temporary JSON files
const path = require("path"); // Used to create safe file paths
const { execFile } = require("child_process"); // Used to execute Python ML script

// MongoDB models
const User = require("../models/userModel");
const JobPost = require("../models/jobPostModel");
const AppliedJob = require("../models/appliedJobModel");

/* 
   Utility Function: Extract numeric minimum experience
   Converts job experience text like "2-3 years" into number 2
*/
const parseMinExperience = (experienceText) => {
  if (!experienceText) return 0;
  const match = String(experienceText).match(/(\d+)/);
  if (!match) return 0;
  return Number(match[1]) || 0;
};

/* 
   Utility Function: Convert candidate skills array
   into comma-separated string for ML input
*/
const getCandidateSkillsCsv = (user) => {
  const skills = (user.skills || [])
    .map((item) => item?.skillName)
    .filter(Boolean)
    .join(", ");
  return skills;
};

/* 
   Utility Function: Calculate total experience in years
   Converts experience date range into numeric years
*/
const estimateExperienceYears = (user) => {
  const items = user.experience || [];
  if (!items.length) return 0;

  const now = new Date();
  let totalMonths = 0;

  for (const item of items) {
    if (!item.startDate) continue;

    const start = new Date(item.startDate);
    const end = item.isCurrent || !item.endDate ? now : new Date(item.endDate);

    const months = Math.max(0, (end - start) / (1000 * 60 * 60 * 24 * 30));

    totalMonths += months;
  }

  // Convert months to years (rounded to 1 decimal)
  return Math.round((totalMonths / 12) * 10) / 10;
};

/*
   Utility Function: Build candidate recommendation signals
   Measures whether the candidate profile has enough data
   to generate relevant recommendations.
*/
const getCandidateRecommendationSignals = (user) => {
  const skillsCsv = getCandidateSkillsCsv(user);
  const experienceYears = estimateExperienceYears(user);
  const location = String(user.address || "").trim();

  const hasSkills = Boolean(skillsCsv.trim());
  const hasExperience = experienceYears > 0;
  const hasLocation = Boolean(location);

  return {
    skillsCsv,
    experienceYears,
    location,
    hasSkills,
    hasExperience,
    hasLocation,
    completenessScore: [hasSkills, hasExperience, hasLocation].filter(Boolean)
      .length,
  };
};

/* 
   Function: Run Python ML Inference
   Executes recommend_infer.py and returns predictions
*/
const runPythonInference = (inputPath, topk = 10) =>
  new Promise((resolve, reject) => {
    // Define ML folder and required artifact paths
    const mlDir = path.join(__dirname, "..", "ml");
    const scriptPath = path.join(mlDir, "recommend_infer.py");
    const modelPath = path.join(mlDir, "artifacts", "recommender_model.pkl");
    const featurePath = path.join(mlDir, "artifacts", "feature_columns.json");

    // Ensure ML script and model files exist
    if (!fs.existsSync(scriptPath)) {
      return reject(new Error("recommend_infer.py not found"));
    }

    if (!fs.existsSync(modelPath) || !fs.existsSync(featurePath)) {
      return reject(
        new Error(
          "ML model artifacts missing. Run: python backend/ml/train_recommender.py",
        ),
      );
    }

    // Execute Python script with arguments
    execFile(
      "python",
      [
        scriptPath,
        "--model",
        modelPath,
        "--features",
        featurePath,
        "--input",
        inputPath,
        "--topk",
        String(topk),
      ],
      { maxBuffer: 1024 * 1024 * 10 },
      (error, stdout, stderr) => {
        // Handle execution errors
        if (error) {
          return reject(new Error(stderr || error.message));
        }

        try {
          // Parse Python JSON output
          const parsed = JSON.parse(stdout || "{}");
          resolve(parsed.recommendations || []);
        } catch (parseError) {
          reject(new Error("Failed to parse Python inference output"));
        }
      },
    );
  });

/* 
   MAIN FUNCTION
   Generates AI recommendations for a candidate
*/
const getRecommendationsForCandidate = async (candidateId, topk = 10) => {
  // Fetch candidate data
  const user = await User.findById(candidateId).lean();
  if (!user) {
    throw new Error("Candidate not found");
  }

  const candidateSignals = getCandidateRecommendationSignals(user);

  // If the candidate profile has no usable recommendation signals yet,
  // return no results rather than noisy matches.
  if (candidateSignals.completenessScore === 0) {
    return [];
  }

  // Fetch jobs already applied by candidate
  const appliedJobs = await AppliedJob.find({ candidate: candidateId })
    .select("job")
    .lean();

  const appliedSet = new Set(appliedJobs.map((item) => String(item.job)));

  // Fetch all jobs and remove inactive + already applied jobs
  const jobs = await JobPost.find({})
    .populate("recruiterId", "profilePicture fullName")
    .lean();

  const activeJobs = jobs.filter(
    (job) =>
      !appliedSet.has(String(job._id)) &&
      String(job.status || "").toLowerCase() !== "inactive",
  );

  /*
     Prepare ML Input Payload (Candidate + Jobs)
  */
  const payload = {
    candidate: {
      skills_csv: candidateSignals.skillsCsv,
      experience_years: candidateSignals.experienceYears,
      location: candidateSignals.location,
    },
    jobs: activeJobs.map((job) => ({
      jobId: String(job._id),
      jobTitle: job.jobTitle || "",
      companyName: job.companyName || job.recruiterId?.fullName || "",
      companyLogo: job.companyLogo || job.recruiterId?.profilePicture || "",
      required_skills_csv: (job.requiredSkills || []).join(", "),
      min_experience_years: parseMinExperience(job.experience),
      location: job.location || "",
      jobType: job.jobType || "",
      workMode: job.workMode || "",
    })),
  };

  /* 
     Write Temporary JSON Input File for Python
  */
  const artifactsDir = path.join(__dirname, "..", "ml", "artifacts");

  if (!fs.existsSync(artifactsDir)) {
    fs.mkdirSync(artifactsDir, { recursive: true });
  }

  const inputPath = path.join(
    artifactsDir,
    `inference_input_${Date.now()}_${Math.random().toString(16).slice(2)}.json`,
  );

  fs.writeFileSync(inputPath, JSON.stringify(payload), "utf8");

  try {
    // Run ML inference
    const recommendations = await runPythonInference(inputPath, topk);

    const minSkillMatchPercent =
      candidateSignals.completenessScore >= 3
        ? 30
        : candidateSignals.completenessScore === 2
          ? 45
          : 60;

    // Tighten filtering when candidate profiles are incomplete so weak inputs
    // do not produce irrelevant recommendations.
    return recommendations.filter((item) => {
      const skillMatchPercent = Number(item?.skillMatchPercent || 0);
      const matchedSkillsCount = Array.isArray(item?.matchedSkills)
        ? item.matchedSkills.length
        : 0;

      if (skillMatchPercent < minSkillMatchPercent) {
        return false;
      }

      if (candidateSignals.completenessScore <= 1 && matchedSkillsCount === 0) {
        return false;
      }

      return true;
    });
  } finally {
    // Always delete temporary input file
    if (fs.existsSync(inputPath)) {
      fs.unlinkSync(inputPath);
    }
  }
};

/* 
   Export Main Function
*/
module.exports = {
  getRecommendationsForCandidate,
};

