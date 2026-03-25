// User routes for auth, candidate listing, and admin dashboards/actions.

const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const {
  registerUser,
  loginUser,
  listCandidates,
  listUsersForAdmin,
  updateUserStatusByAdmin,
  updateUserRoleByAdmin,
  getAdminDashboardStats,
  getRecruiterDashboardStats,
  getCandidateDashboardStats,
} = require("../controllers/userController");

// Register a new user account.
router.post("/register", registerUser);

// Login user and return token.
router.post("/login", loginUser);
// List candidate users (used by recruiter/admin views).
router.get("/candidates", listCandidates);

// Admin: list and dashboard insights.
router.get("/admin/list", protect, listUsersForAdmin);
router.get("/admin/dashboard-stats", protect, getAdminDashboardStats);
router.get("/recruiter/dashboard-stats", protect, getRecruiterDashboardStats);
router.get("/candidate/dashboard-stats", protect, getCandidateDashboardStats);

// Admin: block/unblock user account.
router.patch("/admin/:userId/status", protect, updateUserStatusByAdmin);

// Admin: change user role (candidate/recruiter).
router.patch("/admin/:userId/role", protect, updateUserRoleByAdmin);

module.exports = router;
