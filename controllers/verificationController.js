// Verification Controller handles email verification requests
// This is a thin layer that just handles HTTP requests and calls the Auth Service

const authService = require("../services/authService");

// Verify user's email with the code they received
exports.verifyEmail = async (req, res, next) => {
  try {
    const { email, code } = req.body;

    // Call the auth service to handle the verification logic
    const result = await authService.verifyEmail(email, code);

    // Return success response
    res.status(200).json({
      success: true,
      message: "Email verified successfully! Welcome to HireLink.",
      verified: true,
      ...result,
    });
  } catch (error) {
    console.error("Email verification error:", error);

    // Handle specific error cases with appropriate HTTP status codes
    if (error.message.includes("already verified")) {
      return res.status(400).json({
        success: false,
        message: error.message,
        code: "ALREADY_VERIFIED",
      });
    }

    if (error.message.includes("Invalid verification code")) {
      return res.status(400).json({
        success: false,
        message: error.message,
        code: "INVALID_CODE",
      });
    }

    if (error.message.includes("expired")) {
      return res.status(400).json({
        success: false,
        message: error.message,
        codeExpired: true,
        code: "CODE_EXPIRED",
      });
    }

    if (error.message.includes("not found")) {
      return res.status(404).json({
        success: false,
        message: error.message,
        code: "USER_NOT_FOUND",
      });
    }

    // Pass other errors to error handler middleware
    next(error);
  }
};

// Resend verification code to user's email
exports.resendVerification = async (req, res, next) => {
  try {
    const { email } = req.body;

    // Call the auth service to resend verification code
    const result = await authService.resendVerificationCode(email);

    // Return success response
    res.status(200).json({
      success: true,
      message: "New verification code sent to your email.",
      ...result,
    });
  } catch (error) {
    console.error("Resend verification error:", error);

    // Handle specific error cases
    if (error.message.includes("already verified")) {
      return res.status(400).json({
        success: false,
        message: error.message,
        code: "ALREADY_VERIFIED",
      });
    }

    if (error.message.includes("not found")) {
      return res.status(404).json({
        success: false,
        message: error.message,
        code: "USER_NOT_FOUND",
      });
    }

    // Pass other errors to error handler middleware
    next(error);
  }
};

// Check verification status of a user
exports.checkVerificationStatus = async (req, res, next) => {
  try {
    const { email } = req.query;

    // Check if email query parameter is provided
    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
        code: "VALIDATION_ERROR",
      });
    }

    // Call the auth service to check verification status
    const result = await authService.checkVerificationStatus(email);

    // Return the verification status
    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Check status error:", error);

    // Handle user not found error
    if (error.message.includes("not found")) {
      return res.status(404).json({
        success: false,
        message: error.message,
        code: "USER_NOT_FOUND",
      });
    }

    // Pass other errors to error handler middleware
    next(error);
  }
};
