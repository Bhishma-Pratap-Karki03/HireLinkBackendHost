const Assessment = require("../models/assessmentModel");
const User = require("../models/userModel");

// Shared assessment controller for admin/recruiter CRUD endpoints.
const createAssessment = async (req, res) => {
  try {
    const userId = req.user.id;
    const admin = await User.findById(userId);

    if (!admin || (admin.role !== "admin" && admin.role !== "recruiter")) {
      return res.status(403).json({
        success: false,
        message: "Only admins can create assessments",
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
      visibleToRecruiters,
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

    if (type === "quiz") {
      if (!Array.isArray(quizQuestions) || quizQuestions.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Quiz questions are required",
        });
      }
      for (const question of quizQuestions) {
        if (!question.question || !question.options || question.options.length < 2) {
          return res.status(400).json({
            success: false,
            message: "Each quiz question must have at least 2 options",
          });
        }
        if (question.correctIndex === null || question.correctIndex === undefined) {
          return res.status(400).json({
            success: false,
            message: "Each quiz question must have a correct answer",
          });
        }
      }
    }

    if (type === "writing") {
      if (!writingTask || !writingInstructions) {
        return res.status(400).json({
          success: false,
          message: "Writing task and instructions are required",
        });
      }
    }

    if (type === "task" || type === "code") {
      if (!codeProblem || !codeSubmission || !codeEvaluation) {
        return res.status(400).json({
          success: false,
          message: "Task assessment fields are required",
        });
      }
    }

    const assessment = new Assessment({
      title: String(title).trim(),
      description,
      type,
      difficulty,
      timeLimit: timeLimit || "",
      maxAttempts: Number(maxAttempts),
      status,
      deadline: deadline || null,
      visibleToRecruiters: Boolean(visibleToRecruiters),
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
    console.error("Create assessment error:", error);
    res.status(500).json({
      success: false,
      message: "Server error creating assessment",
      error: error.message,
    });
  }
};

// List assessments with optional query filters.
const listAssessments = async (req, res) => {
  try {
    const { status, createdBy, mine, visibleToRecruiters } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (visibleToRecruiters !== undefined) {
      filter.visibleToRecruiters = String(visibleToRecruiters) === "true";
    }
    if ((mine === "true" || req.originalUrl.includes("/mine")) && req.user) {
      filter.createdBy = req.user.id;
    } else if (createdBy) {
      filter.createdBy = createdBy;
    }

    const assessments = await Assessment.find(filter)
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      assessments,
    });
  } catch (error) {
    console.error("List assessments error:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching assessments",
      error: error.message,
    });
  }
};

// Get one assessment detail by id.
const getAssessmentById = async (req, res) => {
  try {
    const { id } = req.params;
    const assessment = await Assessment.findById(id).lean();

    if (!assessment) {
      return res.status(404).json({
        success: false,
        message: "Assessment not found",
      });
    }

    res.status(200).json({
      success: true,
      assessment,
    });
  } catch (error) {
    console.error("Get assessment error:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching assessment",
      error: error.message,
    });
  }
};

// Update assessment content and settings.
const updateAssessment = async (req, res) => {
  try {
    const userId = req.user.id;
    const admin = await User.findById(userId);

    if (!admin || (admin.role !== "admin" && admin.role !== "recruiter")) {
      return res.status(403).json({
        success: false,
        message: "Only admins can update assessments",
      });
    }

    const { id } = req.params;
    const assessment = await Assessment.findById(id);

    if (!assessment) {
      return res.status(404).json({
        success: false,
        message: "Assessment not found",
      });
    }

    if (
      admin.role !== "admin" &&
      assessment.createdBy.toString() !== userId.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to update this assessment",
      });
    }

    const updates = req.body;

    assessment.title = updates.title || assessment.title;
    assessment.description = updates.description || assessment.description;
    assessment.type = updates.type || assessment.type;
    assessment.difficulty = updates.difficulty || assessment.difficulty;
    assessment.timeLimit = updates.timeLimit || "";
    assessment.maxAttempts = Number(updates.maxAttempts) || assessment.maxAttempts;
    assessment.status = updates.status || assessment.status;
    assessment.deadline = updates.deadline || assessment.deadline;
    assessment.visibleToRecruiters =
      updates.visibleToRecruiters !== undefined
        ? Boolean(updates.visibleToRecruiters)
        : assessment.visibleToRecruiters;
    assessment.skillTags = Array.isArray(updates.skillTags)
      ? updates.skillTags
      : assessment.skillTags;
    assessment.quizQuestions = Array.isArray(updates.quizQuestions)
      ? updates.quizQuestions
      : assessment.quizQuestions;
    assessment.writingTask = updates.writingTask || "";
    assessment.writingInstructions = updates.writingInstructions || "";
    assessment.writingFormat = updates.writingFormat || "text";
    assessment.codeProblem = updates.codeProblem || "";
    assessment.codeLanguages = Array.isArray(updates.codeLanguages)
      ? updates.codeLanguages
      : assessment.codeLanguages;
    assessment.codeSubmission = updates.codeSubmission || "file";
    assessment.codeEvaluation = updates.codeEvaluation || "";

    const savedAssessment = await assessment.save();

    res.status(200).json({
      success: true,
      message: "Assessment updated successfully",
      assessment: savedAssessment,
    });
  } catch (error) {
    console.error("Update assessment error:", error);
    res.status(500).json({
      success: false,
      message: "Server error updating assessment",
      error: error.message,
    });
  }
};

// Delete assessment by id.
const deleteAssessment = async (req, res) => {
  try {
    const userId = req.user.id;
    const admin = await User.findById(userId);

    if (!admin || (admin.role !== "admin" && admin.role !== "recruiter")) {
      return res.status(403).json({
        success: false,
        message: "Only admins can delete assessments",
      });
    }

    const { id } = req.params;
    const assessment = await Assessment.findById(id);

    if (!assessment) {
      return res.status(404).json({
        success: false,
        message: "Assessment not found",
      });
    }

    if (
      admin.role !== "admin" &&
      assessment.createdBy.toString() !== userId.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to delete this assessment",
      });
    }

    await assessment.deleteOne();

    res.status(200).json({
      success: true,
      message: "Assessment deleted successfully",
    });
  } catch (error) {
    console.error("Delete assessment error:", error);
    res.status(500).json({
      success: false,
      message: "Server error deleting assessment",
      error: error.message,
    });
  }
};

module.exports = {
  createAssessment,
  listAssessments,
  getAssessmentById,
  updateAssessment,
  deleteAssessment,
};






