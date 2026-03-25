// Review routes for company reviews and project reviews.
const express = require("express");
const router = express.Router();
const { protect, optionalProtect } = require("../middleware/authMiddleware");
const reviewController = require("../controllers/reviewController");

// Public: get company reviews.
router.get("/company/:companyId", reviewController.getCompanyReviews);

// Public/optional auth: get project reviews list.
router.get(
  "/project/:candidateId/:projectId",
  optionalProtect,
  reviewController.getProjectReviews,
);

// Candidate (owner): manage reviews received on own project.
router.get(
  "/project/:candidateId/:projectId/manage",
  protect,
  reviewController.getProjectReviewsForCandidate,
);

// Authenticated user: submit company review.
router.post("/company/:companyId", protect, reviewController.submitReview);

// Authenticated user: get own company review.
router.get(
  "/company/:companyId/my-review",
  protect,
  reviewController.getMyReview,
);

// Authenticated user: submit review on candidate project.
router.post(
  "/project/:candidateId/:projectId",
  protect,
  reviewController.submitProjectReview,
);

// Authenticated user: get own project review.
router.get(
  "/project/:candidateId/:projectId/my-review",
  protect,
  reviewController.getMyProjectReview,
);

// Authenticated user: update own review.
router.put("/:reviewId", protect, reviewController.updateReview);

// Authenticated user: delete own review.
router.delete("/:reviewId", protect, reviewController.deleteReview);

// Recruiter: manage reviews on their company profile.
router.get(
  "/company/:companyId/manage",
  protect,
  reviewController.getCompanyReviewsForRecruiter,
);

// Recruiter: approve/reject review visibility status.
router.put("/:reviewId/status", protect, reviewController.updateReviewStatus);

// Recruiter: delete review from manage view.
router.delete(
  "/:reviewId/manage",
  protect,
  reviewController.deleteReviewByRecruiter,
);

module.exports = router;
