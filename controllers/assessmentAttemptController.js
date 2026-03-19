const AdminAssessment = require("../models/adminAssessmentModel");
const RecruiterAssessment = require("../models/recruiterAssessmentModel");
const AssessmentAttempt = require("../models/assessmentAttemptModel");
const User = require("../models/userModel");
const ConnectionRequest = require("../models/connectionRequestModel");
const fs = require("fs");
const path = require("path");

// Convert "60 min"/"90" style values into a clean minute number.
const parseMinutes = (value) => {
  if (!value) return 60;
  const match = String(value).match(/(\d+)/);
  if (!match) return 60;
  const minutes = Number(match[1]);
  return Number.isNaN(minutes) || minutes <= 0 ? 60 : minutes;
};

// Load assessment document from the correct source (admin or recruiter).
const getAssessmentBySource = async (attempt) => {
  if (!attempt) return null;
  if (attempt.assessmentSource === "recruiter") {
    return RecruiterAssessment.findById(attempt.assessment).lean();
  }
  return AdminAssessment.findById(attempt.assessment).lean();
};

// If attempt time is over, submit it automatically and calculate quiz score.
const autoSubmitIfExpired = async (attempt, assessment) => {
  if (!attempt || attempt.status !== "in_progress") return attempt;
  const now = new Date();
  if (now <= attempt.endTime) return attempt;

  let score = 0;
  if (assessment?.type === "quiz" && Array.isArray(assessment.quizQuestions)) {
    const answers = attempt.answers?.quizAnswers || [];
    score = assessment.quizQuestions.reduce((total, question, index) => {
      const correct = question.correctIndex;
      if (correct === undefined || correct === null) return total;
      return answers[index] === correct ? total + 1 : total;
    }, 0);
  }

  attempt.status = "submitted";
  attempt.submittedAt = now;
  attempt.score = score;
  await attempt.save();
  return attempt;
};

// Keep response format same for history/showcase APIs.
const formatSubmissionSummary = (attempt, assessment) => {
  const quizTotal =
    assessment?.type === "quiz" && Array.isArray(assessment.quizQuestions)
      ? assessment.quizQuestions.length
      : 0;

  return {
    attemptId: String(attempt._id),
    assessmentId: String(attempt.assessment),
    assessmentSource: attempt.assessmentSource || "admin",
    title: assessment?.title || "Assessment",
    type: assessment?.type || "quiz",
    difficulty: assessment?.difficulty || "",
    submittedAt: attempt.submittedAt || attempt.updatedAt || attempt.createdAt,
    attemptNumber: attempt.attemptNumber || 1,
    score: typeof attempt.score === "number" ? attempt.score : 0,
    quizTotal,
  };
};

// Decide whether a viewer can see a candidate's submission showcase.
const canViewCandidateSubmissions = async (viewerId, candidateId) => {
  if (!viewerId || !candidateId) return false;
  if (String(viewerId) === String(candidateId)) return true;

  const [viewer, candidate] = await Promise.all([
    User.findById(viewerId).select("role").lean(),
    User.findById(candidateId).select("role profileVisibility").lean(),
  ]);

  if (!viewer) return false;
  if (!candidate || candidate.role !== "candidate") return false;

  if (viewer.role === "admin") return true;
  if (!["candidate", "recruiter"].includes(viewer.role)) return false;

  const link = await ConnectionRequest.findOne({
    status: "accepted",
    $or: [
      { requester: viewerId, recipient: candidateId },
      { requester: candidateId, recipient: viewerId },
    ],
  })
    .select("_id")
    .lean();

  if (candidate.profileVisibility === "private") {
    return Boolean(link);
  }

  return Boolean(link);
};

// Safely parse array payload values that may arrive as JSON string.
const parseArrayField = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_error) {
    return [];
  }
};

// Normalize answers so DB always stores predictable keys.
const normalizeAnswerPayload = (raw = {}) => ({
  quizAnswers: parseArrayField(raw.quizAnswers)
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item)),
  writingResponse:
    typeof raw.writingResponse === "string" ? raw.writingResponse : "",
  writingLink: typeof raw.writingLink === "string" ? raw.writingLink : "",
  codeResponse: typeof raw.codeResponse === "string" ? raw.codeResponse : "",
  codeLink: typeof raw.codeLink === "string" ? raw.codeLink : "",
});

// Remove previous uploaded file if we replaced it with a new one.
const removeUploadedFileIfExists = (url) => {
  if (!url || typeof url !== "string" || !url.startsWith("/uploads/")) return;
  const relativePath = url.replace(/^\/uploads\//, "");
  const absolutePath = path.join(__dirname, "..", "public", "uploads", relativePath);
  if (fs.existsSync(absolutePath)) {
    try {
      fs.unlinkSync(absolutePath);
    } catch (_error) {
      // Do not fail request on cleanup error
    }
  }
};

// Convert uploaded code file metadata into the shape stored in answers.
const mapUploadedCodeFile = (file) => {
  if (!file?.filename) return null;
  return {
    codeFileUrl: `/uploads/assessment-submissions/${file.filename}`,
    codeFileName: file.originalname || file.filename,
    codeFileMimeType: file.mimetype || "",
    codeFileSize: typeof file.size === "number" ? file.size : 0,
  };
};

// Candidate-facing list of active admin assessments with attempt progress.
const listAvailableAssessments = async (req, res) => {
  try {
    const userId = req.user.id;
    const assessmentsRaw = await AdminAssessment.find({ status: "active" })
      .populate("createdBy", "role email")
      .sort({ createdAt: -1 })
      .lean();

    const assessments = assessmentsRaw.filter((item) => {
      const creator = item.createdBy;
      if (!creator) return false;
      return (
        creator.role === "admin" || creator.email === "hirelinknp@gmail.com"
      );
    });

    const attempts = await AssessmentAttempt.find({ candidate: userId })
      .sort({ submittedAt: -1, createdAt: -1 })
      .lean();
    const attemptsByAssessment = attempts.reduce((acc, attempt) => {
      const key = attempt.assessment.toString();
      if (!acc[key]) acc[key] = [];
      acc[key].push(attempt);
      return acc;
    }, {});

    const now = new Date();

    const mapped = await Promise.all(
      assessments.map(async (assessment) => {
        const assessmentAttempts = (
          attemptsByAssessment[assessment._id.toString()] || []
        ).filter((attempt) => attempt.assessmentSource === "admin");
        let inProgress = assessmentAttempts.find(
          (attempt) => attempt.status === "in_progress",
        );
        if (inProgress) {
          const hydrated = await AssessmentAttempt.findById(inProgress._id);
          if (hydrated) {
            await autoSubmitIfExpired(hydrated, assessment);
            inProgress = hydrated.toObject();
          }
        }
        const submittedAttempts = assessmentAttempts.filter(
          (attempt) => attempt.status === "submitted",
        );
        const latestSubmitted = submittedAttempts[0] || null;
        const attemptsUsed = submittedAttempts.length;
        const attemptsLeft = Math.max(assessment.maxAttempts - attemptsUsed, 0);
        let status = "not_started";
        if (inProgress && inProgress.status === "in_progress") {
          status = "in_progress";
        } else if (attemptsUsed > 0) {
          status = "submitted";
        }

        return {
          id: assessment._id,
          title: assessment.title,
          type: assessment.type,
          difficulty: assessment.difficulty,
          timeLimit: assessment.timeLimit || "",
          maxAttempts: assessment.maxAttempts,
          deadline: assessment.deadline || "",
          quizTotal:
            assessment.type === "quiz" && Array.isArray(assessment.quizQuestions)
              ? assessment.quizQuestions.length
              : null,
          attemptsUsed,
          attemptsLeft,
          status,
          activeAttemptId: inProgress?._id || null,
          latestSubmittedAttemptId: latestSubmitted?._id || null,
          latestSubmittedAt: latestSubmitted?.submittedAt || null,
          latestScore:
            typeof latestSubmitted?.score === "number"
              ? latestSubmitted.score
              : null,
          remainingMs:
            inProgress && inProgress.status === "in_progress"
              ? Math.max(new Date(inProgress.endTime).getTime() - now.getTime(), 0)
              : 0,
        };
      }),
    );

    res.status(200).json({ success: true, assessments: mapped });
  } catch (error) {
    console.error("List available assessments error:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching assessments",
      error: error.message,
    });
  }
};

// Start a new attempt or return current in-progress attempt.
const startAttempt = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const assessment = await AdminAssessment.findById(id);
    if (!assessment || assessment.status !== "active") {
      return res.status(404).json({
        success: false,
        message: "Assessment not available",
      });
    }

    let inProgress = await AssessmentAttempt.findOne({
      assessment: id,
      candidate: userId,
      status: "in_progress",
      assessmentSource: "admin",
    });

    if (inProgress) {
      inProgress = await autoSubmitIfExpired(inProgress, assessment);
      if (inProgress.status === "in_progress") {
        return res.status(200).json({
          success: true,
          attempt: inProgress,
          assessment,
        });
      }
    }

    const submittedCount = await AssessmentAttempt.countDocuments({
      assessment: id,
      candidate: userId,
      status: "submitted",
      assessmentSource: "admin",
    });

    if (submittedCount >= assessment.maxAttempts) {
      return res.status(403).json({
        success: false,
        message: "No attempts remaining",
      });
    }

    const minutes = parseMinutes(assessment.timeLimit);
    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + minutes * 60000);

    const attempt = await AssessmentAttempt.create({
      assessment: id,
      assessmentSource: "admin",
      candidate: userId,
      attemptNumber: submittedCount + 1,
      startTime,
      endTime,
      status: "in_progress",
      answers: {
        quizAnswers: [],
        writingResponse: "",
        writingLink: "",
        codeResponse: "",
        codeLink: "",
        codeFileUrl: "",
        codeFileName: "",
        codeFileMimeType: "",
        codeFileSize: 0,
      },
    });

    res.status(201).json({ success: true, attempt, assessment });
  } catch (error) {
    console.error("Start assessment attempt error:", error);
    res.status(500).json({
      success: false,
      message: "Server error starting attempt",
      error: error.message,
    });
  }
};

// Get one attempt with its assessment details.
const getAttempt = async (req, res) => {
  try {
    const userId = req.user.id;
    const { attemptId } = req.params;
    const attempt = await AssessmentAttempt.findById(attemptId);
    if (!attempt) {
      return res.status(404).json({ success: false, message: "Attempt not found" });
    }
    if (attempt.candidate.toString() !== userId.toString()) {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    const assessment = await getAssessmentBySource(attempt);
    await autoSubmitIfExpired(attempt, assessment);

    res.status(200).json({
      success: true,
      attempt,
      assessment,
    });
  } catch (error) {
    console.error("Get attempt error:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching attempt",
      error: error.message,
    });
  }
};

// Save draft answers while attempt is still in progress.
const saveAnswers = async (req, res) => {
  try {
    const userId = req.user.id;
    const { attemptId } = req.params;
    const attempt = await AssessmentAttempt.findById(attemptId);
    if (!attempt) {
      return res.status(404).json({ success: false, message: "Attempt not found" });
    }
    if (attempt.candidate.toString() !== userId.toString()) {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    const assessment = await getAssessmentBySource(attempt);
    if (!assessment) {
      return res.status(404).json({ success: false, message: "Assessment not found" });
    }

    await autoSubmitIfExpired(attempt, assessment);
    if (attempt.status !== "in_progress") {
      return res.status(409).json({
        success: false,
        message: "Attempt already submitted",
      });
    }

    const normalizedBody = normalizeAnswerPayload(req.body || {});
    const uploadedCodeFile = mapUploadedCodeFile(req.file);
    const previousFileUrl = attempt.answers?.codeFileUrl || "";

    attempt.answers = {
      ...attempt.answers,
      ...normalizedBody,
      ...(uploadedCodeFile || {}),
    };
    if (uploadedCodeFile) {
      attempt.answers.codeResponse = "";
      attempt.answers.codeLink = "";
    }
    await attempt.save();
    if (uploadedCodeFile && previousFileUrl && previousFileUrl !== uploadedCodeFile.codeFileUrl) {
      removeUploadedFileIfExists(previousFileUrl);
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Save answers error:", error);
    res.status(500).json({
      success: false,
      message: "Server error saving answers",
      error: error.message,
    });
  }
};

// Final submit endpoint for an assessment attempt.
const submitAttempt = async (req, res) => {
  try {
    const userId = req.user.id;
    const { attemptId } = req.params;
    const attempt = await AssessmentAttempt.findById(attemptId);
    if (!attempt) {
      return res.status(404).json({ success: false, message: "Attempt not found" });
    }
    if (attempt.candidate.toString() !== userId.toString()) {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }
    const assessment = await getAssessmentBySource(attempt);
    if (!assessment) {
      return res.status(404).json({ success: false, message: "Assessment not found" });
    }

    if (attempt.status === "submitted") {
      return res.status(200).json({ success: true, attempt });
    }

    const normalizedBody = normalizeAnswerPayload(req.body || {});
    const uploadedCodeFile = mapUploadedCodeFile(req.file);
    const previousFileUrl = attempt.answers?.codeFileUrl || "";

    attempt.answers = {
      ...attempt.answers,
      ...normalizedBody,
      ...(uploadedCodeFile || {}),
    };
    if (uploadedCodeFile) {
      attempt.answers.codeResponse = "";
      attempt.answers.codeLink = "";
    }

    const hasCodeFile = Boolean(attempt.answers?.codeFileUrl);
    const hasCodeLink =
      typeof attempt.answers?.codeLink === "string" &&
      attempt.answers.codeLink.trim().length > 0;

    if (
      (assessment.type === "task" || assessment.type === "code") &&
      assessment.codeSubmission === "file" &&
      !hasCodeFile &&
      !hasCodeLink
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Please upload a file (PDF, DOC, DOCX, or ZIP) or provide a task link before submitting.",
      });
    }

    attempt.status = "submitted";
    attempt.submittedAt = new Date();

    if (assessment.type === "quiz" && Array.isArray(assessment.quizQuestions)) {
      const answers = attempt.answers?.quizAnswers || [];
      const score = assessment.quizQuestions.reduce((total, question, index) => {
        const correct = question.correctIndex;
        if (correct === undefined || correct === null) return total;
        return answers[index] === correct ? total + 1 : total;
      }, 0);
      attempt.score = score;
    }

    await attempt.save();
    if (uploadedCodeFile && previousFileUrl && previousFileUrl !== uploadedCodeFile.codeFileUrl) {
      removeUploadedFileIfExists(previousFileUrl);
    }

    res.status(200).json({ success: true, attempt });
  } catch (error) {
    console.error("Submit attempt error:", error);
    res.status(500).json({
      success: false,
      message: "Server error submitting attempt",
      error: error.message,
    });
  }
};

// Candidate's own submitted assessment history.
const getMySubmissionHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const attempts = await AssessmentAttempt.find({
      candidate: userId,
      status: "submitted",
    })
      .sort({ submittedAt: -1, createdAt: -1 })
      .lean();

    const mapped = await Promise.all(
      attempts.map(async (attempt) => {
        const assessment = await getAssessmentBySource(attempt);
        return formatSubmissionSummary(attempt, assessment);
      }),
    );

    return res.status(200).json({
      success: true,
      submissions: mapped,
    });
  } catch (error) {
    console.error("Get submission history error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error fetching submission history",
      error: error.message,
    });
  }
};

// Candidate's selected submissions shown in profile/showcase.
const getMyShowcaseSubmissions = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId)
      .select("showcasedAssessmentAttempts")
      .lean();
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const ids = Array.isArray(user.showcasedAssessmentAttempts)
      ? user.showcasedAssessmentAttempts.map((id) => String(id))
      : [];

    return res.status(200).json({
      success: true,
      attemptIds: ids.slice(0, 5),
    });
  } catch (error) {
    console.error("Get showcase submissions error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error fetching showcased submissions",
      error: error.message,
    });
  }
};

// Update which submissions are visible in candidate showcase.
const updateMyShowcaseSubmissions = async (req, res) => {
  try {
    const userId = req.user.id;
    const attemptIds = Array.isArray(req.body?.attemptIds)
      ? req.body.attemptIds.map((id) => String(id))
      : [];
    const uniqueIds = [...new Set(attemptIds)].slice(0, 5);

    const validAttempts = await AssessmentAttempt.find({
      _id: { $in: uniqueIds },
      candidate: userId,
      status: "submitted",
    })
      .select("_id")
      .lean();
    const validIdSet = new Set(validAttempts.map((item) => String(item._id)));
    const filteredIds = uniqueIds.filter((id) => validIdSet.has(id));

    await User.findByIdAndUpdate(userId, {
      $set: { showcasedAssessmentAttempts: filteredIds },
    });

    return res.status(200).json({
      success: true,
      attemptIds: filteredIds,
    });
  } catch (error) {
    console.error("Update showcase submissions error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error updating showcased submissions",
      error: error.message,
    });
  }
};

// View another candidate's showcase submissions (with visibility checks).
const getCandidateShowcaseSubmissions = async (req, res) => {
  try {
    const viewerId = req.user.id;
    const { candidateId } = req.params;

    const canView = await canViewCandidateSubmissions(viewerId, candidateId);
    if (!canView) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to view candidate submissions",
      });
    }

    const candidate = await User.findById(candidateId)
      .select("role showcasedAssessmentAttempts")
      .lean();
    if (!candidate || candidate.role !== "candidate") {
      return res.status(404).json({
        success: false,
        message: "Candidate not found",
      });
    }

    const showcasedIds = Array.isArray(candidate.showcasedAssessmentAttempts)
      ? candidate.showcasedAssessmentAttempts.map((id) => String(id))
      : [];

    let attempts = [];
    if (showcasedIds.length > 0) {
      attempts = await AssessmentAttempt.find({
        _id: { $in: showcasedIds },
        candidate: candidateId,
        status: "submitted",
      }).lean();
    }

    const orderMap = new Map(showcasedIds.map((id, index) => [id, index]));
    attempts.sort((a, b) => {
      const aIndex = orderMap.has(String(a._id))
        ? orderMap.get(String(a._id))
        : Number.MAX_SAFE_INTEGER;
      const bIndex = orderMap.has(String(b._id))
        ? orderMap.get(String(b._id))
        : Number.MAX_SAFE_INTEGER;
      if (aIndex !== bIndex) return aIndex - bIndex;
      const aTime = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
      const bTime = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
      return bTime - aTime;
    });

    const mapped = await Promise.all(
      attempts.slice(0, 5).map(async (attempt) => {
        const assessment = await getAssessmentBySource(attempt);
        return formatSubmissionSummary(attempt, assessment);
      }),
    );

    return res.status(200).json({
      success: true,
      submissions: mapped,
    });
  } catch (error) {
    console.error("Get candidate showcase submissions error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error fetching candidate showcased submissions",
      error: error.message,
    });
  }
};

// View a specific submission detail of another candidate (permission based).
const getCandidateSubmissionDetail = async (req, res) => {
  try {
    const viewerId = req.user.id;
    const { candidateId, attemptId } = req.params;

    const canView = await canViewCandidateSubmissions(viewerId, candidateId);
    if (!canView) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to view this submission",
      });
    }

    const attempt = await AssessmentAttempt.findOne({
      _id: attemptId,
      candidate: candidateId,
      status: "submitted",
    }).lean();

    if (!attempt) {
      return res
        .status(404)
        .json({ success: false, message: "Submission not found" });
    }

    const assessment = await getAssessmentBySource(attempt);
    if (!assessment) {
      return res
        .status(404)
        .json({ success: false, message: "Assessment not found" });
    }

    return res.status(200).json({
      success: true,
      attempt,
      assessment,
    });
  } catch (error) {
    console.error("Get candidate submission detail error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error fetching submission detail",
      error: error.message,
    });
  }
};

module.exports = {
  listAvailableAssessments,
  startAttempt,
  saveAnswers,
  submitAttempt,
  getAttempt,
  getMySubmissionHistory,
  getMyShowcaseSubmissions,
  updateMyShowcaseSubmissions,
  getCandidateShowcaseSubmissions,
  getCandidateSubmissionDetail,
};
