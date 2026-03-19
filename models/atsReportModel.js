const mongoose = require("mongoose");

// Stores ATS scoring output for one application.
const atsReportSchema = new mongoose.Schema(
  {
    // References used for report lookup and linking.
    job: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "JobPost",
      required: true,
    },
    application: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AppliedJob",
      required: true,
    },
    candidate: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // Parsed resume information.
    extracted: {
      skills: [{ type: String }],
      emails: [{ type: String }],
      phones: [{ type: String }],
      experienceYears: { type: Number, default: 0 },
      educationLevel: { type: String, default: "" },
      educationRank: { type: Number, default: 0 },
    },
    // Matching details against job requirements.
    matchedSkills: [{ type: String }],
    missingSkills: [{ type: String }],
    experienceMatch: { type: Boolean, default: false },
    educationMatch: { type: Boolean, default: false },
    // Score breakdown and final score.
    skillsScore: { type: Number, default: 0 },
    experienceScore: { type: Number, default: 0 },
    educationScore: { type: Number, default: 0 },
    score: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// AtsReport collection.
module.exports = mongoose.model("AtsReport", atsReportSchema);
