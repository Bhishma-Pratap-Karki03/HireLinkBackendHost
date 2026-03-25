// Resume routes for candidate resume upload/manage.
const express = require("express");
const router = express.Router();

const resumeController = require("../controllers/resumeController");
const { protect } = require("../middleware/authMiddleware");

// Shared upload helpers (document upload + validation).
const {
  createDocumentUpload,
  handleMulterError,
  checkFileValidation,
} = require("../utils/uploadConfig");

// Accept resume document upload (max 5MB).
const upload = createDocumentUpload("resumes", 5);

// Upload/replace resume for logged-in candidate. Field name: resume
router.post(
  "/upload",
  protect,
  upload.single("resume"),
  handleMulterError,
  checkFileValidation,
  resumeController.uploadResume
);

// Remove current resume from profile.
router.delete("/remove", protect, resumeController.removeResume);

// Get current resume metadata.
router.get("/info", protect, resumeController.getResumeInfo);

module.exports = router;
