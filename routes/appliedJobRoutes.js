const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const { createDirectDocumentUpload, handleMulterError, checkFileValidation } = require("../utils/uploadConfig");
const appliedJobController = require("../controllers/appliedJobController");

const router = express.Router();
const upload = createDirectDocumentUpload("appliedresume", 5);

router.get("/status/:jobId", protect, appliedJobController.checkApplied);
router.get("/mine", protect, appliedJobController.getMyApplications);
router.get("/job/:jobId", protect, appliedJobController.getApplicationsByJob);
router.get(
  "/:applicationId/assessment",
  protect,
  appliedJobController.getApplicationAssessmentById
);
router.patch(
  "/:applicationId/status",
  protect,
  appliedJobController.updateApplicationStatus
);

router.post(
  "/apply",
  protect,
  upload.single("resume"),
  handleMulterError,
  checkFileValidation,
  appliedJobController.applyToJob
);

module.exports = router;
