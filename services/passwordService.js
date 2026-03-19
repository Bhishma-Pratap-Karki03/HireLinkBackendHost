// Password Service handles password reset and related security operations

const User = require("../models/userModel");
const bcrypt = require("bcrypt");
const { generateToken, verifyToken } = require("../utils/tokenUtils");
const {
  sendPasswordResetEmail,
  sendPasswordChangedEmail,
} = require("../utils/passwordResetEmailUtils");

// Generate a 6-digit reset code for password recovery
const generateResetCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Email validation regex pattern
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Admin email address for special handling
const ADMIN_EMAIL = "hirelinknp@gmail.com";

class PasswordService {
  validatePasswordStrength(password) {
    if (password.length < 8) {
      throw new Error("Password must be at least 8 characters long");
    }
    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password)) {
      throw new Error("Password must contain upper and lower case letters");
    }
    if (!/[0-9]/.test(password)) {
      throw new Error("Password must contain at least one number");
    }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      throw new Error("Password must contain at least one special character");
    }
  }

  // Initiate password reset process for a user
  async requestPasswordReset(email) {
    // Validate email is provided
    if (!email || typeof email !== "string") {
      throw new Error("Email is required");
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Validate email format
    if (!emailRegex.test(normalizedEmail)) {
      throw new Error("Please provide a valid email address");
    }

    // Find user by email
    const user = await User.findOne({ email: normalizedEmail });

    // For security, don't reveal if user exists or not
    if (!user) {
      return {
        success: true,
        message:
          "If an account exists with this email, a password reset code will be sent.",
        email: normalizedEmail,
      };
    }

    const isAdminEmail = normalizedEmail === ADMIN_EMAIL;

    // For non-admin users, check if email is verified before allowing password reset
    if (!isAdminEmail && !user.isVerified) {
      throw {
        name: "VerificationRequired",
        message: "Please verify your email first before resetting password.",
        requiresVerification: true,
        email: user.email,
      };
    }

    // Generate reset code that expires in 15 minutes
    const resetCode = generateResetCode();
    const resetCodeExpires = new Date(Date.now() + 15 * 60 * 1000);

    // Save reset code to user document
    user.resetCode = resetCode;
    user.resetCodeExpires = resetCodeExpires;
    await user.save();

    // Send password reset email to user
    const emailSent = await sendPasswordResetEmail(normalizedEmail, resetCode);
    if (!emailSent) {
      throw new Error("Failed to send reset email. Please try again.");
    }

    return {
      success: true,
      message: "Password reset code sent to your email.",
      email: normalizedEmail,
      expiresAt: resetCodeExpires,
    };
  }

  // Verify the reset code provided by user
  async verifyResetCode(email, code) {
    // Check if both email and code are provided
    if (!email || !code) {
      throw new Error("Email and reset code are required");
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      throw new Error("User not found");
    }

    // Check if reset code exists and matches
    if (!user.resetCode || user.resetCode !== code) {
      throw new Error("Invalid reset code");
    }

    // Check if reset code has expired
    if (!user.resetCodeExpires || user.resetCodeExpires < new Date()) {
      throw {
        name: "CodeExpired",
        message: "Reset code has expired. Please request a new one.",
        codeExpired: true,
      };
    }

    // Generate temporary token for password reset (valid for 15 minutes)
    const resetToken = generateToken(user._id, "15m");

    // Clear reset code after verification
    user.resetCode = null;
    user.resetCodeExpires = null;
    await user.save();

    return {
      success: true,
      message: "Reset code verified successfully",
      resetToken,
      email: user.email,
    };
  }

  // Reset user's password with new password
  async resetPassword(token, newPassword) {
    // Validate inputs
    if (!token || !newPassword) {
      throw new Error("Token and new password are required");
    }

    // Verify the reset token
    const decoded = verifyToken(token);
    if (!decoded) {
      throw new Error("Invalid or expired reset token");
    }

    // Find user by ID from token
    const user = await User.findById(decoded.id);
    if (!user) {
      throw new Error("User not found");
    }

    this.validatePasswordStrength(newPassword);

    // Check if new password is different from old password
    const isSamePassword = await bcrypt.compare(newPassword, user.password);
    if (isSamePassword) {
      throw new Error("New password cannot be the same as the old password");
    }

    // Update user's password (will be automatically hashed by model)
    user.password = newPassword;
    await user.save();

    // Send confirmation email that password was changed
    await sendPasswordChangedEmail(user.email, user.fullName);

    return {
      success: true,
      message:
        "Password reset successful! You can now login with your new password.",
    };
  }

  // Resend password reset code
  async resendResetCode(email) {
    if (!email) {
      throw new Error("Email is required");
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });

    // For security, don't reveal if user exists or not
    if (!user) {
      return {
        success: true,
        message:
          "If an account exists with this email, a new reset code will be sent.",
      };
    }

    // Generate new reset code
    const resetCode = generateResetCode();
    const resetCodeExpires = new Date(Date.now() + 15 * 60 * 1000);

    // Update user with new reset code
    user.resetCode = resetCode;
    user.resetCodeExpires = resetCodeExpires;
    await user.save();

    // Send new reset code email
    const emailSent = await sendPasswordResetEmail(normalizedEmail, resetCode);
    if (!emailSent) {
      throw new Error("Failed to resend reset code. Please try again.");
    }

    return {
      success: true,
      message: "New reset code sent to your email.",
      expiresAt: resetCodeExpires,
    };
  }

  async changePassword(userId, currentPassword, newPassword) {
    if (!userId || !currentPassword || !newPassword) {
      throw new Error("Current password and new password are required");
    }

    const user = await User.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    const isCurrentPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password,
    );
    if (!isCurrentPasswordValid) {
      throw new Error("Current password is incorrect");
    }

    this.validatePasswordStrength(newPassword);

    const isSamePassword = await bcrypt.compare(newPassword, user.password);
    if (isSamePassword) {
      throw new Error("New password cannot be the same as the old password");
    }

    user.password = newPassword;
    await user.save();
    await sendPasswordChangedEmail(user.email, user.fullName);

    return {
      success: true,
      message: "Password changed successfully.",
    };
  }
}

// Export a single instance of the PasswordService class
module.exports = new PasswordService();
