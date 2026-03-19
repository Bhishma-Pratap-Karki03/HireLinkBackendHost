const express = require("express");
const cors = require("cors");
const path = require("path");
const app = express();
const userRoutes = require("./routes/userRoutes");
const verificationRoutes = require("./routes/verificationRoutes");
const passwordRoutes = require("./routes/passwordRoutes");
const profileRoutes = require("./routes/profileRoutes");
const resumeRoutes = require("./routes/resumeRoutes");
const appliedJobRoutes = require("./routes/appliedJobRoutes");
const savedJobRoutes = require("./routes/savedJobRoutes");
const atsRoutes = require("./routes/atsRoutes");
const projectRoutes = require("./routes/projectRoutes");
const workspaceRoutes = require("./routes/workspaceRoutes");
const errorHandler = require("./middleware/errorHandler");
const employerRoutes = require("./routes/employerRoutes");
const reviewRoutes = require("./routes/reviewRoutes");
const jobPostRoutes = require("./routes/jobPostRoutes");
const assessmentRoutes = require("./routes/assessmentRoutes");
const recruiterAssessmentRoutes = require("./routes/recruiterAssessmentRoutes");
const connectionRequestRoutes = require("./routes/connectionRequestRoutes");
const messageRoutes = require("./routes/messageRoutes");
const recommendationRoutes = require("./routes/recommendationRoutes");
const contactRoutes = require("./routes/contactRoutes");

// CORS configuration
const allowedOrigins = process.env.CLIENT_URL
  ? process.env.CLIENT_URL.split(",")
  : ["http://localhost:5173"];

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

// Parse JSON bodies
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Serve static files from public/uploads directory
app.use("/uploads", express.static(path.join(__dirname, "public/uploads")));

// API Routes
app.use("/api/users", userRoutes);
app.use("/api/verify", verificationRoutes);
app.use("/api/password", passwordRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/resume", resumeRoutes);
app.use("/api/applications", appliedJobRoutes);
app.use("/api/saved-jobs", savedJobRoutes);
app.use("/api/ats", atsRoutes);
app.use("/api/project", projectRoutes);
app.use("/api/workspace", workspaceRoutes);
app.use("/api/employers", employerRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/jobs", jobPostRoutes);
app.use("/api/assessments", assessmentRoutes);
app.use("/api/recruiter-assessments", recruiterAssessmentRoutes);
app.use("/api/connections", connectionRequestRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/recommendations", recommendationRoutes);
app.use("/api/contact", contactRoutes);

app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Server is running",
  });
});

// 404 handler for API routes
app.use("/api/*", (req, res) => {
  res.status(404).json({
    success: false,
    message: "API endpoint not found",
    code: "NOT_FOUND",
  });
});

// Global error handler middleware (must be last)
app.use(errorHandler);

module.exports = app;
