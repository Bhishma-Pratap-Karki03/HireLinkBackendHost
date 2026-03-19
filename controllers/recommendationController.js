// MongoDB models
const User = require("../models/userModel");
const RecommendationHistory = require("../models/recommendationHistoryModel");
const JobPost = require("../models/jobPostModel");

// Recommendation service (calls ML logic)
const {
  getRecommendationsForCandidate,
} = require("../services/recommendationService");

/* 
   Helper Function
   Ensures the logged-in user exists and is a candidate
   Blocks admin and non-candidate users from accessing recommendations
*/
const ensureCandidateUser = async (userId) => {
  // Fetch user from database
  const me = await User.findById(userId).lean();

  // If user does not exist
  if (!me) {
    return { error: { status: 404, message: "User not found" } };
  }

  // Special case: Prevent admin email from using recommendation system
  const isAdminEmail = me.email === "hirelinknp@gmail.com";
  const role = isAdminEmail ? "admin" : me.role;

  // Only allow users with role "candidate"
  if (role !== "candidate") {
    return {
      error: {
        status: 403,
        message: "Only candidates can access recommendations",
      },
    };
  }

  return { user: me };
};

/* 
   Controller: Run AI Recommendation
   Generates smart job recommendations for the logged-in candidate
*/
exports.getMyRecommendations = async (req, res) => {
  try {
    const userId = req.user.id; // Extract userId from JWT middleware

    // Verify candidate access
    const check = await ensureCandidateUser(userId);
    if (check.error) {
      return res.status(check.error.status).json({
        success: false,
        message: check.error.message,
      });
    }

    // Get limit from query parameter (default = 10)
    const limit = Number(req.query.limit || 10);

    // Call service layer to generate recommendations using ML
    const recommendations = await getRecommendationsForCandidate(userId, limit);

    // Save recommendation run into history collection
    await RecommendationHistory.create({
      candidate: userId,
      recommendations,
    });

    // Return recommendation result
    return res.status(200).json({
      success: true,
      count: recommendations.length,
      recommendations,
    });
  } catch (error) {
    console.error("Recommendation error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to generate recommendations",
      error: error.message,
    });
  }
};

/* 
   Controller: Get Recommendation History (List View)
   Returns last 30 recommendation runs (summary only)
*/
exports.getRecommendationHistory = async (req, res) => {
  try {
    const userId = req.user.id;

    // Verify candidate access
    const check = await ensureCandidateUser(userId);
    if (check.error) {
      return res.status(check.error.status).json({
        success: false,
        message: check.error.message,
      });
    }

    // Fetch latest 30 history records for candidate
    const history = await RecommendationHistory.find({ candidate: userId })
      .sort({ createdAt: -1 }) // Newest first
      .limit(30)
      .lean();

    // Return summarized history data
    return res.status(200).json({
      success: true,
      count: history.length,
      history: history.map((item) => ({
        id: String(item._id),
        createdAt: item.createdAt,
        count: item.recommendations?.length || 0,
      })),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to load recommendation history",
      error: error.message,
    });
  }
};

/* 
   Controller: Get Single Recommendation History (Detail View)
   Returns full recommendation list for a specific run
*/
exports.getRecommendationHistoryById = async (req, res) => {
  try {
    const userId = req.user.id;

    // Verify candidate access
    const check = await ensureCandidateUser(userId);
    if (check.error) {
      return res.status(check.error.status).json({
        success: false,
        message: check.error.message,
      });
    }

    // Find specific history record belonging to candidate
    const history = await RecommendationHistory.findOne({
      _id: req.params.id,
      candidate: userId,
    }).lean();

    if (!history) {
      return res.status(404).json({
        success: false,
        message: "Recommendation history not found",
      });
    }

    const storedRecommendations = history.recommendations || [];

    // Extract jobIds from stored recommendations
    const jobIds = storedRecommendations
      .map((item) => item?.jobId)
      .filter(Boolean);

    let jobMap = new Map();

    // Fetch related job posts to enrich companyLogo if needed
    if (jobIds.length > 0) {
      const jobs = await JobPost.find({ _id: { $in: jobIds } })
        .populate("recruiterId", "profilePicture")
        .select("_id companyLogo recruiterId")
        .lean();

      jobMap = new Map(
        jobs.map((job) => [
          String(job._id),
          job.companyLogo || job.recruiterId?.profilePicture || "",
        ]),
      );
    }

    // Attach companyLogo to recommendation items
    const recommendations = storedRecommendations.map((item) => ({
      ...item,
      companyLogo: item.companyLogo || jobMap.get(String(item.jobId)) || "",
    }));

    return res.status(200).json({
      success: true,
      id: String(history._id),
      createdAt: history.createdAt,
      count: recommendations.length,
      recommendations,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to load recommendation history details",
      error: error.message,
    });
  }
};

/* 
   Controller: Delete Recommendation History
   Deletes a specific recommendation run for candidate
*/
exports.deleteRecommendationHistory = async (req, res) => {
  try {
    const userId = req.user.id;

    // Verify candidate access
    const check = await ensureCandidateUser(userId);
    if (check.error) {
      return res.status(check.error.status).json({
        success: false,
        message: check.error.message,
      });
    }

    // Delete history only if it belongs to candidate
    const deleted = await RecommendationHistory.findOneAndDelete({
      _id: req.params.id,
      candidate: userId,
    });

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Recommendation history not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Recommendation history deleted",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to delete recommendation history",
      error: error.message,
    });
  }
};
