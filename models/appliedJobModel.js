const mongoose = require("mongoose");

// Stores one job application submitted by a candidate.
const appliedJobSchema = new mongoose.Schema(
  {
    // Candidate who applied for the job.
    candidate: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // Job post that was applied to.
    job: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "JobPost",
      required: true,
    },
    // Snapshot fields to keep application details stable.
    jobTitle: { type: String, required: true },
    companyName: { type: String, required: true },
    resumeUrl: { type: String, required: true },
    resumeFileName: { type: String, required: true },
    resumeFileSize: { type: Number, required: true },
    message: { type: String, default: "" },
    // Recruiter-facing application status.
    status: {
      type: String,
      enum: ["submitted", "reviewed", "shortlisted", "interview", "rejected", "hired"],
      default: "submitted",
    },
    // ATS result fields (filled after ATS run).
    atsScore: { type: Number, default: null },
    atsReport: { type: mongoose.Schema.Types.ObjectId, ref: "AtsReport", default: null },
  },
  { timestamps: true }
);

// AppliedJob collection.
module.exports = mongoose.model("AppliedJob", appliedJobSchema);
