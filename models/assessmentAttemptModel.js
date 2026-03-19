const mongoose = require("mongoose");

// Stores one candidate attempt for an assessment.
const assessmentAttemptSchema = new mongoose.Schema(
  {
    // Assessment reference and where it came from.
    assessment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Assessment",
      required: true,
    },
    assessmentSource: {
      type: String,
      enum: ["admin", "recruiter"],
      default: "admin",
    },
    // Candidate who is attempting the assessment.
    candidate: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // Attempt details and lifecycle status.
    attemptNumber: { type: Number, required: true, min: 1 },
    status: {
      type: String,
      enum: ["in_progress", "submitted"],
      default: "in_progress",
    },
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    submittedAt: { type: Date },
    // Final score for this attempt.
    score: { type: Number, default: 0 },
    // Different answer fields based on assessment type.
    answers: {
      quizAnswers: [{ type: Number }],
      writingResponse: { type: String, default: "" },
      writingLink: { type: String, default: "" },
      codeResponse: { type: String, default: "" },
      codeLink: { type: String, default: "" },
      codeFileUrl: { type: String, default: "" },
      codeFileName: { type: String, default: "" },
      codeFileMimeType: { type: String, default: "" },
      codeFileSize: { type: Number, default: 0 },
    },
  },
  { timestamps: true },
);

// AssessmentAttempt collection.
module.exports = mongoose.model("AssessmentAttempt", assessmentAttemptSchema);
