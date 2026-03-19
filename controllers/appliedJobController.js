const path = require("path"); // Node utility to build safe file paths (works on Windows/Linux)
const fs = require("fs"); // Node file system module to read/write/move/copy/delete resume files
// This controller handles candidate applications, recruiter review flow, and assessment details.

const AppliedJob = require("../models/appliedJobModel"); // Mongo model: stores a candidate's job application
const JobPost = require("../models/jobPostModel"); // Mongo model: stores job post details (title, recruiterId, assessmentId, etc.)
const User = require("../models/userModel"); // Mongo model: stores users and roles (candidate/recruiter/admin)
const AtsReport = require("../models/atsReportModel"); // Mongo model: stores ATS extracted info and scores for an application
const Notification = require("../models/notificationModel");
const { getIO } = require("../socket");

const AssessmentAttempt = require("../models/assessmentAttemptModel"); // Mongo model: candidate's assessment attempt (answers, score, submittedAt)
const AdminAssessment = require("../models/adminAssessmentModel"); // Mongo model: assessments created by admin
const RecruiterAssessment = require("../models/recruiterAssessmentModel"); // Mongo model: assessments created by recruiter

const {
  parseResumeText, // reads a resume file (pdf/docx/txt) and returns plain text
  extractEmails, // pulls emails from resume text
  extractPhones, // pulls phone numbers from resume text
  extractExperienceYears, // estimates years of experience from resume text
  extractSkills, // finds skills from resume text using dictionary + aliases
  canonicalizeSkill, // converts skill variants to one standard form
  normalize, // lowercases / normalizes text for matching
} = require("../utils/atsParser");

// Converts any string into a filename-safe slug
// Example: "Nissan Karki" -> "nissan-karki"
// Removes special chars and collapses multiple dashes into one
const sanitize = (value) =>
  String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9]/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase();

const toStatusLabel = (status) => {
  const labels = {
    submitted: "Submitted",
    reviewed: "Reviewed",
    shortlisted: "Shortlisted",
    interview: "Interview",
    rejected: "Rejected",
    hired: "Hired",
  };
  return labels[status] || "Updated";
};

// Candidate applies to a job
// Handles resume upload/copy, creates application, and does a quick ATS pre-extraction
exports.applyToJob = async (req, res) => {
  let tempFileCleaned = false; // tracks whether the uploaded temp file was moved successfully (so we don't delete wrongly)
  try {
    const userId = req.user.id; // logged-in user id (candidate)
    const { jobId, resumeUrl, message } = req.body; // jobId is required; resumeUrl is optional if using profile resume

    // Validate required input
    if (!jobId) {
      return res.status(400).json({
        success: false,
        message: "Job ID is required",
      });
    }

    // Fetch job and user in parallel for speed
    const [job, user] = await Promise.all([
      JobPost.findById(jobId),
      User.findById(userId),
    ]);

    // Job must exist
    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Job not found",
      });
    }

    // User must exist
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Directory where applied resumes are stored permanently
    const targetDir = path.join(
      __dirname,
      "..",
      "public",
      "uploads",
      "appliedresume",
    );

    // Create the directory if it does not exist
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    // Candidate name used in filename (safe slug)
    const candidateName = sanitize(user.fullName || user.email || "candidate");

    // Timestamp ensures uniqueness (prevents overwriting)
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

    // These values will be stored into the application document
    let finalResumeUrl = ""; // public URL path
    let finalFileName = ""; // original name
    let finalFileSize = 0; // size in bytes

    // Case 1: Resume is uploaded with the request (multer puts it in req.file)
    if (req.file) {
      const ext = path.extname(req.file.originalname) || ".pdf"; // keep original extension if possible
      const baseName =
        sanitize(path.basename(req.file.originalname, ext)) || "resume"; // base name without extension
      const finalName = `${candidateName}-${timestamp}-${baseName}${ext}`; // unique filename
      const targetPath = path.join(targetDir, finalName); // destination path

      // Confirm multer temp file exists
      if (!fs.existsSync(req.file.path)) {
        return res.status(500).json({
          success: false,
          message: "Uploaded file not found",
        });
      }

      // Move temp file -> permanent uploads folder
      fs.renameSync(req.file.path, targetPath);
      tempFileCleaned = true; // moved successfully

      // Store final public url and metadata
      finalResumeUrl = `/uploads/appliedresume/${finalName}`;
      finalFileName = req.file.originalname;
      finalFileSize = req.file.size;

      // Case 2: Resume is referenced from the user's profile (resumeUrl)
    } else if (resumeUrl) {
      const resumePath = path.join(__dirname, "..", "public", resumeUrl); // actual file path
      if (!fs.existsSync(resumePath)) {
        return res.status(400).json({
          success: false,
          message: "Profile resume not found. Please upload a resume.",
        });
      }

      const ext = path.extname(resumePath) || ".pdf";
      const baseName = sanitize(path.basename(resumePath, ext)) || "resume";
      const finalName = `${candidateName}-${timestamp}-${baseName}${ext}`;
      const targetPath = path.join(targetDir, finalName);

      // Copy the profile resume into appliedresume so each application has its own resume copy
      fs.copyFileSync(resumePath, targetPath);

      // Store final public url and metadata
      finalResumeUrl = `/uploads/appliedresume/${finalName}`;
      finalFileName = path.basename(resumePath);
      finalFileSize = fs.statSync(resumePath).size;

      // No file and no resumeUrl -> can't apply
    } else {
      return res.status(400).json({
        success: false,
        message: "Resume is required",
      });
    }

    // Create the job application document
    const application = await AppliedJob.create({
      candidate: userId, // who applied
      job: jobId, // which job
      jobTitle: job.jobTitle || "Untitled Role", // store job title at apply time
      companyName: job.companyName || job.department || "Company", // store company name at apply time
      resumeUrl: finalResumeUrl, // saved resume location
      resumeFileName: finalFileName, // original name / copied file name
      resumeFileSize: finalFileSize, // size
      message: message || "", // candidate message (optional)
    });

    // ATS pre-extract section
    // This runs in a nested try so application still succeeds even if ATS fails
    try {
      const resumePath = path.join(
        __dirname,
        "..",
        "public",
        finalResumeUrl || "",
      );

      // If resume file exists, parse and extract basic ATS data
      if (fs.existsSync(resumePath)) {
        const resumeText = normalize(await parseResumeText(resumePath)); // parse resume -> text -> normalize

        // Extract skills and canonicalize them
        const extractedSkills = extractSkills(resumeText).map((skill) =>
          canonicalizeSkill(skill),
        );

        const experienceYears = extractExperienceYears(resumeText); // estimate experience years
        const emails = extractEmails(resumeText); // extract emails
        const phones = extractPhones(resumeText); // extract phone numbers

        // Create AtsReport (initially just extracted info; scoring can be done later)
        const report = await AtsReport.create({
          job: jobId,
          application: application._id,
          candidate: userId,
          extracted: {
            skills: extractedSkills,
            emails,
            phones,
            experienceYears,
          },
          matchedSkills: [], // will be filled later by recruiter scan
          missingSkills: [], // will be filled later by recruiter scan
          experienceMatch: false, // default; recruiter scan calculates it
          skillsScore: 0, // default
          experienceScore: 0, // default
          score: 0, // default
        });

        // Link report to application so recruiter can access it later
        await AppliedJob.findByIdAndUpdate(application._id, {
          atsReport: report._id,
        });
      }
    } catch (atsError) {
      // ATS extraction failure should not break job application
      console.error("ATS pre-extract error:", atsError);
    }

    // Return success response
    return res.status(201).json({
      success: true,
      message: "Application submitted",
      application,
    });
  } catch (error) {
    // If multer uploaded a temp file but we did not move it, delete it
    if (req.file && req.file.path && !tempFileCleaned) {
      try {
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
      } catch (cleanupError) {
        console.error("Error cleaning up temp file:", cleanupError);
      }
    }

    // Log and return server error
    console.error("Apply job error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error applying to job",
      error: error.message,
    });
  }
};

// Checks if the current user already applied to a given job
exports.checkApplied = async (req, res) => {
  try {
    const userId = req.user.id; // logged-in candidate
    const { jobId } = req.params; // job id from URL

    // Find existing application (if any)
    const existing = await AppliedJob.findOne({
      candidate: userId,
      job: jobId,
    }).lean();

    // Return true/false and application info if it exists
    return res.status(200).json({
      success: true,
      applied: Boolean(existing),
      application: existing || null,
    });
  } catch (error) {
    console.error("Check applied error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error checking application",
      error: error.message,
    });
  }
};

// Recruiter gets all applications for a job (includes assessment summary if attached)
exports.getApplicationsByJob = async (req, res) => {
  try {
    const userId = req.user.id; // logged-in recruiter
    const { jobId } = req.params;

    // Must be recruiter
    const recruiter = await User.findById(userId).lean();
    if (!recruiter || recruiter.role !== "recruiter") {
      return res.status(403).json({
        success: false,
        message: "Only recruiters can access applications",
      });
    }

    // Job must exist
    const job = await JobPost.findById(jobId).lean();
    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Job not found",
      });
    }

    // Recruiter must own this job post
    if (job.recruiterId.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to view this job",
      });
    }

    // Load applications with candidate info
    const applications = await AppliedJob.find({ job: jobId })
      .populate({
        path: "candidate",
        select: "fullName email profilePicture currentJobTitle",
      })
      .sort({ createdAt: -1 })
      .lean();

    // Will store assessment metadata if job has an assessment attached
    let assessmentDetails = null;

    // Map(candidateId -> latest attempt) so we can attach assessment status per candidate
    let latestAttemptsByCandidate = new Map();

    // If assessment is attached to job, fetch assessment and candidate attempts
    if (job.assessmentId) {
      const assessmentSource = job.assessmentSource || "recruiter"; // who created assessment
      const AssessmentModel =
        assessmentSource === "admin" ? AdminAssessment : RecruiterAssessment;

      // Fetch assessment definition
      const assessment = await AssessmentModel.findById(
        job.assessmentId,
      ).lean();
      if (assessment) {
        // Store summary details used by UI
        assessmentDetails = {
          id: assessment._id,
          source: assessmentSource,
          type: assessment.type, // "quiz" | "writing" | "code" etc (depends on schema)
          title: assessment.title,
          quizTotal:
            assessment.type === "quiz" &&
            Array.isArray(assessment.quizQuestions)
              ? assessment.quizQuestions.length
              : null,
        };

        // Collect candidate IDs from applications list
        const candidateIds = applications
          .map((app) => app?.candidate?._id)
          .filter(Boolean);

        // Fetch latest submitted attempts for those candidates
        if (candidateIds.length > 0) {
          const attempts = await AssessmentAttempt.find({
            assessment: job.assessmentId,
            assessmentSource,
            candidate: { $in: candidateIds },
            status: "submitted",
          })
            .sort({ submittedAt: -1, createdAt: -1 }) // newest first
            .lean();

          // Reduce attempts into a map: one latest attempt per candidate
          latestAttemptsByCandidate = attempts.reduce((acc, attempt) => {
            const key = attempt.candidate?.toString();
            if (!key || acc.has(key)) return acc; // first one is latest because list is sorted
            acc.set(key, attempt);
            return acc;
          }, new Map());
        }
      }
    }

    // Format each application response with assessment status info
    const formatted = applications.map((app) => {
      const candidateId = app?.candidate?._id?.toString();
      const attempt = candidateId
        ? latestAttemptsByCandidate.get(candidateId)
        : null;

      const answers = attempt?.answers || {}; // contains writingResponse/writingLink/codeResponse/codeLink/quizAnswers

      return {
        id: app._id,
        candidate: app.candidate,
        atsScore: typeof app.atsScore === "number" ? app.atsScore : null,
        resumeUrl: app.resumeUrl,
        resumeFileName: app.resumeFileName,
        resumeFileSize: app.resumeFileSize,
        message: app.message || "",
        status: app.status,
        appliedAt: app.createdAt,
        assessment: {
          attached: Boolean(assessmentDetails), // assessment exists for job
          required: Boolean(job.assessmentRequired && assessmentDetails), // job marks it required
          source: assessmentDetails?.source || null,
          type: assessmentDetails?.type || null,
          title: assessmentDetails?.title || "",
          submitted: Boolean(attempt), // candidate submitted attempt
          submittedAt: attempt?.submittedAt || null,
          score:
            assessmentDetails?.type === "quiz" &&
            typeof attempt?.score === "number"
              ? attempt.score
              : null,
          quizTotal:
            assessmentDetails?.type === "quiz"
              ? assessmentDetails?.quizTotal
              : null,
          writingResponse: answers.writingResponse || "",
          writingLink: answers.writingLink || "",
          codeSubmission: assessmentDetails?.codeSubmission || "",
          codeResponse: answers.codeResponse || "",
          codeLink: answers.codeLink || "",
          codeFileUrl: answers.codeFileUrl || "",
          codeFileName: answers.codeFileName || "",
          codeFileMimeType: answers.codeFileMimeType || "",
          codeFileSize:
            typeof answers.codeFileSize === "number" ? answers.codeFileSize : 0,
        },
      };
    });

    // Return job metadata + application list
    return res.status(200).json({
      success: true,
      job: {
        id: job._id,
        jobTitle: job.jobTitle,
        location: job.location,
        jobType: job.jobType,
        deadline: job.deadline,
        assessmentRequired: Boolean(job.assessmentRequired && job.assessmentId),
        assessmentSource: job.assessmentSource || "recruiter",
      },
      applications: formatted,
    });
  } catch (error) {
    console.error("Get applications by job error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error fetching applications",
      error: error.message,
    });
  }
};

// Recruiter updates application status (submitted/reviewed/shortlisted/interview/rejected/hired)
exports.updateApplicationStatus = async (req, res) => {
  try {
    const userId = req.user.id; // recruiter id
    const { applicationId } = req.params;
    const { status } = req.body;

    // Allowed status list
    const allowedStatuses = [
      "submitted",
      "reviewed",
      "shortlisted",
      "interview",
      "rejected",
      "hired",
    ];

    // Reject invalid statuses
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status",
      });
    }

    // Must be recruiter
    const recruiter = await User.findById(userId).lean();
    if (!recruiter || recruiter.role !== "recruiter") {
      return res.status(403).json({
        success: false,
        message: "Only recruiters can update application status",
      });
    }

    // Load application and its job so we can validate ownership
    const application =
      await AppliedJob.findById(applicationId).populate("job");
    if (!application) {
      return res.status(404).json({
        success: false,
        message: "Application not found",
      });
    }

    // Recruiter can update only if they own the job
    if (application.job?.recruiterId?.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to update this application",
      });
    }

    const previousStatus = application.status;

    // Update status and save
    application.status = status;
    await application.save();

    if (previousStatus !== status) {
      const recruiterActor = await User.findById(userId)
        .select("fullName role profilePicture")
        .lean();
      const jobTitle = application.job?.jobTitle || application.jobTitle || "your application";
      const statusLabel = toStatusLabel(status);

      const notification = await Notification.create({
        user: application.candidate,
        actor: userId,
        type: "application_status_updated",
        application: application._id,
        message: `Your application for "${jobTitle}" was updated to ${statusLabel}.`,
      });

      const unreadCount = await Notification.countDocuments({
        user: application.candidate,
        type: {
          $in: [
            "connection_request_received",
            "connection_request_accepted",
            "application_status_updated",
            "project_review_received",
            "company_review_received",
          ],
        },
        isRead: false,
      });

      const io = getIO();
      io?.to(`user:${application.candidate.toString()}`).emit(
        "notification:connection:new",
        {
          notification: {
            id: notification._id.toString(),
            type: "application_status_updated",
            isRead: false,
            message: notification.message,
            createdAt: notification.createdAt,
            updatedAt: notification.updatedAt,
            targetPath: "/candidate/applied-status",
            actor: {
              id: recruiterActor?._id?.toString() || userId,
              fullName: recruiterActor?.fullName || "Recruiter",
              role: recruiterActor?.role || "recruiter",
              profilePicture: recruiterActor?.profilePicture || "",
            },
          },
          unreadCount,
        }
      );
    }

    // Return updated status
    return res.status(200).json({
      success: true,
      message: "Status updated",
      application: {
        id: application._id,
        status: application.status,
      },
    });
  } catch (error) {
    console.error("Update application status error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error updating application status",
      error: error.message,
    });
  }
};

// Candidate gets their own applications list
exports.getMyApplications = async (req, res) => {
  try {
    const userId = req.user.id; // candidate id

    // Find all applications made by this candidate
    const applications = await AppliedJob.find({ candidate: userId })
      .populate({
        path: "job",
        select: "jobTitle location jobType recruiterId",
      })
      .sort({ createdAt: -1 })
      .lean();

    // Extract recruiter IDs from populated jobs (unique)
    const recruiterIds = [
      ...new Set(
        applications
          .map((item) => item?.job?.recruiterId?.toString())
          .filter(Boolean),
      ),
    ];

    // Fetch recruiter info for displaying recruiter profile on candidate side
    const recruiters = await User.find(
      { _id: { $in: recruiterIds } },
      "fullName profilePicture",
    ).lean();

    // Build a quick lookup map for recruiter details
    const recruiterMap = new Map(
      recruiters.map((item) => [item._id.toString(), item]),
    );

    // Format response list
    const mapped = applications.map((item) => {
      const recruiterId = item?.job?.recruiterId?.toString() || "";
      const recruiter = recruiterMap.get(recruiterId);

      return {
        id: item._id,
        jobId: item.job?._id || item.job,
        jobTitle: item.jobTitle || item?.job?.jobTitle || "Untitled Role",
        companyName: item.companyName || recruiter?.fullName || "Company",
        location: item?.job?.location || "Location not specified",
        jobType: item?.job?.jobType || "Job type not specified",
        appliedAt: item.createdAt,
        updatedAt: item.updatedAt,
        status: item.status || "submitted",
        resumeUrl: item.resumeUrl || "",
        resumeFileName: item.resumeFileName || "",
        resumeFileSize: item.resumeFileSize || 0,
        recruiter: recruiterId
          ? {
              id: recruiterId,
              fullName: recruiter?.fullName || "Recruiter",
              profilePicture: recruiter?.profilePicture || "",
            }
          : null,
      };
    });

    // Return candidate's applications
    return res.status(200).json({
      success: true,
      applications: mapped,
    });
  } catch (error) {
    console.error("Get my applications error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error fetching your applications",
      error: error.message,
    });
  }
};

// Recruiter fetches detailed assessment info for one application (includes quiz review)
exports.getApplicationAssessmentById = async (req, res) => {
  try {
    const userId = req.user.id; // recruiter id
    const { applicationId } = req.params;

    // Must be recruiter
    const recruiter = await User.findById(userId).lean();
    if (!recruiter || recruiter.role !== "recruiter") {
      return res.status(403).json({
        success: false,
        message: "Only recruiters can view assessment details",
      });
    }

    // Load application + candidate + job
    const application = await AppliedJob.findById(applicationId)
      .populate({
        path: "candidate",
        select: "fullName email profilePicture currentJobTitle",
      })
      .populate({
        path: "job",
        select:
          "jobTitle location recruiterId assessmentId assessmentSource assessmentRequired",
      })
      .lean();

    // Must exist
    if (!application) {
      return res.status(404).json({
        success: false,
        message: "Application not found",
      });
    }

    // Recruiter must own job
    if (application.job?.recruiterId?.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to view this application",
      });
    }

    // If no assessment attached, return early
    if (!application.job?.assessmentId) {
      return res.status(200).json({
        success: true,
        assessment: {
          attached: false,
          required: false,
          submitted: false,
        },
        application: {
          id: application._id,
          candidate: application.candidate,
          job: application.job,
        },
      });
    }

    // Determine which assessment model to use (admin-created vs recruiter-created)
    const assessmentSource = application.job.assessmentSource || "recruiter";
    const AssessmentModel =
      assessmentSource === "admin" ? AdminAssessment : RecruiterAssessment;

    // Fetch assessment definition
    const assessment = await AssessmentModel.findById(
      application.job.assessmentId,
    ).lean();

    if (!assessment) {
      return res.status(404).json({
        success: false,
        message: "Assessment not found",
      });
    }

    // Fetch latest submitted attempt for this candidate
    const attempt = await AssessmentAttempt.findOne({
      assessment: application.job.assessmentId,
      assessmentSource,
      candidate: application.candidate?._id,
      status: "submitted",
    })
      .sort({ submittedAt: -1, createdAt: -1 })
      .lean();

    // Answers object contains quizAnswers/writingResponse/writingLink/codeResponse/codeLink
    const answers = attempt?.answers || {};

    // Quiz answers should be an array; if not, use empty array
    const quizAnswers = Array.isArray(answers.quizAnswers)
      ? answers.quizAnswers
      : [];

    // If assessment is quiz type, build review for each question
    const quizReview =
      assessment.type === "quiz" && Array.isArray(assessment.quizQuestions)
        ? assessment.quizQuestions.map((question, index) => {
            const selectedIndex =
              typeof quizAnswers[index] === "number"
                ? quizAnswers[index]
                : null;
            const correctIndex =
              typeof question.correctIndex === "number"
                ? question.correctIndex
                : null;

            const options = Array.isArray(question.options)
              ? question.options
              : [];

            return {
              question: question.question || "",
              options,
              selectedIndex,
              selectedOption:
                selectedIndex !== null && options[selectedIndex] !== undefined
                  ? options[selectedIndex]
                  : "",
              correctIndex,
              correctOption:
                correctIndex !== null && options[correctIndex] !== undefined
                  ? options[correctIndex]
                  : "",
              isCorrect:
                selectedIndex !== null &&
                correctIndex !== null &&
                selectedIndex === correctIndex,
            };
          })
        : [];

    // Return full assessment details + candidate attempt info
    return res.status(200).json({
      success: true,
      application: {
        id: application._id,
        candidate: application.candidate,
        job: application.job,
      },
      assessment: {
        attached: true,
        required: Boolean(application.job.assessmentRequired),
        source: assessmentSource,
        type: assessment.type,
        title: assessment.title,
        description: assessment.description || "",
        submitted: Boolean(attempt),
        submittedAt: attempt?.submittedAt || null,
        startTime: attempt?.startTime || null,
        endTime: attempt?.endTime || null,
        attemptCreatedAt: attempt?.createdAt || null,
        score: assessment.type === "quiz" ? (attempt?.score ?? null) : null,
        quizTotal:
          assessment.type === "quiz" && Array.isArray(assessment.quizQuestions)
            ? assessment.quizQuestions.length
            : null,
        quizReview,
        writingTask: assessment.writingTask || "",
        writingInstructions: assessment.writingInstructions || "",
        writingFormat: assessment.writingFormat || "",
        writingResponse: answers.writingResponse || "",
        writingLink: answers.writingLink || "",
        codeSubmission: assessment.codeSubmission || "",
        codeProblem: assessment.codeProblem || "",
        codeEvaluation: assessment.codeEvaluation || "",
        codeResponse: answers.codeResponse || "",
        codeLink: answers.codeLink || "",
        codeFileUrl: answers.codeFileUrl || "",
        codeFileName: answers.codeFileName || "",
        codeFileMimeType: answers.codeFileMimeType || "",
        codeFileSize:
          typeof answers.codeFileSize === "number" ? answers.codeFileSize : 0,
      },
    });
  } catch (error) {
    console.error("Get application assessment detail error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error fetching assessment details",
      error: error.message,
    });
  }
};
