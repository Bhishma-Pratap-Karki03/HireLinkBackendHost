// routes/profileRoutes.js - FIXED VERSION
const express = require("express");
const router = express.Router();
const { protect, optionalProtect } = require("../middleware/authMiddleware");
const profileController = require("../controllers/profileController");
const multer = require("multer");
const path = require("path");

// Create simple multer middleware inline
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadPath = path.join(
        __dirname,
        "..",
        "public",
        "uploads",
        "profiles",
        "temp"
      );
      cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, "profile-" + uniqueSuffix + ext);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(
      path.extname(file.originalname).toLowerCase()
    );
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  },
});

// Public routes
router.get("/user/:userId", optionalProtect, profileController.getUserProfile);

// Protected routes (require authentication)
router.get("/me", protect, profileController.getMyProfile);
router.put("/me", protect, profileController.updateProfile);
router.post(
  "/me/picture",
  protect,
  upload.single("profilePicture"),
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
