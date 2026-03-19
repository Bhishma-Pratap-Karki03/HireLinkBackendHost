// Handles candidate attempts for recruiter-created assessments.
const RecruiterAssessment = require("../models/recruiterAssessmentModel");
const AssessmentAttempt = require("../models/assessmentAttemptModel");
const fs = require("fs");
const path = require("path");

const parseMinutes = (value) => {
  if (!value) return 60;
  const match = String(value).match(/(\d+)/);
  if (!match) return 60;
  const minutes = Number(match[1]);
  return Number.isNaN(minutes) || minutes <= 0 ? 60 : minutes;
};

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

const mapUploadedCodeFile = (file) => {
  if (!file?.filename) return null;
  return {
    codeFileUrl: `/uploads/assessment-submissions/${file.filename}`,
    codeFileName: file.originalname || file.filename,
    codeFileMimeType: file.mimetype || "",
    codeFileSize: typeof file.size === "number" ? file.size : 0,
  };
};

const startRecruiterAttempt = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const assessment = await RecruiterAssessment.findById(id);
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
      assessmentSource: "recruiter",
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
      assessmentSource: "recruiter",
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
      assessmentSource: "recruiter",
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
    console.error("Start recruiter attempt error:", error);
    res.status(500).json({
      success: false,
      message: "Server error starting attempt",
      error: error.message,
    });
  }
};

const saveRecruiterAnswers = async (req, res) => {
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
    const assessment = await RecruiterAssessment.findById(attempt.assessment);
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
    console.error("Save recruiter answers error:", error);
    res.status(500).json({
      success: false,
      message: "Server error saving answers",
      error: error.message,
    });
  }
};

const submitRecruiterAttempt = async (req, res) => {
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
    const assessment = await RecruiterAssessment.findById(attempt.assessment);
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
    console.error("Submit recruiter attempt error:", error);
    res.status(500).json({
      success: false,
      message: "Server error submitting attempt",
      error: error.message,
    });
  }
};

const getRecruiterAssessmentMeta = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const assessment = await RecruiterAssessment.findById(id).lean();
    if (!assessment || assessment.status !== "active") {
      return res.status(404).json({
        success: false,
        message: "Assessment not available",
      });
    }

    const attempts = await AssessmentAttempt.find({
      assessment: id,
      candidate: userId,
      assessmentSource: "recruiter",
    })
      .sort({ submittedAt: -1, createdAt: -1 })
      .lean();

    let inProgress = attempts.find((attempt) => attempt.status === "in_progress");
    if (inProgress) {
      const hydrated = await AssessmentAttempt.findById(inProgress._id);
      if (hydrated) {
        await autoSubmitIfExpired(hydrated, assessment);
        inProgress = hydrated.toObject();
      }
    }

    const submittedAttempts = attempts.filter(
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

    res.status(200).json({
      success: true,
      meta: {
        status,
        attemptsLeft,
        activeAttemptId: inProgress?._id || null,
        latestSubmittedAttemptId: latestSubmitted?._id || null,
        latestScore:
          typeof latestSubmitted?.score === "number" ? latestSubmitted.score : null,
        quizTotal:
          assessment.type === "quiz" && Array.isArray(assessment.quizQuestions)
            ? assessment.quizQuestions.length
            : null,
      },
    });
  } catch (error) {
    console.error("Get recruiter assessment meta error:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching assessment meta",
      error: error.message,
    });
  }
};

module.exports = {
  startRecruiterAttempt,
  saveRecruiterAnswers,
  submitRecruiterAttempt,
  getRecruiterAssessmentMeta,
};


