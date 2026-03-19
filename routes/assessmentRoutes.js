const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const {
  submissionUpload,
  handleSubmissionUploadError,
} = require("../middleware/assessmentSubmissionUpload");
const adminAssessmentController = require("../controllers/adminAssessmentController");
const assessmentAttemptController = require("../controllers/assessmentAttemptController");

router.get("/", adminAssessmentController.listAssessments);
router.get("/mine", protect, adminAssessmentController.listAssessments);
router.get(
  "/admin/attempts",
  protect,
  adminAssessmentController.listAssessmentAttempts,
);
router.get(
  "/admin/attempts/:attemptId",
  protect,
  adminAssessmentController.getAssessmentAttemptDetail,
);
router.delete(
  "/admin/attempts/:attemptId",
  protect,
  adminAssessmentController.dismissAssessmentAttempt,
);
router.get("/available", protect, assessmentAttemptController.listAvailableAssessments);
router.get(
  "/my-submissions",
  protect,
  assessmentAttemptController.getMySubmissionHistory,
);
router.get(
  "/my-showcase",
  protect,
  assessmentAttemptController.getMyShowcaseSubmissions,
);
router.put(
  "/my-showcase",
  protect,
  assessmentAttemptController.updateMyShowcaseSubmissions,
);
router.get(
  "/candidate/:candidateId/showcase",
  protect,
  assessmentAttemptController.getCandidateShowcaseSubmissions,
);
router.get(
  "/candidate/:candidateId/attempts/:attemptId",
  protect,
  assessmentAttemptController.getCandidateSubmissionDetail,
);
router.get("/attempts/:attemptId", protect, assessmentAttemptController.getAttempt);
router.get("/:id", adminAssessmentController.getAssessmentById);
router.post(
  "/:id/attempts/start",
  protect,
  assessmentAttemptController.startAttempt,
);
router.post(
  "/:id/attempts/:attemptId/answers",
  protect,
  submissionUpload.single("codeFile"),
  handleSubmissionUploadError,
  assessmentAttemptController.saveAnswers,
);
router.post(
  "/:id/attempts/:attemptId/submit",
  protect,
  submissionUpload.single("codeFile"),
  handleSubmissionUploadError,
  assessmentAttemptController.submitAttempt,
);
router.post("/", protect, adminAssessmentController.createAssessment);
router.put("/:id", protect, adminAssessmentController.updateAssessment);
router.patch("/:id/status", protect, adminAssessmentController.toggleAssessmentStatus);
router.delete("/:id", protect, adminAssessmentController.deleteAssessment);

module.exports = router;
