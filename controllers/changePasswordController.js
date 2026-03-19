// Change Password Controller handles password reset HTTP requests
// Now uses Password Service for business logic

const passwordService = require("../services/passwordService");

// Handle password reset request
exports.requestPasswordReset = async (req, res, next) => {
  try {
    const { email } = req.body;

    // Call the password service to handle reset request
    const result = await passwordService.requestPasswordReset(email);

    // Return the result from service
    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Password reset request error:", error);

    // Handle verification required error (special case)
    if (error.name === "VerificationRequired") {
      return res.status(403).json({
        success: false,
        message: error.message,
        requiresVerification: error.requiresVerification,
        email: error.email,
        code: "VERIFICATION_REQUIRED",
      });
    }

    // Handle validation errors
    if (error.message.includes("required") || error.message.includes("valid")) {
      return res.status(400).json({
        success: false,
        message: error.message,
        code: "VALIDATION_ERROR",
      });
    }

    // Pass other errors to error handler middleware
    next(error);
  }
};

// Handle reset code verification
exports.verifyResetCode = async (req, res, next) => {
  try {
    const { email, code } = req.body;

    // Call the password service to verify the reset code
    const result = await passwordService.verifyResetCode(email, code);

    // Return success response
    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Reset code verification error:", error);

    // Handle expired code error
    if (error.name === "CodeExpired") {
      return res.status(400).json({
        success: false,
        message: error.message,
        codeExpired: error.codeExpired,
        code: "CODE_EXPIRED",
      });
    }

    // Handle missing fields or user not found
    if (
      error.message.includes("required") ||
      error.message.includes("not found")
    ) {
      return res.status(400).json({
        success: false,
        message: error.message,
        code: error.message.includes("not found")
          ? "USER_NOT_FOUND"
          : "VALIDATION_ERROR",
      });
    }

    // Handle invalid reset code
    if (error.message.includes("Invalid reset code")) {
      return res.status(400).json({
        success: false,
        message: error.message,
        code: "INVALID_CODE",
      });
    }

    // Pass other errors to error handler middleware
    next(error);
  }
};

// Handle password reset with new password
exports.resetPassword = async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;

    // Call the password service to reset the password
    const result = await passwordService.resetPassword(token, newPassword);

    // Return success response
    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Password reset error:", error);

    // Handle invalid or expired token
    if (error.message.includes("Invalid or expired")) {
      return res.status(401).json({
        success: false,
        message: error.message,
        code: "INVALID_TOKEN",
      });
    }

    // Handle validation errors (password requirements, same password)
    if (
      error.message.includes("required") ||
      error.message.includes("must be") ||
      error.message.includes("cannot be the same")
    ) {
      return res.status(400).json({
        success: false,
        message: error.message,
        code: "VALIDATION_ERROR",
      });
    }

    // Pass other errors to error handler middleware
    next(error);
  }
};

// Handle resend reset code request
exports.resendResetCode = async (req, res, next) => {
  try {
    const { email } = req.body;

    // Call the password service to resend reset code
    const result = await passwordService.resendResetCode(email);

    // Return success response
    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Resend reset code error:", error);

    // Handle missing email error
    if (error.message.includes("required")) {
      return res.status(400).json({
        success: false,
        message: error.message,
        code: "VALIDATION_ERROR",
      });
    }

    // Pass other errors to error handler middleware
    next(error);
  }
};

// Handle authenticated password change
exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const result = await passwordService.changePassword(
      req.user?.id,
      currentPassword,
      newPassword,
    );

    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Change password error:", error);

    if (
      error.message.includes("required") ||
      error.message.includes("incorrect") ||
      error.message.includes("must be") ||
      error.message.includes("cannot be the same")
    ) {
      return res.status(400).json({
        success: false,
        message: error.message,
        code: "VALIDATION_ERROR",
      });
    }

    if (error.message.includes("User not found")) {
      return res.status(404).json({
        success: false,
        message: error.message,
        code: "USER_NOT_FOUND",
      });
    }

    next(error);
  }
};
