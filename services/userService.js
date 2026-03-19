// User Service handles user registration and login business logic
// This service separates the business logic from the HTTP layer

const User = require("../models/userModel");
const bcrypt = require("bcrypt");
const { generateToken } = require("../utils/tokenUtils");
const { sendVerificationEmail } = require("../utils/emailUtils");

// Generate a 6-digit verification code for email verification
const generateVerificationCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

class UserService {
  // Register a new user in the system
  async registerUser(fullName, email, password, userType) {
    // First, check if all required fields are provided
    if (!fullName || !email || !password) {
      throw new Error("All fields are required");
    }

    // Clean up the input data by trimming spaces and making email lowercase
    fullName = fullName.trim();
    email = email.trim().toLowerCase();

    // Validate the email format using a regular expression
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error("Please provide a valid email");
    }

    // Check if password meets minimum length requirement
    if (password.length < 8) {
      throw new Error("Password must be at least 8 characters long");
    }

    // Determine user role based on userType from frontend
    let role = "candidate";
    if (userType === "recruiter") {
      role = "recruiter";
    }

    // Check if a user with this email already exists in the database
    const existingUser = await User.findOne({ email });

    if (existingUser) {
      // If user exists and is already verified, tell them to login instead
      if (existingUser.isVerified) {
        throw new Error("Email already exists and is verified. Please login.");
      } else {
        // If user exists but isn't verified, update their info and send new verification code
        const verificationCode = generateVerificationCode();
        const verificationCodeExpires = new Date(Date.now() + 15 * 60 * 1000);

        existingUser.fullName = fullName;
        existingUser.password = password; // Password will be hashed automatically by model
        existingUser.role = role;
        existingUser.verificationCode = verificationCode;
        existingUser.verificationCodeExpires = verificationCodeExpires;
        await existingUser.save();

        // Send verification email to user
        await sendVerificationEmail(email, verificationCode);

        return {
          success: true,
          user: {
            id: existingUser._id,
            email: existingUser.email,
          },
          requiresVerification: true,
        };
      }
    }

    // Create a new user since email doesn't exist in database
    const verificationCode = generateVerificationCode();
    const verificationCodeExpires = new Date(Date.now() + 15 * 60 * 1000);

    const newUser = new User({
      fullName,
      email,
      password,
      role,
      isVerified: false,
      verificationCode,
      verificationCodeExpires,
    });

    await newUser.save();
    await sendVerificationEmail(email, verificationCode);

    return {
      success: true,
      user: {
        id: newUser._id,
        fullName: newUser.fullName,
        email: newUser.email,
        role: newUser.role,
      },
      requiresVerification: true,
    };
  }

  // Authenticate user login
  async loginUser(email, password) {
    // Normalize email and trim password
    const normalizedEmail = email.trim().toLowerCase();
    const trimmedPassword = password.trim();

    // Check if both email and password are provided
    if (!normalizedEmail || !trimmedPassword) {
      throw new Error("Email and password are required");
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      throw new Error("Please provide a valid email address");
    }

    // Find user by email in database
    const user = await User.findOne({ email: normalizedEmail });

    // If user doesn't exist, throw authentication error
    if (!user) {
      throw new Error("Invalid email or password");
    }

    if (user.isBlocked) {
      throw new Error("Your account has been blocked. Please contact admin.");
    }

    // Check if user has verified their email
    if (!user.isVerified) {
      // If verification code is still valid, inform user to verify first
      if (user.verificationCode && user.verificationCodeExpires > new Date()) {
        const timeLeft = Math.ceil(
          (user.verificationCodeExpires - new Date()) / 1000 / 60
        );
        throw {
          name: "VerificationRequired",
          message: `Please verify your email first. Verification code sent to ${user.email} is still valid for ${timeLeft} minutes.`,
          requiresVerification: true,
          email: user.email,
          hasActiveCode: true,
        };
      } else {
        // If verification code expired, generate and send new one
        const verificationCode = generateVerificationCode();
        const verificationCodeExpires = new Date(Date.now() + 15 * 60 * 1000);

        user.verificationCode = verificationCode;
        user.verificationCodeExpires = verificationCodeExpires;
        await user.save();

        await sendVerificationEmail(user.email, verificationCode);

        throw {
          name: "VerificationRequired",
          message: "Verification code expired. New code sent to your email.",
          requiresVerification: true,
          email: user.email,
          codeExpired: true,
        };
      }
    }

    // Verify the password matches the hashed password in database
    const isPasswordValid = await bcrypt.compare(
      trimmedPassword,
      user.password
    );
    if (!isPasswordValid) {
      throw new Error("Invalid email or password");
    }

    // Generate JWT token for authenticated session
    const token = generateToken(user._id);

    user.lastLoginAt = new Date();
    await user.save();

    // Get user data without sensitive information
    const userData = await User.findById(user._id).select(
      "-password -verificationCode -resetCode"
    );

    return {
      success: true,
      user: {
        id: userData._id,
        fullName: userData.fullName,
        email: userData.email,
        role: userData.role,
        phone: userData.phone || "",
        address: userData.address || "",
        currentJobTitle: userData.currentJobTitle || "",
        profilePicture: userData.profilePicture || "",
        connectionsCount: userData.connectionsCount || 0,
        isVerified: userData.isVerified,
        createdAt: userData.createdAt,
        updatedAt: userData.updatedAt,
        isBlocked: userData.isBlocked || false,
        lastLoginAt: userData.lastLoginAt || null,
      },
      token,
    };
  }
}

// Export a single instance of the UserService class
module.exports = new UserService();
