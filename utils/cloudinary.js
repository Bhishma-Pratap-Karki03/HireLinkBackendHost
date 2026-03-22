const cloudinary = require("cloudinary").v2;
const path = require("path");

//configure cloudinary with environment variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// uploads the file to cloudinary and returns the result
//returns secure_url, public_id, and other details about the uploaded file
const uploadFileToCloudinary = async (filePath, options = {}) => {
  return cloudinary.uploader.upload(filePath, options);
};

// This deletes a file from cloudinary using its public_id. It returns the result of the deletion operation, which includes details about the deleted file or an error if the deletion fails.
const deleteFromCloudinary = async (publicId, options = {}) => {
  // if pubic id is missing the function simply returns null instead of attempting to delete anything, preventing unnecessary API calls and potential errors.
  if (!publicId) return null;
  return cloudinary.uploader.destroy(publicId, options);
};

//extracts the public id from the URL
const extractPublicIdFromCloudinaryUrl = (url = "") => {
  // Validate input checks URL exsists, it is string, it is a cloudinary url
  if (!url || typeof url !== "string" || !url.includes("res.cloudinary.com")) {
    return "";
  }

  try {
    const parsed = new URL(url);
    // breaks down the url into the array parts.
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
// Documents like resume PDFs may fail to open if URL uses /image/upload/ instead of /raw/upload/.
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
