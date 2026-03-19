const mongoose = require("mongoose");

// One interview stage in a job hiring process.
const interviewStageSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, required: true },
    salary: { type: String, trim: true, default: "" },
  },
  { _id: false },
);

// Main schema for recruiter job postings.
const jobPostSchema = new mongoose.Schema(
  {
    // Recruiter owner of this job post.
    recruiterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // Basic job info.
    contactEmail: { type: String, trim: true, default: "" },
    jobTitle: { type: String, trim: true, required: true },
    department: { type: String, trim: true, required: true },
    location: { type: String, trim: true, required: true },
    workMode: {
      type: String,
      enum: ["remote", "on-site", "hybrid"],
      required: true,
    },
    gender: {
      type: String,
      enum: ["male", "female", "both"],
      required: true,
    },
    // Requirement and compensation details.
    jobLevel: { type: String, trim: true, required: true },
    jobType: { type: String, trim: true, required: true },
    openings: { type: Number, min: 1, required: true },
    deadline: { type: Date, required: true },
    description: { type: String, default: "" },
    responsibilities: [{ type: String, trim: true }],
    requirements: [{ type: String, trim: true }],
    requiredSkills: [{ type: String, trim: true }],
    experience: { type: String, trim: true, default: "" },
    education: { type: String, trim: true, default: "" },
    salaryFrom: { type: String, trim: true, required: true },
    salaryTo: { type: String, trim: true, required: true },
    currency: { type: String, trim: true, required: true },
    benefits: [{ type: String, trim: true }],
    // Hiring process and optional assessment setup.
    interviewStages: [interviewStageSchema],
    assessmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Assessment",
      default: null,
    },
    assessmentRequired: { type: Boolean, default: false },
    assessmentSource: {
      type: String,
      enum: ["admin", "recruiter"],
      default: "recruiter",
    },
    // Publishing state.
    status: {
      type: String,
      enum: ["draft", "published"],
      default: "published",
    },
    isActive: { type: Boolean, default: true },
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

// JobPost collection.
module.exports = mongoose.model("JobPost", jobPostSchema);
