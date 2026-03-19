const mongoose = require("mongoose");

// Stores company reviews and project reviews.
const reviewSchema = new mongoose.Schema(
  {
    // Decides whether this review targets a company or a project.
    targetType: {
      type: String,
      enum: ["company", "project"],
      default: "company",
      index: true,
    },
    // Company review target.
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    // Candidate owner in project review context.
    candidateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    // Project review target.
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      required: false,
    },
    // Reviewer user id.
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // Review content.
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    title: {
      type: String,
      trim: true,
      default: "",
    },
    description: {
      type: String,
      trim: true,
      required: true,
    },
    // Reviewer display info snapshot.
    reviewerName: {
      type: String,
      trim: true,
      required: true,
    },
    reviewerLocation: {
      type: String,
      trim: true,
      default: "",
    },
    reviewerRole: {
      type: String,
      trim: true,
      default: "",
    },
    // Moderation and visibility flags.
    isApproved: {
      type: Boolean,
      default: true,
    },
    status: {
      type: String,
      enum: ["published", "hidden"],
      default: "published",
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    toJSON: {
      // Returns cleaner API response fields.
      transform: function (doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  },
);

// Prevent duplicate review per user per company/project.
reviewSchema.index(
  { targetType: 1, companyId: 1, userId: 1 },
  { unique: true, partialFilterExpression: { targetType: "company" } },
);
reviewSchema.index(
  { targetType: 1, projectId: 1, userId: 1 },
  { unique: true, partialFilterExpression: { targetType: "project" } },
);

// Indexes for fast review listing and filtering.
reviewSchema.index({ targetType: 1, companyId: 1, isApproved: 1, createdAt: -1 });
reviewSchema.index({ targetType: 1, companyId: 1, status: 1, createdAt: -1 });
reviewSchema.index({ targetType: 1, projectId: 1, status: 1, createdAt: -1 });

const Review = mongoose.model("Review", reviewSchema);

module.exports = Review;
