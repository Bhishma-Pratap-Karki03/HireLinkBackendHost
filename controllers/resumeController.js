// Resume Controller handles resume HTTP requests
// Uses Resume Service for business logic

const resumeService = require("../services/resumeService");
const path = require("path");
const fs = require("fs");

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

    // Find user to determine role-based folder
    const User = require("../models/userModel");
    const user = await User.findById(req.user.id);
    if (!user) {
      // Clean up temp file
      if (req.file.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(404).json({
        success: false,
        message: "User not found",
        code: "USER_NOT_FOUND",
      });
    }

    // Create role-based folder path
    const roleFolder = "CandidateResumes";
    const targetDir = path.join(
      __dirname,
      "..",
      "public",
      "uploads",
      "resumes",
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
    const resumeUrl = `/uploads/resumes/${roleFolder}/${req.file.filename}`;

    // Prepare file data for service
    const fileData = {
      file: req.file,
      tempPath,
      targetPath,
      resumeUrl,
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