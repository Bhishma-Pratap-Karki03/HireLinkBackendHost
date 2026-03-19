// workspaceRoutes.js - Routes for workplace gallery

const express = require("express");
const router = express.Router();

// Import controller
const workspaceController = require("../controllers/workspaceController");
const { protect } = require("../middleware/authMiddleware");

// Import shared upload utilities
const {
  createImageUpload,
  handleMulterError,
  checkFileValidation,
} = require("../utils/uploadConfig");

// Configure multer for workspace image uploads
const upload = createImageUpload("workspace", 6);

// Protected routes
// POST /api/workspace/upload - Upload workspace image
router.post(
  "/upload",
  protect,
  upload.single("workspaceImage"),
  handleMulterError,
  checkFileValidation,
  workspaceController.uploadWorkspaceImage
);

// GET /api/workspace/images - Get all workspace images
router.get("/images", protect, workspaceController.getWorkspaceImages);

// DELETE /api/workspace/image/:imageId - Delete workspace image
router.delete(
  "/image/:imageId",
  protect,
  workspaceController.deleteWorkspaceImage
);

// PUT /api/workspace/reorder - Reorder workspace images
router.put("/reorder", protect, workspaceController.reorderWorkspaceImages);

module.exports = router;
