const cloudinary = require("cloudinary").v2;

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

module.exports = {
  cloudinary,
  uploadFileToCloudinary,
  deleteFromCloudinary,
};
