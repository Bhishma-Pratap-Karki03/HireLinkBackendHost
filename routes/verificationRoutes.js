// Email verification routes used during registration flow.

const express = require("express");
const router = express.Router();

const verificationController = require("../controllers/verificationController");

// Verify email using OTP/code.
router.post("/verify-email", verificationController.verifyEmail);

// Resend verification code to the same email.
router.post("/resend-verification", verificationController.resendVerification);

// Check whether an email is already verified.
router.get("/check-status", verificationController.checkVerificationStatus);

module.exports = router;
