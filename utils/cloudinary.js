 const cloudinary = require("cloudinary").v2;
const path = require("path");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadFileToCloudinary = async (filePath, options = {}) => {
  return cloudinary.uploader.upload(filePath, options);
};

const deleteFromCloudinary = async (publicId, options = {}) => {
  if (!publicId) return null;
  return cloudinary.uploader.destroy(publicId, options);
};

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
    publicParts[publicParts.length - 1] = path.basename(last, path.extname(last));

    return publicParts.join("/");
  } catch (_error) {
    return "";
  }
};

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
  uploadFileToCloudinary,
  deleteFromCloudinary,
  extractPublicIdFromCloudinaryUrl,
  normalizeCloudinaryDocumentUrl,
};
