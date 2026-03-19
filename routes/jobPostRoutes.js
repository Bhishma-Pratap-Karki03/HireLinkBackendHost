const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const jobPostController = require("../controllers/jobPostController");

router.post("/", protect, jobPostController.createJobPost);
router.get("/", jobPostController.listJobPosts);
router.get("/categories-summary", jobPostController.getJobCategoriesSummary);
router.get("/companies-summary", jobPostController.getCompanyVacancySummary);
router.get("/recruiter/list", protect, jobPostController.listRecruiterJobPosts);
router.get("/admin/list", protect, jobPostController.listJobPostsForAdmin);
router.patch("/admin/:id/status", protect, jobPostController.updateJobStatusByAdmin);
router.get("/:id", jobPostController.getJobPostById);
router.put("/:id", protect, jobPostController.updateJobPost);

module.exports = router;
