// Project Controller handles project HTTP requests
// Uses Project Service for business logic

const projectService = require("../services/projectService");
const fs = require("fs");
const {
  uploadFileToCloudinary,
  extractPublicIdFromCloudinaryUrl,
} = require("../utils/cloudinary");

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
      removeCoverImage,
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
      removeCoverImage,
    };

    let fileData = null;

    // Handle cover image if uploaded
    if (req.file) {
      if (!fs.existsSync(req.file.path)) {
        return res.status(500).json({
          success: false,
          message: "Uploaded file not found",
          code: "FILE_NOT_FOUND",
        });
      }

      const uploaded = await uploadFileToCloudinary(req.file.path, {
        folder: "hirelink/projects/candidate-covers",
        resource_type: "image",
        use_filename: true,
        unique_filename: true,
      });

      tempFileCleaned = true;
      fs.unlinkSync(req.file.path);

      const coverImageUrl = uploaded.secure_url;
      const coverImagePublicId =
        uploaded.public_id || extractPublicIdFromCloudinaryUrl(uploaded.secure_url);

      fileData = {
        coverImageUrl,
        coverImagePublicId,
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
      if (!fs.existsSync(req.file.path)) {
        return res.status(500).json({
          success: false,
          message: "Uploaded file not found",
          code: "FILE_NOT_FOUND",
        });
      }

      const uploaded = await uploadFileToCloudinary(req.file.path, {
        folder: "hirelink/projects/candidate-covers",
        resource_type: "image",
        use_filename: true,
        unique_filename: true,
      });

      tempFileCleaned = true;
      fs.unlinkSync(req.file.path);

      const coverImageUrl = uploaded.secure_url;
      const coverImagePublicId =
        uploaded.public_id || extractPublicIdFromCloudinaryUrl(uploaded.secure_url);

      fileData = {
        coverImageUrl,
        coverImagePublicId,
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
