const mongoose = require("mongoose");

// Reusable question format for quiz-type assessments.
const quizQuestionSchema = new mongoose.Schema(
  {
    question: { type: String, required: true, trim: true },
    options: [{ type: String, required: true, trim: true }],
    correctIndex: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

// Stores admin-created assessments.
const adminAssessmentSchema = new mongoose.Schema(
  {
    // Basic assessment info.
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    type: {
      type: String,
      enum: ["quiz", "writing", "task", "code"],
      required: true,
    },
    difficulty: {
      type: String,
      enum: ["beginner", "intermediate", "advanced"],
      required: true,
    },
    // Attempt and visibility settings.
    timeLimit: { type: String, default: "" },
    maxAttempts: { type: Number, required: true, min: 1 },
    status: { type: String, enum: ["active", "inactive"], required: true },
    deadline: { type: Date },
    visibleToRecruiters: { type: Boolean, default: true },
    skillTags: [{ type: String, trim: true }],
    // Quiz content.
    quizQuestions: [quizQuestionSchema],
    // Writing assessment fields.
    writingTask: { type: String, default: "" },
    writingInstructions: { type: String, default: "" },
    writingFormat: {
      type: String,
      enum: ["text", "file", "link"],
      default: "text",
    },
    // Coding assessment fields.
    codeProblem: { type: String, default: "" },
    codeLanguages: [{ type: String, trim: true }],
    codeSubmission: { type: String, enum: ["file", "repo", "link"], default: "file" },
    codeEvaluation: { type: String, default: "" },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true },
);

// AdminAssessment collection.
module.exports = mongoose.model("AdminAssessment", adminAssessmentSchema);
