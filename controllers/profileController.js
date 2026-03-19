// Profile Controller handles user profile HTTP requests

const profileService = require("../services/profileService");
const User = require("../models/userModel");
const path = require("path");
const fs = require("fs");

// Get current user's profile
exports.getMyProfile = async (req, res) => {
  try {
    // Call the profile service to get user profile
    const result = await profileService.getMyProfile(req.user.id);

    // Return success response with user data
    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Get profile error:", error);

    // Handle any unexpected errors
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// Update user's profile information
exports.updateProfile = async (req, res) => {
  try {
    // Call the profile service to update user profile
    const result = await profileService.updateProfile(req.user.id, req.body);

    // Return success response
    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Update profile error:", error);

    // Handle phone number validation error
    if (error.message.includes("valid phone number")) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    // Handle founded year validation error
    if (error.message.includes("valid founded year")) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    if (error.message.includes("visibility must be public or private")) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    // Handle any other unexpected errors
    res.status(500).json({
      success: false,
      message: "Server error updating profile",
      error: error.message,
    });
  }
};

// Upload profile picture
exports.uploadProfilePicture = async (req, res) => {
  let tempFileCleaned = false;

  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
    }

    console.log(
      "Uploading file:",
      req.file.filename,
      "from temp:",
      req.file.path
    );

    // Find user to determine role
    const user = await User.findById(req.user.id);
    if (!user) {
      // Delete temporary file
      const tempPath = req.file.path;
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
        tempFileCleaned = true;
        console.log("Deleted temp file after user not found");
      }

      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Create role-based folder path
    const roleFolder =
      user.role === "recruiter" ? "RecruiterProfiles" : "CandidateProfiles";
    const targetDir = path.join(
      __dirname,
      "..",
      "public",
      "uploads",
      "profiles",
      roleFolder
    );

    // Create role folder if it doesn't exist
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
      console.log("Created directory:", targetDir);
    }

    // Move file from temp to role folder
    const tempPath = req.file.path;
    const targetPath = path.join(targetDir, req.file.filename);

    // Check if temp file exists
    if (!fs.existsSync(tempPath)) {
      console.error("Temp file does not exist:", tempPath);
      return res.status(500).json({
        success: false,
        message: "Uploaded file not found",
      });
    }

    // Move the file
    fs.renameSync(tempPath, targetPath);
    tempFileCleaned = true;
    console.log("File moved from temp to:", targetPath);

    // Create relative URL
    const profilePictureUrl = `/uploads/profiles/${roleFolder}/${req.file.filename}`;

    // Delete old profile picture if it exists and is not default
    if (user.profilePicture && user.profilePicture !== "") {
      const oldImagePath = path.join(
        __dirname,
        "..",
        "public",
        user.profilePicture
      );
      if (fs.existsSync(oldImagePath) && oldImagePath !== targetPath) {
        fs.unlinkSync(oldImagePath);
        console.log("Deleted old profile picture:", oldImagePath);
      }
    }

    // Update user with new profile picture
    user.profilePicture = profilePictureUrl;
    await user.save();

    // Get updated user data without sensitive information
    const updatedUser = await User.findById(user._id).select(
      "-password -verificationCode -resetCode"
    );

    console.log("Profile picture uploaded successfully:", profilePictureUrl);

    res.status(200).json({
      success: true,
      message: "Profile picture uploaded successfully",
      profilePicture: profilePictureUrl,
      user: updatedUser,
    });
  } catch (error) {
    console.error("Upload profile picture error:", error);

    // Clean up temp file if it exists and wasn't already cleaned
    if (req.file && req.file.path && !tempFileCleaned) {
      try {
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
          console.log("Cleaned up temp file after error:", req.file.path);
        }
      } catch (cleanupError) {
        console.error("Error cleaning up temp file:", cleanupError);
      }
    }

    res.status(500).json({
      success: false,
      message: "Server error uploading profile picture",
      error: error.message,
    });
  }
};

// Remove profile picture
exports.removeProfilePicture = async (req, res) => {
  try {
    // Call the profile service to remove profile picture
    const result = await profileService.removeProfilePicture(req.user.id);

    // Return success response
    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Remove profile picture error:", error);

    // Handle any unexpected errors
    res.status(500).json({
      success: false,
      message: "Server error removing profile picture",
      error: error.message,
    });
  }
};

// Get public profile of any user
exports.getUserProfile = async (req, res) => {
  try {
    // Call the profile service to get public user profile
    const viewerId = req.user?.id || null;
    const result = await profileService.getUserProfile(req.params.userId, viewerId);

    // Return success response
    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Get user profile error:", error);

    if (error.statusCode === 404 || error.message === "User not found") {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (error.statusCode === 403) {
      return res.status(403).json({
        success: false,
        message: error.message,
      });
    }

    // Handle any unexpected errors
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// Add experience to user profile
exports.addExperience = async (req, res) => {
  try {
    // Call the profile service to add experience
    const result = await profileService.addExperience(req.user.id, req.body);

    // Return success response
    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Add experience error:", error);

    // Handle validation errors
    if (
      error.message.includes("required") ||
      error.message.includes("valid") ||
      error.message.includes("Invalid")
    ) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    // Handle any unexpected errors
    res.status(500).json({
      success: false,
      message: "Server error adding experience",
      error: error.message,
    });
  }
};

// Update experience in user profile
exports.updateExperience = async (req, res) => {
  try {
    // Call the profile service to update experience
    const result = await profileService.updateExperience(
      req.user.id,
      req.params.experienceId,
      req.body
    );

    // Return success response
    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Update experience error:", error);

    // Handle validation errors
    if (
      error.message.includes("required") ||
      error.message.includes("valid") ||
      error.message.includes("Invalid")
    ) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    // Handle experience not found error
    if (error.message.includes("not found")) {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    // Handle any unexpected errors
    res.status(500).json({
      success: false,
      message: "Server error updating experience",
      error: error.message,
    });
  }
};

// Remove experience from user profile
exports.removeExperience = async (req, res) => {
  try {
    // Call the profile service to remove experience
    const result = await profileService.removeExperience(
      req.user.id,
      req.params.experienceId
    );

    // Return success response
    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Remove experience error:", error);

    // Handle experience not found error
    if (error.message.includes("not found")) {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    // Handle any unexpected errors
    res.status(500).json({
      success: false,
      message: "Server error removing experience",
      error: error.message,
    });
  }
};

// profileController.js - Add education methods

// Add education to user profile
exports.addEducation = async (req, res) => {
  try {
    // Call the profile service to add education
    const result = await profileService.addEducation(req.user.id, req.body);

    // Return success response
    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Add education error:", error);

    // Handle validation errors
    if (
      error.message.includes("required") ||
      error.message.includes("valid") ||
      error.message.includes("Invalid")
    ) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    // Handle any unexpected errors
    res.status(500).json({
      success: false,
      message: "Server error adding education",
      error: error.message,
    });
  }
};

// Update education in user profile
exports.updateEducation = async (req, res) => {
  try {
    // Call the profile service to update education
    const result = await profileService.updateEducation(
      req.user.id,
      req.params.educationId,
      req.body
    );

    // Return success response
    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Update education error:", error);

    // Handle validation errors
    if (
      error.message.includes("required") ||
      error.message.includes("valid") ||
      error.message.includes("Invalid")
    ) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    // Handle education not found error
    if (error.message.includes("not found")) {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    // Handle any unexpected errors
    res.status(500).json({
      success: false,
      message: "Server error updating education",
      error: error.message,
    });
  }
};

// Remove education from user profile
exports.removeEducation = async (req, res) => {
  try {
    // Call the profile service to remove education
    const result = await profileService.removeEducation(
      req.user.id,
      req.params.educationId
    );

    // Return success response
    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Remove education error:", error);

    // Handle education not found error
    if (error.message.includes("not found")) {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    // Handle any unexpected errors
    res.status(500).json({
      success: false,
      message: "Server error removing education",
      error: error.message,
    });
  }
};

// profileController.js - Add skill controller methods

// Add skill to user profile
exports.addSkill = async (req, res) => {
  try {
    // Call the profile service to add skill
    const result = await profileService.addSkill(req.user.id, req.body);

    // Return success response
    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Add skill error:", error);

    // Handle validation errors
    if (
      error.message.includes("required") ||
      error.message.includes("valid") ||
      error.message.includes("Invalid")
    ) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    // Handle any unexpected errors
    res.status(500).json({
      success: false,
      message: "Server error adding skill",
      error: error.message,
    });
  }
};

// Update skill in user profile
exports.updateSkill = async (req, res) => {
  try {
    // Call the profile service to update skill
    const result = await profileService.updateSkill(
      req.user.id,
      req.params.skillId,
      req.body
    );

    // Return success response
    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Update skill error:", error);

    // Handle validation errors
    if (
      error.message.includes("required") ||
      error.message.includes("valid") ||
      error.message.includes("Invalid")
    ) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    // Handle skill not found error
    if (error.message.includes("not found")) {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    // Handle any unexpected errors
    res.status(500).json({
      success: false,
      message: "Server error updating skill",
      error: error.message,
    });
  }
};

// Remove skill from user profile
exports.removeSkill = async (req, res) => {
  try {
    // Call the profile service to remove skill
    const result = await profileService.removeSkill(
      req.user.id,
      req.params.skillId
    );

    // Return success response
    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Remove skill error:", error);

    // Handle skill not found error
    if (error.message.includes("not found")) {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    // Handle any unexpected errors
    res.status(500).json({
      success: false,
      message: "Server error removing skill",
      error: error.message,
    });
  }
};
// Add language to user profile
exports.addLanguage = async (req, res) => {
  try {
    // Call the profile service to add language
    const result = await profileService.addLanguage(req.user.id, req.body);

    // Return success response
    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Add language error:", error);

    // Handle validation errors
    if (
      error.message.includes("required") ||
      error.message.includes("valid") ||
      error.message.includes("Invalid")
    ) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    // Handle any unexpected errors
    res.status(500).json({
      success: false,
      message: "Server error adding language",
      error: error.message,
    });
  }
};

// Update language in user profile
exports.updateLanguage = async (req, res) => {
  try {
    // Call the profile service to update language
    const result = await profileService.updateLanguage(
      req.user.id,
      req.params.languageId,
      req.body
    );

    // Return success response
    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Update language error:", error);

    // Handle validation errors
    if (
      error.message.includes("required") ||
      error.message.includes("valid") ||
      error.message.includes("Invalid")
    ) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    // Handle language not found error
    if (error.message.includes("not found")) {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    // Handle any unexpected errors
    res.status(500).json({
      success: false,
      message: "Server error updating language",
      error: error.message,
    });
  }
};

// Remove language from user profile
exports.removeLanguage = async (req, res) => {
  try {
    // Call the profile service to remove language
    const result = await profileService.removeLanguage(
      req.user.id,
      req.params.languageId
    );

    // Return success response
    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Remove language error:", error);

    // Handle language not found error
    if (error.message.includes("not found")) {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    // Handle any unexpected errors
    res.status(500).json({
      success: false,
      message: "Server error removing language",
      error: error.message,
    });
  }
};
exports.addCertification = async (req, res) => {
  try {
    // Call the profile service to add certification
    const result = await profileService.addCertification(req.user.id, req.body);

    // Return success response
    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Add certification error:", error);

    // Handle validation errors
    if (
      error.message.includes("required") ||
      error.message.includes("valid") ||
      error.message.includes("Invalid")
    ) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    // Handle any unexpected errors
    res.status(500).json({
      success: false,
      message: "Server error adding certification",
      error: error.message,
    });
  }
};

// Update certification in user profile
exports.updateCertification = async (req, res) => {
  try {
    // Call the profile service to update certification
    const result = await profileService.updateCertification(
      req.user.id,
      req.params.certificationId,
      req.body
    );

    // Return success response
    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Update certification error:", error);

    // Handle validation errors
    if (
      error.message.includes("required") ||
      error.message.includes("valid") ||
      error.message.includes("Invalid")
    ) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    // Handle certification not found error
    if (error.message.includes("not found")) {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    // Handle any unexpected errors
    res.status(500).json({
      success: false,
      message: "Server error updating certification",
      error: error.message,
    });
  }
};

// Remove certification from user profile
exports.removeCertification = async (req, res) => {
  try {
    // Call the profile service to remove certification
    const result = await profileService.removeCertification(
      req.user.id,
      req.params.certificationId
    );

    // Return success response
    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Remove certification error:", error);

    // Handle certification not found error
    if (error.message.includes("not found")) {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    // Handle any unexpected errors
    res.status(500).json({
      success: false,
      message: "Server error removing certification",
      error: error.message,
    });
  }
};
