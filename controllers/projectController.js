// Project Controller handles project HTTP requests
// Uses Project Service for business logic

const projectService = require("../services/projectService");
const path = require("path");
const fs = require("fs");

// Add project to user profile
exports.addProject = async (req, res, next) => {
  let tempFileCleaned = false;

  try {
    const {
      projectTitle,
      projectDescription,
      startDate,
      endDate,
      isOngoing,
      projectUrl,
      technologies,
    } = req.body;

    // Prepare project data
    const projectData = {
      projectTitle,
      projectDescription,
      startDate,
      endDate,
      isOngoing,
      projectUrl,
      technologies,
    };

    let fileData = null;

    // Handle cover image if uploaded
    if (req.file) {
      // Move file from temp to project images folder
      const roleFolder = "CandidateProjects";
      const targetDir = path.join(
        __dirname,
        "..",
        "public",
        "uploads",
        "projects",
        roleFolder
      );

      // Create role folder if it doesn't exist
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      // Move file from temp to role folder
      const tempPath = req.file.path;
      const targetPath = path.join(targetDir, req.file.filename);

      if (!fs.existsSync(tempPath)) {
        return res.status(500).json({
          success: false,
          message: "Uploaded file not found",
          code: "FILE_NOT_FOUND",
        });
      }

      // Move the file
      fs.renameSync(tempPath, targetPath);
      tempFileCleaned = true;

      // Create relative URL
      const coverImageUrl = `/uploads/projects/${roleFolder}/${req.file.filename}`;

      fileData = {
        coverImageUrl,
        fileName: req.file.originalname,
        fileSize: req.file.size,
      };
    }

    // Call service to handle business logic
    const result = await projectService.addProject(
      req.user.id,
      projectData,
      fileData
    );

    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    // Clean up uploaded file if error occurs
    if (req.file && req.file.path && !tempFileCleaned) {
      try {
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
      } catch (cleanupError) {
        console.error("Error cleaning up file:", cleanupError);
      }
    }

    next(error);
  }
};

// Update project in user profile
exports.updateProject = async (req, res, next) => {
  let tempFileCleaned = false;

  try {
    const {
      projectTitle,
      projectDescription,
      startDate,
      endDate,
      isOngoing,
      projectUrl,
      technologies,
    } = req.body;

    // Prepare project data
    const projectData = {
      projectTitle,
      projectDescription,
      startDate,
      endDate,
      isOngoing,
      projectUrl,
      technologies,
    };

    let fileData = null;

    // Handle cover image update if new file is uploaded
    if (req.file) {
      // Move new file from temp to project images folder
      const roleFolder = "CandidateProjects";
      const targetDir = path.join(
        __dirname,
        "..",
        "public",
        "uploads",
        "projects",
        roleFolder
      );

      // Create role folder if it doesn't exist
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      // Move file from temp to role folder
      const tempPath = req.file.path;
      const targetPath = path.join(targetDir, req.file.filename);

      if (!fs.existsSync(tempPath)) {
        return res.status(500).json({
          success: false,
          message: "Uploaded file not found",
          code: "FILE_NOT_FOUND",
        });
      }

      // Move the file
      fs.renameSync(tempPath, targetPath);
      tempFileCleaned = true;

      // Create relative URL
      const coverImageUrl = `/uploads/projects/${roleFolder}/${req.file.filename}`;

      fileData = {
        coverImageUrl,
        fileName: req.file.originalname,
        fileSize: req.file.size,
      };
    }

    // Call service to handle business logic
    const result = await projectService.updateProject(
      req.user.id,
      req.params.projectId,
      projectData,
      fileData
    );

    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    // Clean up uploaded file if error occurs
    if (req.file && req.file.path && !tempFileCleaned) {
      try {
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
      } catch (cleanupError) {
        console.error("Error cleaning up file:", cleanupError);
      }
    }

    next(error);
  }
};

// Remove project from user profile
exports.removeProject = async (req, res, next) => {
  try {
    const result = await projectService.removeProject(
      req.user.id,
      req.params.projectId
    );

    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};
