// reviewController.js - Updated with proper exports
const Review = require("../models/reviewModel");
const User = require("../models/userModel");
const ConnectionRequest = require("../models/connectionRequestModel");
const Notification = require("../models/notificationModel");
const { getIO } = require("../socket");

const FEED_NOTIFICATION_TYPES = [
  "connection_request_received",
  "connection_request_accepted",
  "application_status_updated",
  "project_review_received",
  "company_review_received",
];

const buildReviewPayload = (review, user) => ({
  id: review._id,
  rating: review.rating,
  text: review.description,
  title: review.title || "",
  reviewerName: user?.fullName || review.reviewerName || "Deleted User",
  reviewerLocation: user?.address || review.reviewerLocation || "Unknown",
  reviewerRole: review.reviewerRole || user?.currentJobTitle || "",
  reviewerUserType: user?.role || "",
  date: new Date(review.createdAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }),
  reviewerAvatar: user?.profilePicture
    ? user.profilePicture.startsWith("http")
      ? user.profilePicture
      : `http://localhost:5000${user.profilePicture}`
    : "",
  status: review.status,
});

const areUsersConnected = async (userAId, userBId) => {
  const link = await ConnectionRequest.findOne({
    status: "accepted",
    $or: [
      { requester: userAId, recipient: userBId },
      { requester: userBId, recipient: userAId },
    ],
  })
    .select("_id")
    .lean();
  return Boolean(link);
};

const emitReviewNotification = async ({
  recipientId,
  actor,
  type,
  message,
  targetPath,
}) => {
  if (!recipientId || !actor?._id) return;
  if (String(recipientId) === String(actor._id)) return;

  const notification = await Notification.create({
    user: recipientId,
    actor: actor._id,
    type,
    message,
    targetPath,
  });

  const unreadCount = await Notification.countDocuments({
    user: recipientId,
    type: { $in: FEED_NOTIFICATION_TYPES },
    isRead: false,
  });

  const io = getIO();
  io?.to(`user:${String(recipientId)}`).emit("notification:connection:new", {
    notification: {
      id: notification._id.toString(),
      type,
      isRead: false,
      message,
      createdAt: notification.createdAt,
      updatedAt: notification.updatedAt,
      targetPath,
      actor: {
        id: actor._id.toString(),
        fullName: actor.fullName || "User",
        role: actor.role || "",
        profilePicture: actor.profilePicture || "",
      },
    },
    unreadCount,
  });
};

// Get all reviews for a company (public)
const getCompanyReviews = async (req, res, next) => {
  try {
    const { companyId } = req.params;

    // Check if company exists and is a recruiter
    const company = await User.findById(companyId);
    if (!company || company.role !== "recruiter") {
      return res.status(404).json({
        success: false,
        message: "Company not found",
      });
    }

    // Get all published and not deleted reviews for this company
    const reviews = await Review.find({
      targetType: "company",
      companyId,
      status: "published",
      isDeleted: false,
    })
      .populate("userId", "fullName profilePicture address currentJobTitle role")
      .sort({ createdAt: -1 });

    // Calculate average rating
    let averageRating = 0;
    if (reviews.length > 0) {
      const totalRating = reviews.reduce(
        (sum, review) => sum + review.rating,
        0,
      );
      averageRating = totalRating / reviews.length;
    }

    // Format reviews for response with proper profile picture URL
    const formattedReviews = reviews.map((review) => {
      const reviewer = review.userId;
      const reviewerName = reviewer?.fullName || "Deleted User";
      const reviewerLocation = reviewer?.address || "Unknown";
      const reviewerRole =
        review.reviewerRole || reviewer?.currentJobTitle || "";
      const reviewerAvatar = reviewer?.profilePicture
        ? reviewer.profilePicture.startsWith("http")
          ? reviewer.profilePicture
          : `http://localhost:5000${reviewer.profilePicture}`
        : "";

      return {
      id: review._id,
      rating: review.rating,
      text: review.description,
      title: review.title || "",
      reviewerName,
      reviewerLocation,
      reviewerRole,
      reviewerUserType: reviewer?.role || "",
      date: new Date(review.createdAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
      reviewerAvatar,
      status: review.status,
      };
    });

    res.status(200).json({
      success: true,
      reviews: formattedReviews,
      averageRating: parseFloat(averageRating.toFixed(1)),
      totalReviews: reviews.length,
    });
  } catch (error) {
    console.error("Get reviews error:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching reviews",
      error: error.message,
    });
  }
};

// Get company reviews for recruiter (with status filtering)
const getCompanyReviewsForRecruiter = async (req, res, next) => {
  try {
    const { companyId } = req.params;
    const { status } = req.query; // "all", "published", "hidden"
    const userId = req.user.id;

    // Check if user is the recruiter of this company
    const company = await User.findOne({
      _id: companyId,
      _id: userId,
      role: "recruiter",
    });

    if (!company) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to manage reviews for this company",
      });
    }

    // Build query based on status
    const query = {
      targetType: "company",
      companyId,
      isDeleted: false,
    };

    if (status && status !== "all") {
      query.status = status;
    }

    // Get reviews based on query
    const reviews = await Review.find(query)
      .populate("userId", "fullName profilePicture address currentJobTitle role")
      .sort({ createdAt: -1 });

    // Format reviews for response
    const formattedReviews = reviews.map((review) => {
      const reviewer = review.userId;
      const reviewerName = reviewer?.fullName || "Deleted User";
      const reviewerLocation = reviewer?.address || "Unknown";
      const reviewerRole =
        review.reviewerRole || reviewer?.currentJobTitle || "";
      const reviewerAvatar = reviewer?.profilePicture
        ? reviewer.profilePicture.startsWith("http")
          ? reviewer.profilePicture
          : `http://localhost:5000${reviewer.profilePicture}`
        : "";

      return {
      id: review._id,
      rating: review.rating,
      text: review.description,
      title: review.title || "",
      reviewerName,
      reviewerLocation,
      reviewerRole,
      reviewerUserType: reviewer?.role || "",
      date: new Date(review.createdAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
      reviewerAvatar,
      status: review.status,
      };
    });

    // Get counts for each status
    const totalReviews = await Review.countDocuments({
      targetType: "company",
      companyId,
      isDeleted: false,
    });
    const publishedReviews = await Review.countDocuments({
      targetType: "company",
      companyId,
      status: "published",
      isDeleted: false,
    });
    const hiddenReviews = await Review.countDocuments({
      targetType: "company",
      companyId,
      status: "hidden",
      isDeleted: false,
    });

    res.status(200).json({
      success: true,
      reviews: formattedReviews,
      counts: {
        all: totalReviews,
        published: publishedReviews,
        hidden: hiddenReviews,
      },
    });
  } catch (error) {
    console.error("Get recruiter reviews error:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching reviews",
      error: error.message,
    });
  }
};

// Recruiter: Update review status (hide/show)
const updateReviewStatus = async (req, res, next) => {
  try {
    const { reviewId } = req.params;
    const { status } = req.body; // "published" or "hidden"
    const userId = req.user.id;

    // Validate status
    if (!["published", "hidden"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status. Must be 'published' or 'hidden'",
      });
    }

    // Find the review
    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Review not found",
      });
    }

    let isAllowed = false;
    if (review.targetType === "company") {
      const company = await User.findOne({
        _id: review.companyId,
        role: "recruiter",
      }).select("_id");
      isAllowed = Boolean(company) && String(company._id) === String(userId);
    } else if (review.targetType === "project") {
      isAllowed = String(review.candidateId) === String(userId);
    }

    if (!isAllowed) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to update this review",
      });
    }

    // Update review status
    review.status = status;
    await review.save();

    res.status(200).json({
      success: true,
      message: `Review ${status === "hidden" ? "hidden" : "published"} successfully`,
      review: {
        id: review._id,
        status: review.status,
      },
    });
  } catch (error) {
    console.error("Update review status error:", error);
    res.status(500).json({
      success: false,
      message: "Server error updating review status",
      error: error.message,
    });
  }
};

// Recruiter: Delete review (soft delete)
const deleteReviewByRecruiter = async (req, res, next) => {
  try {
    const { reviewId } = req.params;
    const userId = req.user.id;

    // Find the review
    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Review not found",
      });
    }

    let isAllowed = false;
    if (review.targetType === "company") {
      const company = await User.findOne({
        _id: review.companyId,
        role: "recruiter",
      }).select("_id");
      isAllowed = Boolean(company) && String(company._id) === String(userId);
    } else if (review.targetType === "project") {
      isAllowed = String(review.candidateId) === String(userId);
    }

    if (!isAllowed) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to delete this review",
      });
    }

    // Soft delete the review
    review.isDeleted = true;
    await review.save();

    res.status(200).json({
      success: true,
      message: "Review deleted successfully",
    });
  } catch (error) {
    console.error("Delete review error:", error);
    res.status(500).json({
      success: false,
      message: "Server error deleting review",
      error: error.message,
    });
  }
};

// Submit a review
const submitReview = async (req, res, next) => {
  try {
    const { companyId } = req.params;
    const { rating, title, description, reviewerRole } = req.body;
    const userId = req.user.id;

    if (String(userId) === String(companyId)) {
      return res.status(400).json({
        success: false,
        message: "You cannot review your own company profile",
      });
    }

    // Check if company exists and is a recruiter
    const company = await User.findById(companyId);
    if (!company || company.role !== "recruiter") {
      return res.status(404).json({
        success: false,
        message: "Company not found",
      });
    }

    // Get user info
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Check if user has already submitted a review for this company
    const existingReview = await Review.findOne({
      targetType: "company",
      companyId,
      userId,
      isDeleted: false,
    });

    if (existingReview) {
      return res.status(400).json({
        success: false,
        message:
          "You have already submitted a review for this company. You can update your existing review instead.",
        code: "REVIEW_ALREADY_EXISTS",
        existingReviewId: existingReview._id,
      });
    }

    // Validate rating
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid rating (1-5)",
      });
    }

    // Validate description
    if (!description || description.trim().length < 10) {
      return res.status(400).json({
        success: false,
        message: "Review description must be at least 10 characters",
      });
    }

    // Create new review
    const newReview = new Review({
      targetType: "company",
      companyId,
      userId,
      rating,
      title: title || "", // Title is optional
      description: description.trim(),
      reviewerName: user.fullName,
      reviewerLocation: user.address || "",
      reviewerRole: reviewerRole || user.currentJobTitle || "",
      status: "published", // Default to published
      isApproved: true,
      isDeleted: false,
    });

    await newReview.save();

    // Get the created review with populated user data
    const savedReview = await Review.findById(newReview._id).populate(
      "userId",
      "fullName profilePicture address currentJobTitle role",
    );

    await emitReviewNotification({
      recipientId: companyId,
      actor: user,
      type: "company_review_received",
      message: `${user.fullName || "A user"} reviewed your company profile.`,
      targetPath: `/employer/${companyId}#company-reviews`,
    });

    res.status(201).json({
      success: true,
      message: "Review submitted successfully",
      review: {
        id: savedReview._id,
        rating: savedReview.rating,
        text: savedReview.description,
        title: savedReview.title,
        reviewerName: savedReview.userId.fullName,
        reviewerLocation: savedReview.userId.address || "Unknown",
        reviewerRole: savedReview.reviewerRole,
        reviewerUserType: savedReview.userId.role || "",
        date: new Date(savedReview.createdAt).toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        }),
        reviewerAvatar: savedReview.userId.profilePicture
          ? savedReview.userId.profilePicture.startsWith("http")
            ? savedReview.userId.profilePicture
            : `http://localhost:5000${savedReview.userId.profilePicture}`
          : "",
        status: savedReview.status,
      },
    });
  } catch (error) {
    console.error("Submit review error:", error);
    res.status(500).json({
      success: false,
      message: "Server error submitting review",
      error: error.message,
    });
  }
};

// Get user's review for a company
const getMyReview = async (req, res, next) => {
  try {
    const { companyId } = req.params;
    const userId = req.user.id;

    const review = await Review.findOne({
      targetType: "company",
      companyId,
      userId,
      isDeleted: false,
    }).populate("userId", "fullName profilePicture address currentJobTitle role");

    if (!review) {
      return res.status(404).json({
        success: false,
        message: "You haven't reviewed this company yet",
      });
    }

    res.status(200).json({
      success: true,
      review: {
        id: review._id,
        rating: review.rating,
        text: review.description,
        title: review.title,
        reviewerName: review.userId.fullName,
        reviewerLocation: review.userId.address || "Unknown",
        reviewerRole: review.reviewerRole,
        reviewerUserType: review.userId.role || "",
        date: new Date(review.createdAt).toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        }),
        reviewerAvatar: review.userId.profilePicture
          ? review.userId.profilePicture.startsWith("http")
            ? review.userId.profilePicture
            : `http://localhost:5000${review.userId.profilePicture}`
          : "",
        status: review.status,
      },
    });
  } catch (error) {
    console.error("Get my review error:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching your review",
      error: error.message,
    });
  }
};

const getProjectReviews = async (req, res) => {
  try {
    const { candidateId, projectId } = req.params;
    const viewerId = req.user?.id || null;

    const candidate = await User.findById(candidateId).select(
      "role projects profileVisibility",
    );
    if (!candidate || candidate.role !== "candidate") {
      return res.status(404).json({
        success: false,
        message: "Candidate not found",
      });
    }

    if (candidate.profileVisibility === "private") {
      if (!viewerId) {
        return res.status(403).json({
          success: false,
          message: "This candidate profile is private.",
        });
      }

      if (String(viewerId) !== String(candidateId)) {
        const viewer = await User.findById(viewerId).select("role").lean();
        const isAdmin = viewer?.role === "admin";
        if (!isAdmin) {
          const connected = await areUsersConnected(viewerId, candidateId);
          if (!connected) {
            return res.status(403).json({
              success: false,
              message: "This candidate profile is private.",
            });
          }
        }
      }
    }

    const project = candidate.projects?.id(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    const reviews = await Review.find({
      targetType: "project",
      candidateId,
      projectId,
      status: "published",
      isDeleted: false,
    })
      .populate("userId", "fullName profilePicture address currentJobTitle role")
      .sort({ createdAt: -1 });

    let averageRating = 0;
    if (reviews.length > 0) {
      const total = reviews.reduce((sum, review) => sum + review.rating, 0);
      averageRating = total / reviews.length;
    }

    res.status(200).json({
      success: true,
      reviews: reviews.map((review) => buildReviewPayload(review, review.userId)),
      averageRating: parseFloat(averageRating.toFixed(1)),
      totalReviews: reviews.length,
    });
  } catch (error) {
    console.error("Get project reviews error:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching project reviews",
      error: error.message,
    });
  }
};

const getProjectReviewsForCandidate = async (req, res) => {
  try {
    const { candidateId, projectId } = req.params;
    const userId = req.user.id;

    if (String(candidateId) !== String(userId)) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to manage these project reviews",
      });
    }

    const candidate = await User.findById(candidateId).select("role projects");
    if (!candidate || candidate.role !== "candidate") {
      return res.status(404).json({
        success: false,
        message: "Candidate not found",
      });
    }

    const project = candidate.projects?.id(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    const reviews = await Review.find({
      targetType: "project",
      candidateId,
      projectId,
      isDeleted: false,
    })
      .populate("userId", "fullName profilePicture address currentJobTitle role")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      reviews: reviews.map((review) => buildReviewPayload(review, review.userId)),
    });
  } catch (error) {
    console.error("Get candidate project reviews error:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching project reviews",
      error: error.message,
    });
  }
};

const submitProjectReview = async (req, res) => {
  try {
    const { candidateId, projectId } = req.params;
    const { rating, title, description, reviewerRole } = req.body;
    const userId = req.user.id;

    if (userId === candidateId) {
      return res.status(400).json({
        success: false,
        message: "You cannot review your own project",
      });
    }

    const [candidate, reviewer] = await Promise.all([
      User.findById(candidateId).select("role projects profileVisibility"),
      User.findById(userId),
    ]);

    if (!candidate || candidate.role !== "candidate") {
      return res.status(404).json({
        success: false,
        message: "Candidate not found",
      });
    }

    if (!reviewer || !["candidate", "recruiter"].includes(reviewer.role)) {
      return res.status(403).json({
        success: false,
        message: "Only candidates or recruiters can review projects",
      });
    }

    const project = candidate.projects?.id(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    const connected = await areUsersConnected(userId, candidateId);
    if (!connected) {
      return res.status(403).json({
        success: false,
        message: "Only connected users can review this project",
      });
    }

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid rating (1-5)",
      });
    }

    if (!description || description.trim().length < 10) {
      return res.status(400).json({
        success: false,
        message: "Review description must be at least 10 characters",
      });
    }

    const existingReview = await Review.findOne({
      targetType: "project",
      candidateId,
      projectId,
      userId,
      isDeleted: false,
    });

    if (existingReview) {
      return res.status(400).json({
        success: false,
        message:
          "You have already reviewed this project. Please update your review instead.",
        code: "REVIEW_ALREADY_EXISTS",
        existingReviewId: existingReview._id,
      });
    }

    const review = await Review.create({
      targetType: "project",
      // Backward compatibility with old unique index (companyId + userId)
      companyId: projectId,
      candidateId,
      projectId,
      userId,
      rating,
      title: title || "",
      description: description.trim(),
      reviewerName: reviewer.fullName,
      reviewerLocation: reviewer.address || "",
      reviewerRole: reviewerRole || reviewer.currentJobTitle || "",
      isApproved: true,
      status: "published",
      isDeleted: false,
    });

    const savedReview = await Review.findById(review._id).populate(
      "userId",
      "fullName profilePicture address currentJobTitle role",
    );

    const projectTitle = project?.projectTitle || "your project";
    await emitReviewNotification({
      recipientId: candidateId,
      actor: reviewer,
      type: "project_review_received",
      message: `${reviewer.fullName || "A user"} reviewed your project "${projectTitle}".`,
      targetPath: `/candidate/${candidateId}#projects`,
    });

    res.status(201).json({
      success: true,
      message: "Project review submitted successfully",
      review: buildReviewPayload(savedReview, savedReview.userId),
    });
  } catch (error) {
    console.error("Submit project review error:", error);
    res.status(500).json({
      success: false,
      message: "Server error submitting project review",
      error: error.message,
    });
  }
};

const getMyProjectReview = async (req, res) => {
  try {
    const { candidateId, projectId } = req.params;
    const userId = req.user.id;

    const candidate = await User.findById(candidateId).select(
      "role profileVisibility",
    );
    if (!candidate || candidate.role !== "candidate") {
      return res.status(404).json({
        success: false,
        message: "Candidate not found",
      });
    }

    if (
      candidate.profileVisibility === "private" &&
      String(candidateId) !== String(userId)
    ) {
      const viewer = await User.findById(userId).select("role").lean();
      const isAdmin = viewer?.role === "admin";
      if (!isAdmin) {
        const connected = await areUsersConnected(userId, candidateId);
        if (!connected) {
          return res.status(403).json({
            success: false,
            message: "This candidate profile is private.",
          });
        }
      }
    }

    const review = await Review.findOne({
      targetType: "project",
      candidateId,
      projectId,
      userId,
      isDeleted: false,
    }).populate("userId", "fullName profilePicture address currentJobTitle role");

    if (!review) {
      return res.status(404).json({
        success: false,
        message: "You haven't reviewed this project yet",
      });
    }

    res.status(200).json({
      success: true,
      review: buildReviewPayload(review, review.userId),
    });
  } catch (error) {
    console.error("Get my project review error:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching your project review",
      error: error.message,
    });
  }
};

// Update a review
const updateReview = async (req, res, next) => {
  try {
    const { reviewId } = req.params;
    const { rating, title, description, reviewerRole } = req.body;
    const userId = req.user.id;

    // Find the review
    const review = await Review.findOne({
      _id: reviewId,
      userId,
      isDeleted: false,
    });

    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Review not found or you don't have permission to edit it",
      });
    }

    // Validate rating if provided
    if (rating !== undefined && (rating < 1 || rating > 5)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid rating (1-5)",
      });
    }

    // Validate description if provided
    if (description !== undefined && description.trim().length < 10) {
      return res.status(400).json({
        success: false,
        message: "Review description must be at least 10 characters",
      });
    }

    // Update fields
    if (rating !== undefined) review.rating = rating;
    if (title !== undefined) review.title = title || "";
    if (description !== undefined) review.description = description.trim();
    if (reviewerRole !== undefined) review.reviewerRole = reviewerRole || "";

    await review.save();

    // Get updated review with populated user data
    const updatedReview = await Review.findById(review._id).populate(
      "userId",
      "fullName profilePicture address currentJobTitle role",
    );

    res.status(200).json({
      success: true,
      message: "Review updated successfully",
      review: {
        id: updatedReview._id,
        rating: updatedReview.rating,
        text: updatedReview.description,
        title: updatedReview.title,
        reviewerName: updatedReview.userId.fullName,
        reviewerLocation: updatedReview.userId.address || "Unknown",
        reviewerRole: updatedReview.reviewerRole,
        reviewerUserType: updatedReview.userId.role || "",
        date: new Date(updatedReview.createdAt).toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        }),
        reviewerAvatar: updatedReview.userId.profilePicture
          ? updatedReview.userId.profilePicture.startsWith("http")
            ? updatedReview.userId.profilePicture
            : `http://localhost:5000${updatedReview.userId.profilePicture}`
          : "",
        status: updatedReview.status,
      },
    });
  } catch (error) {
    console.error("Update review error:", error);
    res.status(500).json({
      success: false,
      message: "Server error updating review",
      error: error.message,
    });
  }
};

// Delete a review by user
const deleteReview = async (req, res, next) => {
  try {
    const { reviewId } = req.params;
    const userId = req.user.id;

    const review = await Review.findOneAndDelete({
      _id: reviewId,
      userId,
      isDeleted: false,
    });

    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Review not found or you don't have permission to delete it",
      });
    }

    res.status(200).json({
      success: true,
      message: "Review deleted successfully",
    });
  } catch (error) {
    console.error("Delete review error:", error);
    res.status(500).json({
      success: false,
      message: "Server error deleting review",
      error: error.message,
    });
  }
};

// Export all functions
module.exports = {
  getCompanyReviews,
  getCompanyReviewsForRecruiter,
  updateReviewStatus,
  deleteReviewByRecruiter,
  submitReview,
  getProjectReviews,
  getProjectReviewsForCandidate,
  submitProjectReview,
  getMyProjectReview,
  getMyReview,
  updateReview,
  deleteReview,
};
