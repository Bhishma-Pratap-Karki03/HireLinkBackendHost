const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const {
  submissionUpload,
  handleSubmissionUploadError,
} = require("../middleware/assessmentSubmissionUpload");
const recruiterAssessmentController = require("../controllers/recruiterAssessmentController");
const recruiterAssessmentAttemptController = require("../controllers/recruiterAssessmentAttemptController");

const router = express.Router();

// Recruiter creates a new assessment.
router.post("/", protect, recruiterAssessmentController.createRecruiterAssessment);

// Get one recruiter assessment by id.
router.get("/:id", recruiterAssessmentController.getRecruiterAssessmentById);

// Recruiter updates own assessment by id.
router.put("/:id", protect, recruiterAssessmentController.updateRecruiterAssessment);

// Candidate gets attempt meta for this assessment.
router.get(
  "/:id/meta",
  protect,
  recruiterAssessmentAttemptController.getRecruiterAssessmentMeta,
);

// Candidate starts an attempt.
router.post(
  "/:id/attempts/start",
  protect,
  recruiterAssessmentAttemptController.startRecruiterAttempt,
);

// Candidate saves draft answers (supports code file upload with key `codeFile`).
router.post(
  "/:id/attempts/:attemptId/answers",
  protect,
  submissionUpload.single("codeFile"),
  handleSubmissionUploadError,
  recruiterAssessmentAttemptController.saveRecruiterAnswers,
);

// Candidate submits final attempt.
router.post(
  "/:id/attempts/:attemptId/submit",
  protect,
  submissionUpload.single("codeFile"),
  handleSubmissionUploadError,
  recruiterAssessmentAttemptController.submitRecruiterAttempt,
);

module.exports = router;
