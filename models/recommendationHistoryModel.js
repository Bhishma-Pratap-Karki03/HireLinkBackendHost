const mongoose = require("mongoose");

// One recommended job item inside a single recommendation run.
const recommendationItemSchema = new mongoose.Schema(
  {
    jobId: { type: String, required: true }, // Recommended job id
    jobTitle: { type: String, default: "" }, // Job title
    companyName: { type: String, default: "" }, // Company name
    location: { type: String, default: "" }, // Job location
    jobType: { type: String, default: "" }, // Full-time / Part-time / etc.
    workMode: { type: String, default: "" }, // Remote / Hybrid / On-site
    score: { type: Number, default: 0 }, // Overall recommendation score
    skillMatchPercent: { type: Number, default: 0 }, // Skill match %
    matchedSkills: { type: [String], default: [] }, // Skills found in profile
    missingSkills: { type: [String], default: [] }, // Skills not matched
    reasons: { type: [String], default: [] }, // Explanation lines shown in UI
  },
  { _id: false },
);

// Stores one full recommendation run for one candidate.
const recommendationHistorySchema = new mongoose.Schema(
  {
    candidate: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    recommendations: {
      type: [recommendationItemSchema],
      default: [],
    },
  },
  { timestamps: true },
);

// RecommendationHistory collection.
module.exports = mongoose.model("RecommendationHistory", recommendationHistorySchema);
