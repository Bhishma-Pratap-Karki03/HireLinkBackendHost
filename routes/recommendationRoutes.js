const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const recommendationController = require("../controllers/recommendationController");

const router = express.Router();

router.get("/me", protect, recommendationController.getMyRecommendations);
router.get("/history", protect, recommendationController.getRecommendationHistory);
router.get(
  "/history/:id",
  protect,
  recommendationController.getRecommendationHistoryById,
);
router.delete(
  "/history/:id",
  protect,
  recommendationController.deleteRecommendationHistory,
);

module.exports = router;
