const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const savedJobController = require("../controllers/savedJobController");

const router = express.Router();

// Check whether a specific job is saved by current candidate.
router.get("/status/:jobId", protect, savedJobController.checkSaved);

// Get all jobs saved by current candidate.
router.get("/mine", protect, savedJobController.listSaved);

// Toggle save/unsave for a job.
router.post("/toggle", protect, savedJobController.toggleSaveJob);

module.exports = router;
