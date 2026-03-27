// User Controller handles user registration and login HTTP requests
// Now uses User Service for business logic, making the controller cleaner

const userService = require("../services/userService");
const mongoose = require("mongoose");
const User = require("../models/userModel");
const JobPost = require("../models/jobPostModel");
const AppliedJob = require("../models/appliedJobModel");
const AdminAssessment = require("../models/adminAssessmentModel");
const AssessmentAttempt = require("../models/assessmentAttemptModel");
const RecruiterAssessment = require("../models/recruiterAssessmentModel");
const AtsReport = require("../models/atsReportModel");
const Message = require("../models/messageModel");
const ConnectionRequest = require("../models/connectionRequestModel");
const SavedJob = require("../models/savedJobModel");
const RecommendationHistory = require("../models/recommendationHistoryModel");
const {
  sendUserBlockedEmail,
  sendUnblockAuditEmailToAdmin,
  sendUserRoleChangedEmail,
} = require("../utils/adminStatusEmailUtils");

const ADMIN_EMAIL = "hirelinknp@gmail.com";

const isAdmin = (user) =>
  user &&
  (String(user.role || "").toLowerCase() === "admin" ||
    String(user.email || "").toLowerCase() === ADMIN_EMAIL);

// Handle user registration request
exports.registerUser = async (req, res, next) => {
  try {
    const { fullName, email, password, userType } = req.body;

    // Call the user service to handle registration logic
    const result = await userService.registerUser(
      fullName,
      email,
      password,
      userType
    );

    // Existing account but not verified: guide user to verification flow.
    if (result.requiresVerification && result.emailExists) {
      const message = result.hasActiveCode
        ? `Email already registered but not verified. Please verify using your existing code (${Math.ceil((result.timeLeft || 0) / 60)} minute(s) left).`
        : "Email already registered but not verified. Previous code expired, please resend a new verification code.";

      return res.status(200).json({
        success: false,
        message,
        ...result,
      });
    }

    // Return success response for new registration.
    res.status(201).json({
      success: true,
      message: "Registration successful! Verification code sent to your email.",
      ...result,
    });
  } catch (error) {
    console.error("Registration Error:", error.message);

    // Handle specific error cases with appropriate HTTP status codes
    // Handle email already exists error
    if (error.message.includes("already exists")) {
      return res.status(400).json({
        success: false,
        message: error.message,
        emailExists: true,
        isVerified: error.message.includes("verified"),
        code: "EMAIL_EXISTS",
      });
    }

    // Handle validation errors (missing fields, invalid email, weak password)
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

// Handle user login request
exports.loginUser = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Call the user service to handle login logic
    const result = await userService.loginUser(email, password);

    // Return success response with user data and token
    res.status(200).json({
      success: true,
      message: "Login successful",
      ...result,
    });
  } catch (error) {
    console.error("Login Error:", error.message);

    // Handle verification required error (special case that needs custom response)
    if (error.name === "VerificationRequired") {
      return res.status(403).json({
        success: false,
        message: error.message,
        requiresVerification: error.requiresVerification,
        email: error.email,
        hasActiveCode: error.hasActiveCode,
        codeExpired: error.codeExpired,
        code: "VERIFICATION_REQUIRED",
      });
    }

    // Handle invalid credentials error
    if (
      error.message.includes("Invalid email") ||
      error.message.includes("password")
    ) {
      return res.status(401).json({
        success: false,
        message: error.message,
        code: "INVALID_CREDENTIALS",
      });
    }

    if (error.message.includes("blocked")) {
      return res.status(403).json({
        success: false,
        message: error.message,
        code: "ACCOUNT_BLOCKED",
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

// List candidates for recruiter view
exports.listCandidates = async (req, res, next) => {
  try {
    const candidates = await User.find({
      role: "candidate",
      isBlocked: { $ne: true },
      isVerified: true,
    })
      .select(
        "fullName email currentJobTitle address profilePicture skills experience"
      )
      .lean();

    res.status(200).json({ success: true, candidates });
  } catch (error) {
    next(error);
  }
};

// Admin: list candidates/recruiters with filters and pagination
exports.listUsersForAdmin = async (req, res, next) => {
  try {
    if (!isAdmin(req.user)) {
      return res.status(403).json({
        success: false,
        message: "Only admin can access this resource",
      });
    }

    const search = String(req.query.search || "").trim();
    const role = String(req.query.role || "all").toLowerCase();
    const status = String(req.query.status || "all").toLowerCase();

    const filter = {
      email: { $ne: ADMIN_EMAIL },
      role: { $in: ["candidate", "recruiter"] },
    };

    if (role === "candidate" || role === "recruiter") {
      filter.role = role;
    }

    if (status === "active") {
      filter.isBlocked = false;
    } else if (status === "blocked") {
      filter.isBlocked = true;
    }

    if (search) {
      filter.$or = [
        { fullName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    const users = await User.find(filter)
      .select(
        "fullName email role isBlocked createdAt updatedAt lastLoginAt profilePicture",
      )
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      users,
    });
  } catch (error) {
    next(error);
  }
};

// Admin: block/unblock user
exports.updateUserStatusByAdmin = async (req, res, next) => {
  try {
    if (!isAdmin(req.user)) {
      return res.status(403).json({
        success: false,
        message: "Only admin can access this resource",
      });
    }

    const { userId } = req.params;
    const { action, sendEmail } = req.body;
    const normalizedAction = String(action || "").toLowerCase();
    const shouldSendEmail = Boolean(sendEmail);

    if (!["block", "unblock"].includes(normalizedAction)) {
      return res.status(400).json({
        success: false,
        message: "Action must be block or unblock",
      });
    }

    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (String(targetUser.email || "").toLowerCase() === ADMIN_EMAIL) {
      return res.status(400).json({
        success: false,
        message: "Admin account cannot be blocked",
      });
    }

    targetUser.isBlocked = normalizedAction === "block";
    await targetUser.save();

    let emailSent = false;
    if (shouldSendEmail) {
      if (normalizedAction === "block") {
        emailSent = await sendUserBlockedEmail({
          toEmail: targetUser.email,
          fullName: targetUser.fullName,
          role: targetUser.role,
        });
      } else {
        emailSent = await sendUnblockAuditEmailToAdmin({
          adminEmail: ADMIN_EMAIL,
          targetEmail: targetUser.email,
          targetName: targetUser.fullName,
          targetRole: targetUser.role,
        });
      }
    }

    res.status(200).json({
      success: true,
      message:
        normalizedAction === "block"
          ? "User blocked successfully"
          : "User unblocked successfully",
      emailSent,
      user: {
        id: targetUser._id,
        isBlocked: targetUser.isBlocked,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Admin: change user role candidate <-> recruiter
exports.updateUserRoleByAdmin = async (req, res, next) => {
  try {
    if (!isAdmin(req.user)) {
      return res.status(403).json({
        success: false,
        message: "Only admin can access this resource",
      });
    }

    const { userId } = req.params;
    const { role, sendEmail } = req.body;
    const normalizedRole = String(role || "").toLowerCase();
    const shouldSendEmail = Boolean(sendEmail);

    if (!["candidate", "recruiter"].includes(normalizedRole)) {
      return res.status(400).json({
        success: false,
        message: "Role must be candidate or recruiter",
      });
    }

    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (String(targetUser.email || "").toLowerCase() === ADMIN_EMAIL) {
      return res.status(400).json({
        success: false,
        message: "Admin role cannot be changed",
      });
    }

    const previousRole = String(targetUser.role || "").toLowerCase();
    targetUser.role = normalizedRole;
    await targetUser.save();

    let emailSent = false;
    if (shouldSendEmail) {
      emailSent = await sendUserRoleChangedEmail({
        toEmail: targetUser.email,
        fullName: targetUser.fullName,
        previousRole,
        newRole: normalizedRole,
      });
    }

    res.status(200).json({
      success: true,
      message: "User role updated successfully",
      emailSent,
      user: {
        id: targetUser._id,
        role: targetUser.role,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Admin: dashboard insights
exports.getAdminDashboardStats = async (req, res, next) => {
  try {
    if (!isAdmin(req.user)) {
      return res.status(403).json({
        success: false,
        message: "Only admin can access this resource",
      });
    }

    const toDateParam = req.query.to ? new Date(req.query.to) : new Date();
    const fromDateParam = req.query.from ? new Date(req.query.from) : null;
    const isValidTo = !Number.isNaN(toDateParam.getTime());
    const inferredToDate = isValidTo ? toDateParam : new Date();
    const inferredFromDate =
      fromDateParam && !Number.isNaN(fromDateParam.getTime())
        ? fromDateParam
        : new Date(inferredToDate.getTime() - 29 * 24 * 60 * 60 * 1000);

    const rangeStart = new Date(inferredFromDate);
    rangeStart.setHours(0, 0, 0, 0);
    const rangeEnd = new Date(inferredToDate);
    rangeEnd.setHours(23, 59, 59, 999);

    const dateRangeQuery = { $gte: rangeStart, $lte: rangeEnd };
    const userRangeBase = {
      email: { $ne: ADMIN_EMAIL },
      createdAt: dateRangeQuery,
    };

    const rangeDays = Math.max(
      1,
      Math.round((rangeEnd.getTime() - rangeStart.getTime()) / 86400000) + 1,
    );
    const labels = Array.from({ length: rangeDays }, (_, i) => {
      const date = new Date(rangeStart);
      date.setDate(date.getDate() + i);
      return date.toISOString().slice(0, 10);
    });

    const toSeriesMap = (rows, key = "_id") =>
      rows.reduce((acc, row) => {
        acc[row[key]] = row.count;
        return acc;
      }, {});

    const [usersSeriesAgg, jobsSeriesAgg, applicationsSeriesAgg] =
      await Promise.all([
        User.aggregate([
          { $match: { ...userRangeBase } },
          {
            $group: {
              _id: {
                $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
              },
              count: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
        ]),
        JobPost.aggregate([
          { $match: { createdAt: dateRangeQuery } },
          {
            $group: {
              _id: {
                $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
              },
              count: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
        ]),
        AppliedJob.aggregate([
          { $match: { createdAt: dateRangeQuery } },
          {
            $group: {
              _id: {
                $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
              },
              count: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
        ]),
      ]);

    const usersSeriesMap = toSeriesMap(usersSeriesAgg);
    const jobsSeriesMap = toSeriesMap(jobsSeriesAgg);
    const applicationsSeriesMap = toSeriesMap(applicationsSeriesAgg);

    const [totalUsers, totalCandidates, totalRecruiters, blockedUsers, activeUsers] =
      await Promise.all([
        User.countDocuments({ email: { $ne: ADMIN_EMAIL } }),
        User.countDocuments({ role: "candidate", email: { $ne: ADMIN_EMAIL } }),
        User.countDocuments({ role: "recruiter", email: { $ne: ADMIN_EMAIL } }),
        User.countDocuments({ isBlocked: true, email: { $ne: ADMIN_EMAIL } }),
        User.countDocuments({ isBlocked: false, email: { $ne: ADMIN_EMAIL } }),
      ]);

    const [
      totalJobs,
      activeJobs,
      inactiveJobs,
      totalApplications,
      submittedApplications,
      interviewApplications,
      hiredApplications,
      rejectedApplications,
      adminAssessments,
      recruiterAssessments,
      atsReportsCount,
      totalMessages,
      unreadMessages,
      pendingConnections,
      acceptedConnections,
      recentUsers,
      recentJobs,
      jobTypeAgg,
      workModeAgg,
      applicationStatusAgg,
      topCompaniesAgg,
      adminAssessmentActive,
      adminAssessmentInactive,
      adminAssessmentTypeAgg,
      adminAssessmentDifficultyAgg,
      adminAssessmentIds,
    ] = await Promise.all([
      JobPost.countDocuments({ createdAt: dateRangeQuery }),
      JobPost.countDocuments({ isActive: true, createdAt: dateRangeQuery }),
      JobPost.countDocuments({ isActive: false, createdAt: dateRangeQuery }),
      AppliedJob.countDocuments({ createdAt: dateRangeQuery }),
      AppliedJob.countDocuments({
        status: "submitted",
        createdAt: dateRangeQuery,
      }),
      AppliedJob.countDocuments({
        status: "interview",
        createdAt: dateRangeQuery,
      }),
      AppliedJob.countDocuments({ status: "hired", createdAt: dateRangeQuery }),
      AppliedJob.countDocuments({
        status: "rejected",
        createdAt: dateRangeQuery,
      }),
      AdminAssessment.countDocuments({ createdAt: dateRangeQuery }),
      RecruiterAssessment.countDocuments({ createdAt: dateRangeQuery }),
      AtsReport.countDocuments({ createdAt: dateRangeQuery }),
      Message.countDocuments({ createdAt: dateRangeQuery }),
      Message.countDocuments({ readAt: null, createdAt: dateRangeQuery }),
      ConnectionRequest.countDocuments({
        status: "pending",
        createdAt: dateRangeQuery,
      }),
      ConnectionRequest.countDocuments({
        status: "accepted",
        createdAt: dateRangeQuery,
      }),
      User.find({ ...userRangeBase })
        .select("fullName email role createdAt lastLoginAt isBlocked profilePicture")
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),
      JobPost.find({ createdAt: dateRangeQuery })
        .select("jobTitle location createdAt isActive")
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),
      JobPost.aggregate([
        { $match: { createdAt: dateRangeQuery } },
        {
          $group: {
            _id: {
              $cond: [
                { $in: ["$jobType", [null, ""]] },
                "Not specified",
                "$jobType",
              ],
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
      ]),
      JobPost.aggregate([
        { $match: { createdAt: dateRangeQuery } },
        {
          $group: {
            _id: {
              $cond: [
                { $in: ["$workMode", [null, ""]] },
                "Not specified",
                "$workMode",
              ],
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
      ]),
      AppliedJob.aggregate([
        { $match: { createdAt: dateRangeQuery } },
        {
          $group: {
            _id: {
              $cond: [
                { $in: ["$status", [null, ""]] },
                "unknown",
                "$status",
              ],
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
      ]),
      JobPost.aggregate([
        { $match: { createdAt: dateRangeQuery } },
        {
          $group: {
            _id: "$recruiterId",
            count: { $sum: 1 },
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "_id",
            foreignField: "_id",
            as: "recruiter",
          },
        },
        {
          $addFields: {
            recruiterName: {
              $ifNull: [{ $arrayElemAt: ["$recruiter.fullName", 0] }, "Unknown company"],
            },
            recruiterPicture: {
              $ifNull: [{ $arrayElemAt: ["$recruiter.profilePicture", 0] }, ""],
            },
          },
        },
        {
          $project: {
            _id: "$recruiterName",
            count: 1,
            logo: "$recruiterPicture",
          },
        },
        { $sort: { count: -1 } },
        { $limit: 5 },
      ]),
      AdminAssessment.countDocuments({
        createdAt: dateRangeQuery,
        status: "active",
      }),
      AdminAssessment.countDocuments({
        createdAt: dateRangeQuery,
        status: "inactive",
      }),
      AdminAssessment.aggregate([
        { $match: { createdAt: dateRangeQuery } },
        {
          $group: {
            _id: { $ifNull: ["$type", "unknown"] },
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
      ]),
      AdminAssessment.aggregate([
        { $match: { createdAt: dateRangeQuery } },
        {
          $group: {
            _id: { $ifNull: ["$difficulty", "unknown"] },
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
      ]),
      AdminAssessment.find({ createdAt: dateRangeQuery })
        .select("_id type title")
        .lean(),
    ]);

    const adminAssessmentIdValues = adminAssessmentIds.map((item) => item._id);

    const [adminAttemptStatusAgg, adminTopAssessmentAttemptsAgg, adminQuizScoreAgg] =
      await Promise.all([
        AssessmentAttempt.aggregate([
          {
            $match: {
              assessmentSource: "admin",
              assessment: { $in: adminAssessmentIdValues },
              createdAt: dateRangeQuery,
            },
          },
          {
            $group: {
              _id: { $ifNull: ["$status", "unknown"] },
              count: { $sum: 1 },
            },
          },
          { $sort: { count: -1 } },
        ]),
        AssessmentAttempt.aggregate([
          {
            $match: {
              assessmentSource: "admin",
              assessment: { $in: adminAssessmentIdValues },
              status: "submitted",
              createdAt: dateRangeQuery,
            },
          },
          { $group: { _id: "$assessment", attempts: { $sum: 1 } } },
          { $sort: { attempts: -1 } },
          { $limit: 5 },
        ]),
        AssessmentAttempt.aggregate(
          [
            {
              $match: {
                assessmentSource: "admin",
                assessment: {
                  $in: adminAssessmentIds
                    .filter((item) => item.type === "quiz")
                    .map((item) => item._id),
                },
                status: "submitted",
                createdAt: dateRangeQuery,
              },
            },
            { $group: { _id: null, avgScore: { $avg: "$score" } } },
          ],
        ),
      ]);

    const totalAttemptCount = adminAttemptStatusAgg.reduce(
      (sum, item) => sum + (item.count || 0),
      0,
    );
    const adminAssessmentTitleMap = adminAssessmentIds.reduce((acc, item) => {
      acc[String(item._id)] = item.title || "Untitled assessment";
      return acc;
    }, {});

    return res.status(200).json({
      success: true,
      stats: {
        users: {
          total: totalUsers,
          candidates: totalCandidates,
          recruiters: totalRecruiters,
          active: activeUsers,
          blocked: blockedUsers,
        },
        jobs: {
          total: totalJobs,
          active: activeJobs,
          inactive: inactiveJobs,
        },
        applications: {
          total: totalApplications,
          submitted: submittedApplications,
          interview: interviewApplications,
          hired: hiredApplications,
          rejected: rejectedApplications,
        },
        assessments: {
          total: adminAssessments + recruiterAssessments,
          adminCreated: adminAssessments,
          recruiterCreated: recruiterAssessments,
          adminInsights: {
            active: adminAssessmentActive,
            inactive: adminAssessmentInactive,
            totalAttempts: totalAttemptCount,
            avgQuizScore:
              adminQuizScoreAgg.length > 0
                ? Number((adminQuizScoreAgg[0].avgScore || 0).toFixed(1))
                : 0,
            distributions: {
              types: {
                labels: adminAssessmentTypeAgg.map((item) => item._id),
                values: adminAssessmentTypeAgg.map((item) => item.count),
              },
              difficulty: {
                labels: adminAssessmentDifficultyAgg.map((item) => item._id),
                values: adminAssessmentDifficultyAgg.map((item) => item.count),
              },
              attempts: {
                labels: adminAttemptStatusAgg.map((item) => item._id),
                values: adminAttemptStatusAgg.map((item) => item.count),
              },
            },
            topAssessmentsByAttempts: adminTopAssessmentAttemptsAgg.map((item) => ({
              title: adminAssessmentTitleMap[String(item._id)] || "Untitled assessment",
              attempts: item.attempts || 0,
            })),
          },
        },
        ats: {
          reports: atsReportsCount,
        },
        messaging: {
          totalMessages,
          unreadMessages,
        },
        connections: {
          pending: pendingConnections,
          accepted: acceptedConnections,
        },
        trends: {
          labels,
          usersCreated: labels.map((label) => usersSeriesMap[label] || 0),
          jobsPosted: labels.map((label) => jobsSeriesMap[label] || 0),
          applications: labels.map((label) => applicationsSeriesMap[label] || 0),
        },
        distributions: {
          jobTypes: {
            labels: jobTypeAgg.map((item) => item._id),
            values: jobTypeAgg.map((item) => item.count),
          },
          workModes: {
            labels: workModeAgg.map((item) => item._id),
            values: workModeAgg.map((item) => item.count),
          },
          applicationStatuses: {
            labels: applicationStatusAgg.map((item) => item._id),
            values: applicationStatusAgg.map((item) => item.count),
          },
          userRoles: {
            labels: ["Candidates", "Recruiters"],
            values: [totalCandidates, totalRecruiters],
          },
        },
        topCompanies: topCompaniesAgg.map((item) => ({
          name: item._id,
          jobs: item.count,
          logo: item.logo || "",
        })),
      },
      dateRange: {
        from: rangeStart.toISOString(),
        to: rangeEnd.toISOString(),
      },
      recentUsers,
      recentJobs,
    });
  } catch (error) {
    next(error);
  }
};

// Recruiter: dashboard insights
exports.getRecruiterDashboardStats = async (req, res, next) => {
  try {
    if (!req.user || String(req.user.role || "").toLowerCase() !== "recruiter") {
      return res.status(403).json({
        success: false,
        message: "Only recruiters can access this resource",
      });
    }

    const recruiterId = req.user.id;
    const recruiterObjectId = new mongoose.Types.ObjectId(recruiterId);
    const toDateParam = req.query.to ? new Date(req.query.to) : new Date();
    const fromDateParam = req.query.from ? new Date(req.query.from) : null;
    const isValidTo = !Number.isNaN(toDateParam.getTime());
    const inferredToDate = isValidTo ? toDateParam : new Date();
    const inferredFromDate =
      fromDateParam && !Number.isNaN(fromDateParam.getTime())
        ? fromDateParam
        : new Date(inferredToDate.getTime() - 29 * 24 * 60 * 60 * 1000);

    const rangeStart = new Date(inferredFromDate);
    rangeStart.setHours(0, 0, 0, 0);
    const rangeEnd = new Date(inferredToDate);
    rangeEnd.setHours(23, 59, 59, 999);
    const dateRangeQuery = { $gte: rangeStart, $lte: rangeEnd };

    const rangeDays = Math.max(
      1,
      Math.round((rangeEnd.getTime() - rangeStart.getTime()) / 86400000) + 1,
    );
    const labels = Array.from({ length: rangeDays }, (_, i) => {
      const date = new Date(rangeStart);
      date.setDate(date.getDate() + i);
      return date.toISOString().slice(0, 10);
    });

    const toSeriesMap = (rows, key = "_id") =>
      rows.reduce((acc, row) => {
        acc[row[key]] = row.count;
        return acc;
      }, {});

    const recruiterJobIds = await JobPost.find({ recruiterId })
      .select("_id")
      .lean();
    const recruiterJobIdValues = recruiterJobIds.map((item) => item._id);
    const hasRecruiterJobs = recruiterJobIdValues.length > 0;

    const [
      jobsTotal,
      jobsActive,
      jobsInactive,
      jobsInRange,
      applicationsTotal,
      applicationsReviewed,
      applicationsShortlisted,
      applicationsInterview,
      applicationsHired,
      applicationsRejected,
      atsReportsCount,
      recruiterAssessments,
      recruiterAssessmentsActive,
      recruiterAssessmentsInactive,
      totalMessagesReceived,
      unreadMessagesReceived,
      pendingConnections,
      acceptedConnections,
      jobsSeriesAgg,
      applicationsSeriesAgg,
      hiredSeriesAgg,
      jobTypeAgg,
      workModeAgg,
      applicationStatusAgg,
      topJobsAgg,
      recentApplicationsRaw,
      recruiterAssessmentTypeAgg,
      recruiterAssessmentIds,
    ] = await Promise.all([
      JobPost.countDocuments({ recruiterId }),
      JobPost.countDocuments({ recruiterId, isActive: true }),
      JobPost.countDocuments({ recruiterId, isActive: false }),
      JobPost.countDocuments({ recruiterId, createdAt: dateRangeQuery }),
      hasRecruiterJobs
        ? AppliedJob.countDocuments({
            job: { $in: recruiterJobIdValues },
            createdAt: dateRangeQuery,
          })
        : 0,
      hasRecruiterJobs
        ? AppliedJob.countDocuments({
            job: { $in: recruiterJobIdValues },
            status: "reviewed",
            createdAt: dateRangeQuery,
          })
        : 0,
      hasRecruiterJobs
        ? AppliedJob.countDocuments({
            job: { $in: recruiterJobIdValues },
            status: "shortlisted",
            createdAt: dateRangeQuery,
          })
        : 0,
      hasRecruiterJobs
        ? AppliedJob.countDocuments({
            job: { $in: recruiterJobIdValues },
            status: "interview",
            createdAt: dateRangeQuery,
          })
        : 0,
      hasRecruiterJobs
        ? AppliedJob.countDocuments({
            job: { $in: recruiterJobIdValues },
            status: "hired",
            createdAt: dateRangeQuery,
          })
        : 0,
      hasRecruiterJobs
        ? AppliedJob.countDocuments({
            job: { $in: recruiterJobIdValues },
            status: "rejected",
            createdAt: dateRangeQuery,
          })
        : 0,
      hasRecruiterJobs
        ? AtsReport.countDocuments({
            job: { $in: recruiterJobIdValues },
            createdAt: dateRangeQuery,
          })
        : 0,
      RecruiterAssessment.countDocuments({
        createdBy: recruiterId,
        createdAt: dateRangeQuery,
      }),
      RecruiterAssessment.countDocuments({
        createdBy: recruiterId,
        status: "active",
        createdAt: dateRangeQuery,
      }),
      RecruiterAssessment.countDocuments({
        createdBy: recruiterId,
        status: "inactive",
        createdAt: dateRangeQuery,
      }),
      Message.countDocuments({
        receiver: recruiterId,
        createdAt: dateRangeQuery,
      }),
      Message.countDocuments({
        receiver: recruiterId,
        readAt: null,
        createdAt: dateRangeQuery,
      }),
      ConnectionRequest.countDocuments({
        recipient: recruiterId,
        status: "pending",
        createdAt: dateRangeQuery,
      }),
      ConnectionRequest.countDocuments({
        $or: [{ requester: recruiterId }, { recipient: recruiterId }],
        status: "accepted",
        createdAt: dateRangeQuery,
      }),
      JobPost.aggregate([
        { $match: { recruiterId: recruiterObjectId, createdAt: dateRangeQuery } },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      hasRecruiterJobs
        ? AppliedJob.aggregate([
            { $match: { job: { $in: recruiterJobIdValues }, createdAt: dateRangeQuery } },
            {
              $group: {
                _id: {
                  $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
                },
                count: { $sum: 1 },
              },
            },
            { $sort: { _id: 1 } },
          ])
        : [],
      hasRecruiterJobs
        ? AppliedJob.aggregate([
            {
              $match: {
                job: { $in: recruiterJobIdValues },
                status: "hired",
                updatedAt: dateRangeQuery,
              },
            },
            {
              $group: {
                _id: {
                  $dateToString: { format: "%Y-%m-%d", date: "$updatedAt" },
                },
                count: { $sum: 1 },
              },
            },
            { $sort: { _id: 1 } },
          ])
        : [],
      JobPost.aggregate([
        { $match: { recruiterId: recruiterObjectId, createdAt: dateRangeQuery } },
        {
          $group: {
            _id: {
              $cond: [{ $in: ["$jobType", [null, ""]] }, "Not specified", "$jobType"],
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
      ]),
      JobPost.aggregate([
        { $match: { recruiterId: recruiterObjectId, createdAt: dateRangeQuery } },
        {
          $group: {
            _id: {
              $cond: [{ $in: ["$workMode", [null, ""]] }, "Not specified", "$workMode"],
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
      ]),
      hasRecruiterJobs
        ? AppliedJob.aggregate([
            { $match: { job: { $in: recruiterJobIdValues }, createdAt: dateRangeQuery } },
            {
              $group: {
                _id: { $cond: [{ $in: ["$status", [null, ""]] }, "unknown", "$status"] },
                count: { $sum: 1 },
              },
            },
            { $sort: { count: -1 } },
          ])
        : [],
      hasRecruiterJobs
        ? AppliedJob.aggregate([
            { $match: { job: { $in: recruiterJobIdValues }, createdAt: dateRangeQuery } },
            { $group: { _id: "$job", applicants: { $sum: 1 } } },
            {
              $lookup: {
                from: "jobposts",
                localField: "_id",
                foreignField: "_id",
                as: "job",
              },
            },
            {
              $project: {
                _id: 0,
                jobId: "$_id",
                title: { $ifNull: [{ $arrayElemAt: ["$job.jobTitle", 0] }, "Untitled role"] },
                applicants: 1,
              },
            },
            { $sort: { applicants: -1 } },
            { $limit: 5 },
          ])
        : [],
      hasRecruiterJobs
        ? AppliedJob.find({ job: { $in: recruiterJobIdValues }, createdAt: dateRangeQuery })
            .select("status createdAt candidate job")
            .sort({ createdAt: -1 })
            .limit(6)
            .populate({ path: "candidate", select: "fullName email profilePicture" })
            .populate({ path: "job", select: "jobTitle" })
            .lean()
        : [],
      RecruiterAssessment.aggregate([
        { $match: { createdBy: recruiterObjectId, createdAt: dateRangeQuery } },
        {
          $group: {
            _id: { $ifNull: ["$type", "unknown"] },
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
      ]),
      RecruiterAssessment.find({ createdBy: recruiterId, createdAt: dateRangeQuery })
        .select("_id title")
        .lean(),
    ]);

    const jobsSeriesMap = toSeriesMap(jobsSeriesAgg);
    const applicationsSeriesMap = toSeriesMap(applicationsSeriesAgg);
    const hiredSeriesMap = toSeriesMap(hiredSeriesAgg);
    const recruiterAssessmentIdValues = recruiterAssessmentIds.map((item) => item._id);

    const recruiterAttemptsAgg = recruiterAssessmentIdValues.length
      ? await AssessmentAttempt.aggregate([
          {
            $match: {
              assessmentSource: "recruiter",
              assessment: { $in: recruiterAssessmentIdValues },
              status: "submitted",
              createdAt: dateRangeQuery,
            },
          },
          {
            $group: {
              _id: "$assessment",
              attempts: { $sum: 1 },
            },
          },
          { $sort: { attempts: -1 } },
          { $limit: 5 },
        ])
      : [];

    const totalAssessmentAttempts = recruiterAssessmentIdValues.length
      ? await AssessmentAttempt.countDocuments({
          assessmentSource: "recruiter",
          assessment: { $in: recruiterAssessmentIdValues },
          status: "submitted",
          createdAt: dateRangeQuery,
        })
      : 0;

    const assessmentTitleMap = recruiterAssessmentIds.reduce((acc, item) => {
      acc[String(item._id)] = item.title || "Untitled assessment";
      return acc;
    }, {});

    const recentApplications = recentApplicationsRaw.map((item) => ({
      id: item._id,
      candidateName: item.candidate?.fullName || "Candidate",
      candidateEmail: item.candidate?.email || "-",
      candidatePicture: item.candidate?.profilePicture || "",
      jobTitle: item.job?.jobTitle || "Untitled role",
      status: item.status || "submitted",
      appliedAt: item.createdAt,
    }));

    return res.status(200).json({
      success: true,
      stats: {
        jobs: {
          total: jobsTotal,
          active: jobsActive,
          inactive: jobsInactive,
          inRange: jobsInRange,
        },
        applications: {
          total: applicationsTotal,
          reviewed: applicationsReviewed,
          shortlisted: applicationsShortlisted,
          interview: applicationsInterview,
          hired: applicationsHired,
          rejected: applicationsRejected,
        },
        ats: { reports: atsReportsCount },
        assessments: {
          total: recruiterAssessments,
          active: recruiterAssessmentsActive,
          inactive: recruiterAssessmentsInactive,
          attempts: totalAssessmentAttempts,
          distributions: {
            types: {
              labels: recruiterAssessmentTypeAgg.map((item) => item._id),
              values: recruiterAssessmentTypeAgg.map((item) => item.count),
            },
          },
          topAssessmentsByAttempts: recruiterAttemptsAgg.map((item) => ({
            title: assessmentTitleMap[String(item._id)] || "Untitled assessment",
            attempts: item.attempts || 0,
          })),
        },
        messaging: {
          totalReceived: totalMessagesReceived,
          unreadReceived: unreadMessagesReceived,
        },
        connections: {
          pending: pendingConnections,
          accepted: acceptedConnections,
        },
        trends: {
          labels,
          jobsPosted: labels.map((label) => jobsSeriesMap[label] || 0),
          applicationsReceived: labels.map((label) => applicationsSeriesMap[label] || 0),
          hires: labels.map((label) => hiredSeriesMap[label] || 0),
        },
        distributions: {
          jobTypes: {
            labels: jobTypeAgg.map((item) => item._id),
            values: jobTypeAgg.map((item) => item.count),
          },
          workModes: {
            labels: workModeAgg.map((item) => item._id),
            values: workModeAgg.map((item) => item.count),
          },
          applicationStatuses: {
            labels: applicationStatusAgg.map((item) => item._id),
            values: applicationStatusAgg.map((item) => item.count),
          },
        },
        topJobs: topJobsAgg,
      },
      dateRange: {
        from: rangeStart.toISOString(),
        to: rangeEnd.toISOString(),
      },
      recentApplications,
    });
  } catch (error) {
    next(error);
  }
};

// Candidate: dashboard insights
exports.getCandidateDashboardStats = async (req, res, next) => {
  try {
    if (!req.user || String(req.user.role || "").toLowerCase() !== "candidate") {
      return res.status(403).json({
        success: false,
        message: "Only candidates can access this resource",
      });
    }

    const candidateId = req.user.id;
    const candidateObjectId = new mongoose.Types.ObjectId(candidateId);

    const toDateParam = req.query.to ? new Date(req.query.to) : new Date();
    const fromDateParam = req.query.from ? new Date(req.query.from) : null;
    const isValidTo = !Number.isNaN(toDateParam.getTime());
    const inferredToDate = isValidTo ? toDateParam : new Date();
    const inferredFromDate =
      fromDateParam && !Number.isNaN(fromDateParam.getTime())
        ? fromDateParam
        : new Date(inferredToDate.getTime() - 29 * 24 * 60 * 60 * 1000);

    const rangeStart = new Date(inferredFromDate);
    rangeStart.setHours(0, 0, 0, 0);
    const rangeEnd = new Date(inferredToDate);
    rangeEnd.setHours(23, 59, 59, 999);
    const dateRangeQuery = { $gte: rangeStart, $lte: rangeEnd };
    const staleCutoff = new Date(rangeEnd.getTime() - 7 * 24 * 60 * 60 * 1000);

    const rangeDays = Math.max(
      1,
      Math.round((rangeEnd.getTime() - rangeStart.getTime()) / 86400000) + 1,
    );
    const labels = Array.from({ length: rangeDays }, (_, i) => {
      const date = new Date(rangeStart);
      date.setDate(date.getDate() + i);
      return date.toISOString().slice(0, 10);
    });

    const toSeriesMap = (rows, key = "_id") =>
      rows.reduce((acc, row) => {
        acc[row[key]] = row.count;
        return acc;
      }, {});

    const [
      totalApplications,
      applicationsInRange,
      reviewedInRange,
      shortlistedInRange,
      interviewInRange,
      hiredInRange,
      rejectedInRange,
      activePipelineInRange,
      staleSubmittedCount,
      savedJobsTotal,
      savedJobsInRange,
      recommendationRunsTotal,
      recommendationRunsInRange,
      messagesTotal,
      unreadMessages,
      pendingConnections,
      acceptedConnections,
      attemptsSubmitted,
      attemptsInProgress,
      avgQuizScoreAgg,
      applicationsTrendAgg,
      savedTrendAgg,
      adminAssessmentsTrendAgg,
      applicationStatusAgg,
      workModeAgg,
      jobTypeAgg,
      topAppliedJobsAgg,
      recentApplicationsRaw,
      recommendationItemsAgg,
    ] = await Promise.all([
      AppliedJob.countDocuments({ candidate: candidateId }),
      AppliedJob.countDocuments({ candidate: candidateId, createdAt: dateRangeQuery }),
      AppliedJob.countDocuments({
        candidate: candidateId,
        status: "reviewed",
        createdAt: dateRangeQuery,
      }),
      AppliedJob.countDocuments({
        candidate: candidateId,
        status: "shortlisted",
        createdAt: dateRangeQuery,
      }),
      AppliedJob.countDocuments({
        candidate: candidateId,
        status: "interview",
        createdAt: dateRangeQuery,
      }),
      AppliedJob.countDocuments({
        candidate: candidateId,
        status: "hired",
        createdAt: dateRangeQuery,
      }),
      AppliedJob.countDocuments({
        candidate: candidateId,
        status: "rejected",
        createdAt: dateRangeQuery,
      }),
      AppliedJob.countDocuments({
        candidate: candidateId,
        status: { $in: ["submitted", "reviewed", "shortlisted", "interview"] },
        createdAt: dateRangeQuery,
      }),
      AppliedJob.countDocuments({
        candidate: candidateId,
        status: "submitted",
        createdAt: { $lte: staleCutoff },
      }),
      SavedJob.countDocuments({ candidate: candidateId }),
      SavedJob.countDocuments({ candidate: candidateId, createdAt: dateRangeQuery }),
      RecommendationHistory.countDocuments({ candidate: candidateId }),
      RecommendationHistory.countDocuments({ candidate: candidateId, createdAt: dateRangeQuery }),
      Message.countDocuments({ receiver: candidateId, createdAt: dateRangeQuery }),
      Message.countDocuments({ receiver: candidateId, readAt: null, createdAt: dateRangeQuery }),
      ConnectionRequest.countDocuments({
        recipient: candidateId,
        status: "pending",
        createdAt: dateRangeQuery,
      }),
      ConnectionRequest.countDocuments({
        $or: [{ requester: candidateId }, { recipient: candidateId }],
        status: "accepted",
        createdAt: dateRangeQuery,
      }),
      AssessmentAttempt.countDocuments({
        candidate: candidateId,
        status: "submitted",
        createdAt: dateRangeQuery,
      }),
      AssessmentAttempt.countDocuments({
        candidate: candidateId,
        status: "in_progress",
        createdAt: dateRangeQuery,
      }),
      AssessmentAttempt.aggregate([
        {
          $match: {
            candidate: candidateObjectId,
            status: "submitted",
            assessmentSource: "admin",
            createdAt: dateRangeQuery,
          },
        },
        { $group: { _id: null, avgScore: { $avg: "$score" } } },
      ]),
      AppliedJob.aggregate([
        { $match: { candidate: candidateObjectId, createdAt: dateRangeQuery } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      SavedJob.aggregate([
        { $match: { candidate: candidateObjectId, createdAt: dateRangeQuery } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      AssessmentAttempt.aggregate([
        {
          $match: {
            candidate: candidateObjectId,
            status: "submitted",
            assessmentSource: "admin",
            createdAt: dateRangeQuery,
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      AppliedJob.aggregate([
        { $match: { candidate: candidateObjectId, createdAt: dateRangeQuery } },
        {
          $group: {
            _id: { $cond: [{ $in: ["$status", [null, ""]] }, "unknown", "$status"] },
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
      ]),
      AppliedJob.aggregate([
        { $match: { candidate: candidateObjectId, createdAt: dateRangeQuery } },
        {
          $lookup: {
            from: "jobposts",
            localField: "job",
            foreignField: "_id",
            as: "jobInfo",
          },
        },
        {
          $group: {
            _id: {
              $ifNull: [{ $arrayElemAt: ["$jobInfo.workMode", 0] }, "not specified"],
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
      ]),
      AppliedJob.aggregate([
        { $match: { candidate: candidateObjectId, createdAt: dateRangeQuery } },
        {
          $lookup: {
            from: "jobposts",
            localField: "job",
            foreignField: "_id",
            as: "jobInfo",
          },
        },
        {
          $group: {
            _id: {
              $ifNull: [{ $arrayElemAt: ["$jobInfo.jobType", 0] }, "not specified"],
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
      ]),
      AppliedJob.aggregate([
        { $match: { candidate: candidateObjectId, createdAt: dateRangeQuery } },
        { $group: { _id: "$job", applicants: { $sum: 1 } } },
        {
          $lookup: {
            from: "jobposts",
            localField: "_id",
            foreignField: "_id",
            as: "jobInfo",
          },
        },
        {
          $project: {
            _id: 0,
            jobId: "$_id",
            title: { $ifNull: [{ $arrayElemAt: ["$jobInfo.jobTitle", 0] }, "Untitled role"] },
            applicants: 1,
          },
        },
        { $sort: { applicants: -1 } },
        { $limit: 5 },
      ]),
      AppliedJob.find({ candidate: candidateId, createdAt: dateRangeQuery })
        .select("status createdAt job")
        .sort({ createdAt: -1 })
        .limit(6)
        .populate({ path: "job", select: "jobTitle recruiterId location" })
        .lean(),
      RecommendationHistory.aggregate([
        { $match: { candidate: candidateObjectId, createdAt: dateRangeQuery } },
        {
          $project: {
            count: {
              $cond: [{ $isArray: "$recommendations" }, { $size: "$recommendations" }, 0],
            },
          },
        },
        { $group: { _id: null, total: { $sum: "$count" } } },
      ]),
    ]);

    const recruiterIds = Array.from(
      new Set(
        recentApplicationsRaw
          .map((item) => item.job?.recruiterId)
          .filter(Boolean)
          .map((id) => String(id)),
      ),
    );

    const recruiters = recruiterIds.length
      ? await User.find({ _id: { $in: recruiterIds } })
          .select("_id fullName")
          .lean()
      : [];
    const recruiterNameMap = recruiters.reduce((acc, user) => {
      acc[String(user._id)] = user.fullName || "Recruiter";
      return acc;
    }, {});

    const recentApplications = recentApplicationsRaw.map((item) => ({
      id: item._id,
      jobTitle: item.job?.jobTitle || "Untitled role",
      location: item.job?.location || "-",
      companyName: recruiterNameMap[String(item.job?.recruiterId || "")] || "Company",
      status: item.status || "submitted",
      appliedAt: item.createdAt,
    }));

    const applicationsSeriesMap = toSeriesMap(applicationsTrendAgg);
    const savedSeriesMap = toSeriesMap(savedTrendAgg);
    const adminAssessmentsSeriesMap = toSeriesMap(adminAssessmentsTrendAgg);

    const recommendationItemsTotalInRange =
      recommendationItemsAgg.length > 0 ? recommendationItemsAgg[0].total || 0 : 0;

    const respondedInRange =
      reviewedInRange + shortlistedInRange + interviewInRange + hiredInRange + rejectedInRange;
    const responseRate = applicationsInRange
      ? Number(((respondedInRange / applicationsInRange) * 100).toFixed(1))
      : 0;
    const interviewRate = applicationsInRange
      ? Number((((interviewInRange + hiredInRange) / applicationsInRange) * 100).toFixed(1))
      : 0;
    const hireRate = applicationsInRange
      ? Number(((hiredInRange / applicationsInRange) * 100).toFixed(1))
      : 0;

    return res.status(200).json({
      success: true,
      stats: {
        applications: {
          total: totalApplications,
          inRange: applicationsInRange,
          reviewed: reviewedInRange,
          shortlisted: shortlistedInRange,
          interview: interviewInRange,
          hired: hiredInRange,
          rejected: rejectedInRange,
          responded: respondedInRange,
          activePipeline: activePipelineInRange,
          staleSubmitted: staleSubmittedCount,
          rates: {
            responseRate,
            interviewRate,
            hireRate,
          },
        },
        savedJobs: {
          total: savedJobsTotal,
          inRange: savedJobsInRange,
        },
        recommendations: {
          totalRuns: recommendationRunsTotal,
          runsInRange: recommendationRunsInRange,
          suggestedJobsInRange: recommendationItemsTotalInRange,
        },
        assessments: {
          submitted: attemptsSubmitted,
          inProgress: attemptsInProgress,
          avgQuizScore:
            avgQuizScoreAgg.length > 0
              ? Number((avgQuizScoreAgg[0].avgScore || 0).toFixed(1))
              : 0,
        },
        messaging: {
          totalReceived: messagesTotal,
          unreadReceived: unreadMessages,
        },
        connections: {
          pending: pendingConnections,
          accepted: acceptedConnections,
        },
        trends: {
          labels,
          applications: labels.map((label) => applicationsSeriesMap[label] || 0),
          savedJobs: labels.map((label) => savedSeriesMap[label] || 0),
          adminAssessments: labels.map((label) => adminAssessmentsSeriesMap[label] || 0),
        },
        distributions: {
          applicationStatuses: {
            labels: applicationStatusAgg.map((item) => item._id),
            values: applicationStatusAgg.map((item) => item.count),
          },
          workModes: {
            labels: workModeAgg.map((item) => item._id),
            values: workModeAgg.map((item) => item.count),
          },
          jobTypes: {
            labels: jobTypeAgg.map((item) => item._id),
            values: jobTypeAgg.map((item) => item.count),
          },
        },
        topAppliedJobs: topAppliedJobsAgg,
      },
      dateRange: {
        from: rangeStart.toISOString(),
        to: rangeEnd.toISOString(),
      },
      recentApplications,
    });
  } catch (error) {
    next(error);
  }
};





