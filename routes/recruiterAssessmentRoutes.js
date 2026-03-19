const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const {
  submissionUpload,
  handleSubmissionUploadError,
} = require("../middleware/assessmentSubmissionUpload");
const recruiterAssessmentController = require("../controllers/recruiterAssessmentController");
const recruiterAssessmentAttemptController = require("../controllers/recruiterAssessmentAttemptController");

const router = express.Router();

router.post("/", protect, recruiterAssessmentController.createRecruiterAssessment);
router.get("/:id", recruiterAssessmentController.getRecruiterAssessmentById);
router.put("/:id", protect, recruiterAssessmentController.updateRecruiterAssessment);
router.get(
  "/:id/meta",
  protect,
  recruiterAssessmentAttemptController.getRecruiterAssessmentMeta,
);
router.post(
  "/:id/attempts/start",
  protect,
  recruiterAssessmentAttemptController.startRecruiterAttempt,
);
router.post(
  "/:id/attempts/:attemptId/answers",
  protect,
  submissionUpload.single("codeFile"),
  handleSubmissionUploadError,
  recruiterAssessmentAttemptController.saveRecruiterAnswers,
);
router.post(
  "/:id/attempts/:attemptId/submit",
  protect,
  submissionUpload.single("codeFile"),
  handleSubmissionUploadError,
  recruiterAssessmentAttemptController.submitRecruiterAttempt,
);

module.exports = router;
