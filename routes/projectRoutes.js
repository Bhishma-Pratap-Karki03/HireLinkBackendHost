// Project routes for candidate portfolio projects.
const express = require("express");
const router = express.Router();

const projectController = require("../controllers/projectController");
const { protect } = require("../middleware/authMiddleware");

// Shared upload helpers (image upload + validation).
const {
  createImageUpload,
  handleMulterError,
  checkFileValidation,
} = require("../utils/uploadConfig");

// Accept project cover image upload (max 5MB).
const upload = createImageUpload("projects", 5);

// Add a new project to logged-in user's profile.
// Supports optional cover image field: coverImage
router.post(
  "/",
  protect,
  upload.single("coverImage"),
  handleMulterError,
  checkFileValidation,
  projectController.addProject
);

// Update an existing project by projectId.
// Supports optional new cover image field: coverImage
router.put(
  "/:projectId",
  protect,
  upload.single("coverImage"),
  handleMulterError,
  checkFileValidation,
  projectController.updateProject
);

// Delete a project by projectId.
router.delete("/:projectId", protect, projectController.removeProject);

module.exports = router;
