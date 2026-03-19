// employerRoutes.js
const express = require("express");
const router = express.Router();
const employerController = require("../controllers/employerController");
const { optionalProtect } = require("../middleware/authMiddleware");

// Public routes for employers page
router.get("/", employerController.getAllRecruiters);
router.get("/:id", optionalProtect, employerController.getRecruiterById);

module.exports = router;
