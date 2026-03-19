// User Routes - defines API endpoints for user registration and login

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

// POST /api/users/register - Register a new user
router.post("/register", registerUser);

// POST /api/users/login - Login an existing user
router.post("/login", loginUser);
// GET /api/users/candidates - List candidates (recruiter/admin)
router.get("/candidates", listCandidates);

// Admin user management
router.get("/admin/list", protect, listUsersForAdmin);
router.get("/admin/dashboard-stats", protect, getAdminDashboardStats);
router.get("/recruiter/dashboard-stats", protect, getRecruiterDashboardStats);
router.get("/candidate/dashboard-stats", protect, getCandidateDashboardStats);
router.patch("/admin/:userId/status", protect, updateUserStatusByAdmin);
router.patch("/admin/:userId/role", protect, updateUserRoleByAdmin);

module.exports = router;
