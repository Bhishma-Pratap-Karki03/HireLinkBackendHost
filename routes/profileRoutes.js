// routes/profileRoutes.js - FIXED VERSION
const express = require("express");
const router = express.Router();
const { protect, optionalProtect } = require("../middleware/authMiddleware");
const profileController = require("../controllers/profileController");
const {
  createImageUpload,
  handleMulterError,
  checkFileValidation,
} = require("../utils/uploadConfig");

const upload = createImageUpload("profiles", 5);

// Public routes
router.get("/user/:userId", optionalProtect, profileController.getUserProfile);

// Protected routes (require authentication)
router.get("/me", protect, profileController.getMyProfile);
router.put("/me", protect, profileController.updateProfile);
router.post(
  "/me/picture",
  protect,
  upload.single("profilePicture"),
  handleMulterError,
  checkFileValidation,
  profileController.uploadProfilePicture
);
router.delete("/me/picture", protect, profileController.removeProfilePicture);

// Experience routes
router.post("/me/experience", protect, profileController.addExperience);
router.put(
  "/me/experience/:experienceId",
  protect,
  profileController.updateExperience
);
router.delete(
  "/me/experience/:experienceId",
  protect,
  profileController.removeExperience
);

// Education routes
router.post("/me/education", protect, profileController.addEducation);
router.put(
  "/me/education/:educationId",
  protect,
  profileController.updateEducation
);
router.delete(
  "/me/education/:educationId",
  protect,
  profileController.removeEducation
);

// Skill routes
router.post("/me/skills", protect, profileController.addSkill);
router.put("/me/skills/:skillId", protect, profileController.updateSkill);
router.delete("/me/skills/:skillId", protect, profileController.removeSkill);

// Language routes
router.post("/me/languages", protect, profileController.addLanguage);
router.put(
  "/me/languages/:languageId",
  protect,
  profileController.updateLanguage
);
router.delete(
  "/me/languages/:languageId",
  protect,
  profileController.removeLanguage
);

// Certification routes
router.post("/me/certifications", protect, profileController.addCertification);
router.put(
  "/me/certifications/:certificationId",
  protect,
  profileController.updateCertification
);
router.delete(
  "/me/certifications/:certificationId",
  protect,
  profileController.removeCertification
);

module.exports = router;
