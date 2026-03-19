const mongoose = require("mongoose");

// Stores jobs bookmarked/saved by a candidate.
const savedJobSchema = new mongoose.Schema(
  {
    // Candidate who saved the job.
    candidate: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // Saved job reference.
    job: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "JobPost",
      required: true,
    },
  },
  { timestamps: true }
);

// Prevent duplicate save for the same candidate and job.
savedJobSchema.index({ candidate: 1, job: 1 }, { unique: true });

// SavedJob collection.
module.exports = mongoose.model("SavedJob", savedJobSchema);
