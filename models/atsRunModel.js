const mongoose = require("mongoose");

// Stores one ATS execution event for a job.
const atsRunSchema = new mongoose.Schema(
  {
    // Job and recruiter who triggered this run.
    job: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "JobPost",
      required: true,
      index: true,
    },
    recruiter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // Run mode: all applicants or only new ones.
    mode: {
      type: String,
      enum: ["all", "new"],
      default: "all",
    },
    // Current run status.
    status: {
      type: String,
      enum: ["running", "completed", "failed"],
      default: "running",
    },
    // Run statistics.
    totalApplications: { type: Number, default: 0 },
    processed: { type: Number, default: 0 },
    successful: { type: Number, default: 0 },
    failed: { type: Number, default: 0 },
    skipped: { type: Number, default: 0 },
    errorMessage: { type: String, default: "" },
  },
  { timestamps: true }
);

// AtsRun collection.
module.exports = mongoose.model("AtsRun", atsRunSchema);
