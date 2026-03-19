const fs = require("fs");
const path = require("path");
const multer = require("multer");

const uploadDir = path.join(
  __dirname,
  "..",
  "public",
  "uploads",
  "assessment-submissions",
);

const allowedExtensions = new Set([".pdf", ".doc", ".docx", ".zip"]);
const allowedMimeTypes = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/zip",
  "application/x-zip-compressed",
  "multipart/x-zip",
]);

const ensureUploadDir = () => {
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    ensureUploadDir();
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const base = path
      .basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9-_]/g, "-")
      .replace(/-+/g, "-")
      .toLowerCase()
      .slice(0, 80);
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `submission-${base || "file"}-${unique}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname || "").toLowerCase();
  if (!allowedExtensions.has(ext) || !allowedMimeTypes.has(file.mimetype)) {
    req.fileValidationError =
      "Only PDF, DOC, DOCX, or ZIP files are allowed (max 10MB).";
    return cb(new Error("Invalid submission file type"), false);
  }
  return cb(null, true);
};

const submissionUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 },
});

const handleSubmissionUploadError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        message: "Submission file is too large. Maximum size is 10MB.",
      });
    }
    return res.status(400).json({
      success: false,
      message: error.message || "Invalid submission upload request.",
    });
  }
  if (req.fileValidationError || error?.message === "Invalid submission file type") {
    return res.status(400).json({
      success: false,
      message:
        req.fileValidationError ||
        "Only PDF, DOC, DOCX, or ZIP files are allowed (max 10MB).",
    });
  }
  return next(error);
};

module.exports = {
  submissionUpload,
  handleSubmissionUploadError,
};
