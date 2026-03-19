// Recruiter-only assessment CRUD controller.
const RecruiterAssessment = require("../models/recruiterAssessmentModel");
const User = require("../models/userModel");

const createRecruiterAssessment = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);

    if (!user || user.role !== "recruiter") {
      return res.status(403).json({
        success: false,
        message: "Only recruiters can create assessments",
      });
    }

    const {
      title,
      description,
      type,
      difficulty,
      timeLimit,
      maxAttempts,
      status,
      deadline,
      skillTags,
      quizQuestions,
      writingTask,
      writingInstructions,
      writingFormat,
      codeProblem,
      codeLanguages,
      codeSubmission,
      codeEvaluation,
    } = req.body;

    const requiredFields = {
      title,
      description,
      type,
      difficulty,
      maxAttempts,
      status,
    };

    const missing = Object.entries(requiredFields)
      .filter(([, value]) => value === undefined || value === null || value === "")
      .map(([key]) => key);

    if (missing.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
        missingFields: missing,
      });
    }

    const assessment = new RecruiterAssessment({
      title: String(title).trim(),
      description,
      type,
      difficulty,
      timeLimit: timeLimit || "",
      maxAttempts: Number(maxAttempts),
      status,
      deadline: deadline || null,
      skillTags: Array.isArray(skillTags)
        ? skillTags.filter((tag) => String(tag).trim())
        : [],
      quizQuestions: type === "quiz" && Array.isArray(quizQuestions) ? quizQuestions : [],
      writingTask: writingTask || "",
      writingInstructions: writingInstructions || "",
      writingFormat: writingFormat || "text",
      codeProblem: codeProblem || "",
      codeLanguages: Array.isArray(codeLanguages) ? codeLanguages : [],
      codeSubmission: codeSubmission || "file",
      codeEvaluation: codeEvaluation || "",
      createdBy: userId,
    });

    const savedAssessment = await assessment.save();

    res.status(201).json({
      success: true,
      message: "Assessment created successfully",
      assessment: savedAssessment,
    });
  } catch (error) {
    console.error("Create recruiter assessment error:", error);
    res.status(500).json({
      success: false,
      message: "Server error creating assessment",
      error: error.message,
    });
  }
};

const getRecruiterAssessmentById = async (req, res) => {
  try {
    const { id } = req.params;
    const assessment = await RecruiterAssessment.findById(id).lean();
    if (!assessment) {
      return res.status(404).json({
        success: false,
        message: "Assessment not found",
      });
    }
    res.status(200).json({ success: true, assessment });
  } catch (error) {
    console.error("Get recruiter assessment error:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching assessment",
      error: error.message,
    });
  }
};

const updateRecruiterAssessment = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);

    if (!user || user.role !== "recruiter") {
      return res.status(403).json({
        success: false,
        message: "Only recruiters can update assessments",
      });
    }

    const { id } = req.params;
    const assessment = await RecruiterAssessment.findById(id);
    if (!assessment) {
      return res.status(404).json({
        success: false,
        message: "Assessment not found",
      });
    }

    if (String(assessment.createdBy) !== String(userId)) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to update this assessment",
      });
    }

    const updates = req.body || {};

    const requiredFields = {
      title: updates.title,
      description: updates.description,
      type: updates.type,
      difficulty: updates.difficulty,
      maxAttempts: updates.maxAttempts,
      status: updates.status,
    };

    const missing = Object.entries(requiredFields)
      .filter(([, value]) => value === undefined || value === null || value === "")
      .map(([key]) => key);

    if (missing.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
        missingFields: missing,
      });
    }

    assessment.title = String(updates.title).trim();
    assessment.description = updates.description;
    assessment.type = updates.type;
    assessment.difficulty = updates.difficulty;
    assessment.timeLimit = updates.timeLimit || "";
    assessment.maxAttempts = Number(updates.maxAttempts);
    assessment.status = updates.status;
    assessment.deadline = updates.deadline || null;
    assessment.skillTags = Array.isArray(updates.skillTags)
      ? updates.skillTags.filter((tag) => String(tag).trim())
      : [];
    assessment.quizQuestions =
      updates.type === "quiz" && Array.isArray(updates.quizQuestions)
        ? updates.quizQuestions
        : [];
    assessment.writingTask = updates.writingTask || "";
    assessment.writingInstructions = updates.writingInstructions || "";
    assessment.writingFormat = updates.writingFormat || "text";
    assessment.codeProblem = updates.codeProblem || "";
    assessment.codeLanguages = Array.isArray(updates.codeLanguages)
      ? updates.codeLanguages
      : [];
    assessment.codeSubmission = updates.codeSubmission || "file";
    assessment.codeEvaluation = updates.codeEvaluation || "";

    const savedAssessment = await assessment.save();

    res.status(200).json({
      success: true,
      message: "Assessment updated successfully",
      assessment: savedAssessment,
    });
  } catch (error) {
    console.error("Update recruiter assessment error:", error);
    res.status(500).json({
      success: false,
      message: "Server error updating assessment",
      error: error.message,
    });
  }
};

module.exports = {
  createRecruiterAssessment,
  getRecruiterAssessmentById,
  updateRecruiterAssessment,
};


