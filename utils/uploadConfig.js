// Shared Upload Configuration Utilities
// Centralizes multer configuration to avoid code duplication

const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Base upload directory
const UPLOAD_BASE = path.join(__dirname, "..", "public", "uploads");

// Allowed image MIME types
const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
];

// Allowed document MIME types
const ALLOWED_DOCUMENT_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

// Allowed document extensions
const ALLOWED_DOCUMENT_EXTENSIONS = [".pdf", ".doc", ".docx"];

/**
 * Create multer storage configuration for temporary uploads
 * @param {string} tempSubdir - Subdirectory within temp folder (e.g., "profiles", "resumes")
 * @param {boolean} sanitizeFilename - Whether to sanitize filename (for documents)
 * @returns {Object} Multer diskStorage configuration
 */
const createTempStorage = (tempSubdir, sanitizeFilename = false) => {
  return multer.diskStorage({
    destination: function (req, file, cb) {
      const uploadDir = path.join(UPLOAD_BASE, tempSubdir, "temp");

      // Create directory if it doesn't exist
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      const ext = path.extname(file.originalname);

      if (sanitizeFilename) {
        // For documents, sanitize the original filename
        const sanitizedName = file.originalname
          .replace(ext, "")
          .replace(/[^a-zA-Z0-9]/g, "-")
          .toLowerCase();
        cb(null, `${tempSubdir}-${sanitizedName}-${uniqueSuffix}${ext}`);
      } else {
        // For images, use simple naming
        cb(null, `${tempSubdir}-${uniqueSuffix}${ext}`);
      }
    },
  });
};

/**
 * Create file filter for images
 * @returns {Function} Multer file filter function
 */
const createImageFilter = () => {
  return (req, file, cb) => {
    if (ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      req.fileValidationError =
        "Only image files are allowed (JPG, JPEG, PNG, WEBP, GIF)";
      cb(new Error("Only image files are allowed"), false);
    }
  };
};

/**
 * Create file filter for documents (PDF, DOC, DOCX)
 * @returns {Function} Multer file filter function
 */
const createDocumentFilter = () => {
  return (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();

    if (
      ALLOWED_DOCUMENT_TYPES.includes(file.mimetype) &&
      ALLOWED_DOCUMENT_EXTENSIONS.includes(ext)
    ) {
      cb(null, true);
    } else {
      req.fileValidationError =
        "Only PDF, DOC, and DOCX files are allowed (Max size: 5MB)";
      cb(new Error("Invalid file type"), false);
    }
  };
};

/**
 * Create multer instance for image uploads
 * @param {string} tempSubdir - Subdirectory for temp storage
 * @param {number} maxSizeMB - Maximum file size in MB (default: 5)
 * @returns {Object} Configured multer instance
 */
const createImageUpload = (tempSubdir, maxSizeMB = 5) => {
  return multer({
    storage: createTempStorage(tempSubdir),
    fileFilter: createImageFilter(),
    limits: {
      fileSize: maxSizeMB * 1024 * 1024,
    },
  });
};

/**
 * Create multer instance for document uploads
 * @param {string} tempSubdir - Subdirectory for temp storage
 * @param {number} maxSizeMB - Maximum file size in MB (default: 5)
 * @returns {Object} Configured multer instance
 */
const createDocumentUpload = (tempSubdir, maxSizeMB = 5) => {
  return multer({
    storage: createTempStorage(tempSubdir, true), // Sanitize filename for documents
    fileFilter: createDocumentFilter(),
    limits: {
      fileSize: maxSizeMB * 1024 * 1024,
    },
  });
};

/**
 * Error handling middleware for multer uploads
 * Handles file size errors and validation errors
 */
const handleMulterError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        message: "File size too large. Maximum size is 5MB",
        code: "FILE_TOO_LARGE",
      });
    }
    return res.status(400).json({
      success: false,
      message: error.message,
      code: "UPLOAD_ERROR",
    });
  }

  if (error && error.message) {
    if (
      error.message.includes("Only image files are allowed") ||
      error.message.includes("Invalid file type")
    ) {
      return res.status(400).json({
        success: false,
        message: req.fileValidationError || error.message,
        code: "INVALID_FILE_TYPE",
      });
    }
  }

  next(error);
};

/**
 * Middleware to check for file validation errors
 * Should be used after multer middleware
 */
const checkFileValidation = (req, res, next) => {
  if (req.fileValidationError) {
    return res.status(400).json({
      success: false,
      message: req.fileValidationError,
      code: "FILE_VALIDATION_ERROR",
    });
  }
  next();
};


/**
 * Create multer instance for direct document uploads (no temp folder)
 * @param {string} subdir - Subdirectory within uploads (e.g., "appliedresume")
 * @param {number} maxSizeMB - Maximum file size in MB (default: 5)
 * @returns {Object} Configured multer instance
 */
const createDirectDocumentUpload = (subdir, maxSizeMB = 5) => {
  const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      const uploadDir = path.join(UPLOAD_BASE, subdir);
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      const ext = path.extname(file.originalname);
      const sanitizedName = file.originalname
        .replace(ext, "")
        .replace(/[^a-zA-Z0-9]/g, "-")
        .toLowerCase();
      cb(null, `${subdir}-${sanitizedName}-${uniqueSuffix}${ext}`);
    },
  });

  return multer({
    storage,
    fileFilter: createDocumentFilter(),
    limits: {
      fileSize: maxSizeMB * 1024 * 1024,
    },
  });
};

module.exports = {
  createImageUpload,
  createDocumentUpload,
  createDirectDocumentUpload,
  handleMulterError,
  checkFileValidation,
  UPLOAD_BASE,
  ALLOWED_IMAGE_TYPES,
  ALLOWED_DOCUMENT_TYPES,
};
