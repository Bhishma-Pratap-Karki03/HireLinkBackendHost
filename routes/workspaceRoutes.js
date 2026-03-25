// Workspace routes for recruiter workplace gallery images.

const express = require("express");
const router = express.Router();

const workspaceController = require("../controllers/workspaceController");
const { protect } = require("../middleware/authMiddleware");

// Shared upload helpers (validation + multer error handling).
const {
  createImageUpload,
  handleMulterError,
  checkFileValidation,
} = require("../utils/uploadConfig");

// Accept workspace image upload (max 6MB).
const upload = createImageUpload("workspace", 6);

// Upload one workspace image. Form-data field name: workspaceImage
router.post(
  "/upload",
  protect,
  upload.single("workspaceImage"),
  handleMulterError,
  checkFileValidation,
  workspaceController.uploadWorkspaceImage
);

// Get all workspace images for logged-in recruiter.
router.get("/images", protect, workspaceController.getWorkspaceImages);

// Delete one workspace image by imageId.
router.delete(
  "/image/:imageId",
  protect,
  workspaceController.deleteWorkspaceImage
);

// Update workspace image order.
router.put("/reorder", protect, workspaceController.reorderWorkspaceImages);

module.exports = router;
