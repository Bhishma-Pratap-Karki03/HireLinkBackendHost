// Resume Service handles resume-related business logic

const User = require("../models/userModel");
const path = require("path");
const fs = require("fs");
const { NotFoundError, ValidationError } = require("../utils/AppError");

class ResumeService {
  // Upload resume for a user
  async uploadResume(userId, fileData) {
    const { file, tempPath, targetPath, resumeUrl } = fileData;

    const user = await User.findById(userId);
    if (!user) {
      throw new NotFoundError("User");
    }

    // Only candidates can upload resumes
    if (user.role !== "candidate") {
      throw new ValidationError("Only candidates can upload resumes");
    }

    // Delete old resume if it exists
    if (user.resume && user.resume !== "") {
      const oldResumePath = path.join(
        __dirname,
        "..",
        "public",
        user.resume
      );
      if (fs.existsSync(oldResumePath) && oldResumePath !== targetPath) {
        try {
          fs.unlinkSync(oldResumePath);
        } catch (error) {
          console.error("Error deleting old resume:", error);
        }
      }
    }

    // Update user with new resume
    user.resume = resumeUrl;
    user.resumeFileName = file.originalname;
    user.resumeFileSize = file.size;
    await user.save();

    return {
      message: "Resume uploaded successfully",
      resume: resumeUrl,
      resumeFileName: file.originalname,
      resumeFileSize: file.size,
    };
  }

  // Remove resume from user profile
  async removeResume(userId) {
    const user = await User.findById(userId);
    if (!user) {
      throw new NotFoundError("User");
    }

    // Delete the resume file from server if it exists
    if (user.resume && user.resume !== "") {
      const resumePath = path.join(__dirname, "..", "public", user.resume);
      if (fs.existsSync(resumePath)) {
        try {
          fs.unlinkSync(resumePath);
        } catch (error) {
          console.error("Error deleting resume file:", error);
        }
      }
    }

    // Clear resume fields
    user.resume = "";
    user.resumeFileName = "";
    user.resumeFileSize = 0;
    await user.save();

    return {
      message: "Resume removed successfully",
    };
  }

  // Get resume information for a user
  async getResumeInfo(userId) {
    const user = await User.findById(userId).select(
      "resume resumeFileName resumeFileSize"
    );

    if (!user) {
      throw new NotFoundError("User");
    }

    return {
      resume: user.resume || "",
      resumeFileName: user.resumeFileName || "",
      resumeFileSize: user.resumeFileSize || 0,
    };
  }
}

module.exports = new ResumeService();

