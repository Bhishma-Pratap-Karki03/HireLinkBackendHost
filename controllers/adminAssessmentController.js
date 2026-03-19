const AdminAssessment = require("../models/adminAssessmentModel");
const AssessmentAttempt = require("../models/assessmentAttemptModel");
const User = require("../models/userModel");
const ADMIN_EMAIL = "hirelinknp@gmail.com";

// Small helper to confirm whether the requester is the system admin user.
const isAdminUser = (user) =>
  user &&
  (String(user.role || "").toLowerCase() === "admin" ||
    String(user.email || "").toLowerCase() === ADMIN_EMAIL);

// Create a new admin assessment (quiz/writing/code).
const createAssessment = async (req, res) => {
  try {
    const userId = req.user.id;
    const admin = await User.findById(userId);

    if (!admin || admin.role !== "admin") {
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

    const assessment = new AdminAssessment({
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
    console.error("Create admin assessment error:", error);
    res.status(500).json({
      success: false,
      message: "Server error creating assessment",
      error: error.message,
    });
  }
};

// Get all admin assessments (optionally filtered by status) with attempt stats.
const listAssessments = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = {};
    if (status) filter.status = status;

    const assessments = await AdminAssessment.find(filter)
      .sort({ createdAt: -1 })
      .lean();

    const assessmentIds = assessments.map((item) => item._id);
    const attempts =
      assessmentIds.length > 0
        ? await AssessmentAttempt.find({
            assessmentSource: "admin",
            assessment: { $in: assessmentIds },
            status: "submitted",
          })
            .select("assessment score")
            .lean()
        : [];

    const assessmentMeta = assessments.reduce((acc, item) => {
      acc[item._id.toString()] = {
        type: item.type,
        quizTotal: Array.isArray(item.quizQuestions)
          ? item.quizQuestions.length
          : 0,
      };
      return acc;
    }, {});

    const attemptsMap = attempts.reduce((acc, item) => {
      const id = item.assessment.toString();
      const current = acc[id] || { actualAttempts: 0, correctAttempts: 0 };
      current.actualAttempts += 1;

      const meta = assessmentMeta[id];
      if (
        meta &&
        meta.type === "quiz" &&
        Number(meta.quizTotal) > 0 &&
        Number(item.score) >= Number(meta.quizTotal)
      ) {
        current.correctAttempts += 1;
      }

      acc[id] = current;
      return acc;
    }, {});

    const mapped = assessments.map((item) => ({
      ...item,
      actualAttempts: attemptsMap[item._id.toString()]?.actualAttempts || 0,
      correctAttempts: attemptsMap[item._id.toString()]?.correctAttempts || 0,
    }));

    res.status(200).json({
      success: true,
      assessments: mapped,
    });
  } catch (error) {
    console.error("List admin assessments error:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching assessments",
      error: error.message,
    });
  }
};

// Fetch one assessment by id for preview/edit.
const getAssessmentById = async (req, res) => {
  try {
    const { id } = req.params;
    const assessment = await AdminAssessment.findById(id).lean();

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
    console.error("Get admin assessment error:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching assessment",
      error: error.message,
    });
  }
};

// Update an existing admin assessment.
const updateAssessment = async (req, res) => {
  try {
    const userId = req.user.id;
    const admin = await User.findById(userId);

    if (!admin || admin.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admins can update assessments",
      });
    }

    const { id } = req.params;
    const assessment = await AdminAssessment.findById(id);

    if (!assessment) {
      return res.status(404).json({
        success: false,
        message: "Assessment not found",
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
    console.error("Update admin assessment error:", error);
    res.status(500).json({
      success: false,
      message: "Server error updating assessment",
      error: error.message,
    });
  }
};

// Quickly toggle assessment status between active and inactive.
const toggleAssessmentStatus = async (req, res) => {
  try {
    const userId = req.user.id;
    const admin = await User.findById(userId);

    if (!admin || admin.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admins can update assessment status",
      });
    }

    const { id } = req.params;
    const { status } = req.body;

    if (!["active", "inactive"].includes(String(status))) {
      return res.status(400).json({
        success: false,
        message: "Status must be active or inactive",
      });
    }

    const assessment = await AdminAssessment.findById(id);
    if (!assessment) {
      return res.status(404).json({
        success: false,
        message: "Assessment not found",
      });
    }

    assessment.status = status;
    const savedAssessment = await assessment.save();

    return res.status(200).json({
      success: true,
      message: `Assessment set to ${status}`,
      assessment: savedAssessment,
    });
  } catch (error) {
    console.error("Toggle admin assessment status error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error updating assessment status",
      error: error.message,
    });
  }
};

// Delete an admin assessment by id.
const deleteAssessment = async (req, res) => {
  try {
    const userId = req.user.id;
    const admin = await User.findById(userId);

    if (!admin || admin.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admins can delete assessments",
      });
    }

    const { id } = req.params;
    const assessment = await AdminAssessment.findById(id);

    if (!assessment) {
      return res.status(404).json({
        success: false,
        message: "Assessment not found",
      });
    }

    await assessment.deleteOne();

    res.status(200).json({
      success: true,
      message: "Assessment deleted successfully",
    });
  } catch (error) {
    console.error("Delete admin assessment error:", error);
    res.status(500).json({
      success: false,
      message: "Server error deleting assessment",
      error: error.message,
    });
  }
};

// List submitted attempts for admin-created assessments.
const listAssessmentAttempts = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("role email").lean();
    if (!isAdminUser(user)) {
      return res.status(403).json({
        success: false,
        message: "Only admins can view assessment attempts",
      });
    }

    const attempts = await AssessmentAttempt.find({
      assessmentSource: "admin",
      status: "submitted",
    })
      .populate("candidate", "fullName email profilePicture")
      .sort({ submittedAt: -1, createdAt: -1 })
      .lean();

    const assessmentIds = [
      ...new Set(attempts.map((item) => String(item.assessment))),
    ];
    const assessments = await AdminAssessment.find({ _id: { $in: assessmentIds } })
      .select("title type quizQuestions maxAttempts")
      .lean();
    const assessmentMap = assessments.reduce((acc, item) => {
      acc[String(item._id)] = item;
      return acc;
    }, {});

    const mapped = attempts.map((attempt) => {
      const assessment = assessmentMap[String(attempt.assessment)];
      return {
        id: attempt._id,
        assessmentId: attempt.assessment,
        assessmentTitle: assessment?.title || "Untitled assessment",
        assessmentType: assessment?.type || "quiz",
        maxAttempts: assessment?.maxAttempts || 0,
        quizTotal: Array.isArray(assessment?.quizQuestions)
          ? assessment.quizQuestions.length
          : 0,
        candidate: {
          id: attempt.candidate?._id || null,
          fullName: attempt.candidate?.fullName || "Unknown candidate",
          email: attempt.candidate?.email || "",
          profilePicture: attempt.candidate?.profilePicture || "",
        },
        attemptNumber: attempt.attemptNumber || 1,
        submittedAt: attempt.submittedAt || attempt.createdAt,
        score: typeof attempt.score === "number" ? attempt.score : null,
      };
    });

    return res.status(200).json({ success: true, attempts: mapped });
  } catch (error) {
    console.error("List admin assessment attempts error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error fetching assessment attempts",
      error: error.message,
    });
  }
};

// Show detailed review data for one attempt (answers, score, correctness).
const getAssessmentAttemptDetail = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("role email").lean();
    if (!isAdminUser(user)) {
      return res.status(403).json({
        success: false,
        message: "Only admins can view assessment attempt details",
      });
    }

    const { attemptId } = req.params;
    const attempt = await AssessmentAttempt.findById(attemptId)
      .populate("candidate", "fullName email profilePicture")
      .lean();
    if (!attempt || attempt.assessmentSource !== "admin") {
      return res.status(404).json({
        success: false,
        message: "Assessment attempt not found",
      });
    }

    const assessment = await AdminAssessment.findById(attempt.assessment).lean();
    if (!assessment) {
      return res.status(404).json({
        success: false,
        message: "Assessment not found",
      });
    }

    const answers = attempt.answers || {};
    const quizAnswers = Array.isArray(answers.quizAnswers) ? answers.quizAnswers : [];
    const quizReview =
      assessment.type === "quiz" && Array.isArray(assessment.quizQuestions)
        ? assessment.quizQuestions.map((question, index) => {
            const selectedIndex =
              typeof quizAnswers[index] === "number" ? quizAnswers[index] : null;
            const correctIndex =
              typeof question.correctIndex === "number" ? question.correctIndex : null;
            const options = Array.isArray(question.options) ? question.options : [];
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

    return res.status(200).json({
      success: true,
      attempt: {
        id: attempt._id,
        attemptNumber: attempt.attemptNumber || 1,
        submittedAt: attempt.submittedAt || attempt.createdAt,
        startTime: attempt.startTime || null,
        endTime: attempt.endTime || null,
        status: attempt.status,
        score: typeof attempt.score === "number" ? attempt.score : null,
      },
      candidate: {
        id: attempt.candidate?._id || null,
        fullName: attempt.candidate?.fullName || "Unknown candidate",
        email: attempt.candidate?.email || "",
        profilePicture: attempt.candidate?.profilePicture || "",
      },
      assessment: {
        id: assessment._id,
        title: assessment.title,
        type: assessment.type,
        codeSubmission: assessment.codeSubmission || "",
        description: assessment.description || "",
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
        codeProblem: assessment.codeProblem || "",
        codeEvaluation: assessment.codeEvaluation || "",
        codeResponse: answers.codeResponse || "",
        codeLink: answers.codeLink || "",
        codeFileUrl: answers.codeFileUrl || "",
        codeFileName: answers.codeFileName || "",
        codeFileMimeType: answers.codeFileMimeType || "",
        codeFileSize: typeof answers.codeFileSize === "number" ? answers.codeFileSize : 0,
      },
    });
  } catch (error) {
    console.error("Get admin assessment attempt detail error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error fetching assessment attempt detail",
      error: error.message,
    });
  }
};

// Allow admin to dismiss an attempt record from review history.
const dismissAssessmentAttempt = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("role email").lean();
    if (!isAdminUser(user)) {
      return res.status(403).json({
        success: false,
        message: "Only admins can dismiss assessment attempts",
      });
    }

    const { attemptId } = req.params;
    const attempt = await AssessmentAttempt.findById(attemptId);
    if (!attempt || attempt.assessmentSource !== "admin") {
      return res.status(404).json({
        success: false,
        message: "Assessment attempt not found",
      });
    }

    await AssessmentAttempt.deleteOne({ _id: attemptId });

    return res.status(200).json({
      success: true,
      message: "Assessment submission dismissed successfully",
    });
  } catch (error) {
    console.error("Dismiss admin assessment attempt error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error dismissing assessment submission",
      error: error.message,
    });
  }
};

module.exports = {
  createAssessment,
  listAssessments,
  getAssessmentById,
  updateAssessment,
  toggleAssessmentStatus,
  deleteAssessment,
  listAssessmentAttempts,
  getAssessmentAttemptDetail,
  dismissAssessmentAttempt,
};
