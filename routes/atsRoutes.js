const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const {
  scanJobApplications,
  getAtsResultsByJob,
  getAtsRunHistoryByJob,
} = require("../controllers/atsController");

const router = express.Router();

router.post("/scan/:jobId", protect, scanJobApplications);
router.get("/results/:jobId", protect, getAtsResultsByJob);
router.get("/history/:jobId", protect, getAtsRunHistoryByJob);

module.exports = router;
