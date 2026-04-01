const cloudinary = require("cloudinary").v2;
const fs = require("fs");
const path = require("path");

// Storage mode toggle: "cloudinary" (default) or "local".
const STORAGE_MODE = String(process.env.STORAGE_MODE || "cloudinary")
  .trim()
  .toLowerCase();

// Configure Cloudinary (used when STORAGE_MODE=cloudinary).
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const PUBLIC_UPLOADS_ROOT = path.join(__dirname, "..", "public", "uploads");

const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

const sanitizeSegment = (segment = "") =>
  String(segment)
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

const toLocalRelativeFolder = (folder = "") => {
  const normalized = String(folder || "")
    .replace(/^\/+|\/+$/g, "")
    .split("/")
    .map(sanitizeSegment)
    .filter(Boolean)
    .join("/");

  return normalized || "misc";
};

const buildUniqueName = (sourcePath) => {
  const ext = path.extname(sourcePath || "");
  const base = path.basename(sourcePath || "file", ext) || "file";
  const suffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
  return `${sanitizeSegment(base)}-${suffix}${ext}`;
};

const toUploadsUrl = (absolutePath) => {
  const relative = path
    .relative(PUBLIC_UPLOADS_ROOT, absolutePath)
    .replace(/\\/g, "/");
  return `/uploads/${relative}`;
};

const resolveLocalTarget = ({ filePath, folder = "" }) => {
  const safeFolder = toLocalRelativeFolder(folder);
  const folderPath = path.join(PUBLIC_UPLOADS_ROOT, safeFolder);
  ensureDir(folderPath);

  const fileName = buildUniqueName(filePath);
  const absoluteTarget = path.join(folderPath, fileName);
  const secureUrl = toUploadsUrl(absoluteTarget);
  const publicId = `uploads/${safeFolder}/${fileName}`.replace(/\\/g, "/");

  return { absoluteTarget, secureUrl, publicId };
};

const uploadFileToLocal = async (filePath, options = {}) => {
  const { absoluteTarget, secureUrl, publicId } = resolveLocalTarget({
    filePath,
    folder: options.folder,
  });

  // Keep source temp file as-is; controllers/services already clean temp after upload.
  fs.copyFileSync(filePath, absoluteTarget);

  return {
    secure_url: secureUrl,
    public_id: publicId,
    resource_type: options.resource_type || "auto",
  };
};

const localPathFromPublicIdOrUrl = (value = "") => {
  if (!value || typeof value !== "string") return "";

  if (value.startsWith("/uploads/")) {
    return path.join(__dirname, "..", "public", value.replace(/^\//, ""));
  }

  if (value.startsWith("uploads/")) {
    return path.join(__dirname, "..", "public", value);
  }

  return "";
};

// Upload helper used by controllers/services.
const uploadFileToCloudinary = async (filePath, options = {}) => {
  if (STORAGE_MODE === "local") {
    return uploadFileToLocal(filePath, options);
  }
  return cloudinary.uploader.upload(filePath, options);
};

// Delete helper used by controllers/services.
const deleteFromCloudinary = async (publicId, options = {}) => {
  if (!publicId) return null;

  if (STORAGE_MODE === "local") {
    const localPath = localPathFromPublicIdOrUrl(publicId);
    if (!localPath) return { result: "not_found" };
    if (fs.existsSync(localPath)) {
      fs.unlinkSync(localPath);
      return { result: "ok" };
    }
    return { result: "not_found" };
  }

  return cloudinary.uploader.destroy(publicId, options);
};

// Extract Cloudinary public id from URL.
const extractPublicIdFromCloudinaryUrl = (url = "") => {
  if (!url || typeof url !== "string" || !url.includes("res.cloudinary.com")) {
    return "";
  }

  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split("/").filter(Boolean);
    const uploadIndex = parts.findIndex((part) => part === "upload");
    if (uploadIndex === -1 || uploadIndex >= parts.length - 1) {
      return "";
    }

    let publicParts = parts.slice(uploadIndex + 1);

    if (/^v\d+$/.test(publicParts[0])) {
      publicParts = publicParts.slice(1);
    }

    if (!publicParts.length) return "";

    const last = publicParts[publicParts.length - 1];
    publicParts[publicParts.length - 1] = path.basename(
      last,
      path.extname(last),
    );

    return publicParts.join("/");
  } catch (_error) {
    return "";
  }
};

// Convert cloudinary image URL to raw URL for document preview/download.
const normalizeCloudinaryDocumentUrl = (url = "") => {
  if (!url || typeof url !== "string" || !url.includes("res.cloudinary.com")) {
    return url || "";
  }

  const isDocument = /\.(pdf|doc|docx|zip)$/i.test(url);
  if (!isDocument) return url;

  return url.replace("/image/upload/", "/raw/upload/");
};

module.exports = {
  cloudinary,
  STORAGE_MODE,
  uploadFileToCloudinary,
  deleteFromCloudinary,
  extractPublicIdFromCloudinaryUrl,
  normalizeCloudinaryDocumentUrl,
};
