// projectRoutes.js
const express = require("express");
const router = express.Router();

// Import the project controller
const projectController = require("../controllers/projectController");
const { protect } = require("../middleware/authMiddleware");

// Import shared upload utilities
const {
  createImageUpload,
  handleMulterError,
  checkFileValidation,
} = require("../utils/uploadConfig");

// Configure multer for file uploads (project cover images)
const upload = createImageUpload("projects", 5);

// Project management routes
// POST /api/project - Add new project
router.post(
  "/",
  protect,
  upload.single("coverImage"),
  handleMulterError,
  checkFileValidation,
  projectController.addProject
);

// PUT /api/project/:projectId - Update project
router.put(
  "/:projectId",
  protect,
  upload.single("coverImage"),
  handleMulterError,
  checkFileValidation,
  projectController.updateProject
);

// DELETE /api/project/:projectId - Remove project
router.delete("/:projectId", protect, projectController.removeProject);

module.exports = router;
