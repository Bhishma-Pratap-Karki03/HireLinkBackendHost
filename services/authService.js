// Auth Service handles email verification and related authentication logic

const User = require("../models/userModel");
const { sendVerificationEmail } = require("../utils/emailUtils");
const { sendWelcomeEmail } = require("../utils/WelcomeEmailUtils");

// Generate a 6-digit verification code
const generateVerificationCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

class AuthService {
  
  // Verify user's email with the provided code
  async verifyEmail(email, code) {
    // Find user by email (case-insensitive search)
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      throw new Error("User not found");
    }

    // If user is already verified, no need to verify again
    if (user.isVerified) {
      throw new Error("Email already verified. Please login.");
    }

    // Check if the provided code matches the stored verification code
    if (user.verificationCode !== code) {
      throw new Error("Invalid verification code");
    }

    // Check if the verification code has expired (15 minutes limit)
    if (user.verificationCodeExpires < new Date()) {
      throw new Error("Verification code has expired. Please request a new code.");
    }

    // Mark user as verified and clear verification codes
    user.isVerified = true;
    user.verificationCode = null;
    user.verificationCodeExpires = null;
    await user.save();

    // Send welcome email to non-admin users
    const ADMIN_EMAIL = "hirelinknp@gmail.com";
    if (user.email !== ADMIN_EMAIL) {
      try {
        await sendWelcomeEmail(user.email, user.fullName, user.role);
        console.log(`Welcome email sent to ${user.email}`);
      } catch (emailError) {
        // If welcome email fails, still continue with verification
        console.error("Failed to send welcome email:", emailError);
      }
    }

    return {
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified,
      },
    };
  }

  // Resend verification code to user's email
  async resendVerificationCode(email) {
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      throw new Error("User not found");
    }

    // If user is already verified, no need to resend code
    if (user.isVerified) {
      throw new Error("Email already verified. Please login.");
    }

    // Generate new verification code with 15-minute expiration
    const newVerificationCode = generateVerificationCode();
    const newVerificationCodeExpires = new Date(Date.now() + 15 * 60 * 1000);

    // Update user with new verification code
    user.verificationCode = newVerificationCode;
    user.verificationCodeExpires = newVerificationCodeExpires;
    await user.save();

    // Send the new verification code via email
    const emailSent = await sendVerificationEmail(email, newVerificationCode);
    if (!emailSent) {
      throw new Error("Failed to resend verification email. Please try again.");
    }

    return {
      expiresAt: newVerificationCodeExpires,
    };
  }

  // Check verification status of a user
  async checkVerificationStatus(email) {
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      throw new Error("User not found");
    }

    const currentTime = new Date();
    const isExpired = user.verificationCodeExpires
      ? user.verificationCodeExpires < currentTime
      : true;

    // Calculate how much time is left for the verification code
    const timeLeft =
      user.verificationCodeExpires && !isExpired
        ? Math.max(
            0,
            Math.ceil((user.verificationCodeExpires - currentTime) / 1000)
          )
        : 0;

    return {
      isVerified: user.isVerified,
      hasPendingVerification: !user.isVerified && user.verificationCode,
      expiresAt: user.verificationCodeExpires,
      timeLeft: timeLeft,
      isExpired: isExpired,
    };
  }
}

// Export a single instance of the AuthService class
module.exports = new AuthService();