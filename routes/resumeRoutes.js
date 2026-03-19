// resumeRoutes.js
const express = require("express");
const router = express.Router();

const resumeController = require("../controllers/resumeController");
const { protect } = require("../middleware/authMiddleware");

// Import shared upload utilities
const {
  createDocumentUpload,
  handleMulterError,
  checkFileValidation,
} = require("../utils/uploadConfig");

// Configure multer for resume uploads
const upload = createDocumentUpload("resumes", 5);

// Protected routes
// POST /api/resume/upload - Upload resume
router.post(
  "/upload",
  protect,
  upload.single("resume"),
  handleMulterError,
  checkFileValidation,
  resumeController.uploadResume
);

// DELETE /api/resume/remove - Remove resume
router.delete("/remove", protect, resumeController.removeResume);

// GET /api/resume/info - Get resume info
router.get("/info", protect, resumeController.getResumeInfo);

module.exports = router;
