// Resume Controller handles resume HTTP requests
// Uses Resume Service for business logic

const resumeService = require("../services/resumeService");
const fs = require("fs");
const {
  uploadFileToCloudinary,
  extractPublicIdFromCloudinaryUrl,
} = require("../utils/cloudinary");

// Upload resume
exports.uploadResume = async (req, res, next) => {
  let tempFileCleaned = false;

  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
        code: "NO_FILE",
      });
    }

    const User = require("../models/userModel");
    const user = await User.findById(req.user.id);
    if (!user) {
      if (req.file.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(404).json({
        success: false,
        message: "User not found",
        code: "USER_NOT_FOUND",
      });
    }

    if (!fs.existsSync(req.file.path)) {
      return res.status(500).json({
        success: false,
        message: "Uploaded file not found",
        code: "FILE_NOT_FOUND",
      });
    }

    const uploaded = await uploadFileToCloudinary(req.file.path, {
      folder: "hirelink/resumes/candidates",
      resource_type: "auto",
      use_filename: true,
      unique_filename: true,
    });

    tempFileCleaned = true;
    fs.unlinkSync(req.file.path);

    const resumeUrl = uploaded.secure_url;
    const resumePublicId =
      uploaded.public_id || extractPublicIdFromCloudinaryUrl(uploaded.secure_url);

    const fileData = {
      file: req.file,
      resumeUrl,
      resumePublicId,
    };

    // Call service to handle business logic
    const result = await resumeService.uploadResume(req.user.id, fileData);

    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    // Clean up temp file if it exists and wasn't already cleaned
    if (req.file && req.file.path && !tempFileCleaned) {
      try {
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
      } catch (cleanupError) {
        console.error("Error cleaning up temp file:", cleanupError);
      }
    }

    next(error);
  }
};

// Remove resume
exports.removeResume = async (req, res, next) => {
  try {
    const result = await resumeService.removeResume(req.user.id);

    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

// Get resume info
exports.getResumeInfo = async (req, res, next) => {
  try {
    const result = await resumeService.getResumeInfo(req.user.id);

    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};
