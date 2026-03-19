// Verification Routes - defines API endpoints for email verification

const express = require("express");
const router = express.Router();

// Import the new verification controller
const verificationController = require("../controllers/verificationController");

// POST /api/verify/verify-email - Verify email with code
router.post("/verify-email", verificationController.verifyEmail);

// POST /api/verify/resend-verification - Resend verification code
router.post("/resend-verification", verificationController.resendVerification);

// GET /api/verify/check-status - Check verification status
router.get("/check-status", verificationController.checkVerificationStatus);

module.exports = router;
