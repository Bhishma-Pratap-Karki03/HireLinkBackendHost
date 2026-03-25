const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const recommendationController = require("../controllers/recommendationController");

const router = express.Router();

// Generate fresh AI job recommendations for the logged-in candidate.
router.get("/me", protect, recommendationController.getMyRecommendations);

// Get recommendation history list for logged-in candidate.
router.get("/history", protect, recommendationController.getRecommendationHistory);

// Get one recommendation history detail by id.
router.get(
  "/history/:id",
  protect,
  recommendationController.getRecommendationHistoryById,
);

// Delete one recommendation history record by id.
router.delete(
  "/history/:id",
  protect,
  recommendationController.deleteRecommendationHistory,
);

module.exports = router;
