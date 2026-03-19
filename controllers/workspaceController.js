// Workspace Controller handles workspace gallery HTTP requests
// Uses Workspace Service for business logic

const workspaceService = require("../services/workspaceService");
const fs = require("fs");
const {
  uploadFileToCloudinary,
  extractPublicIdFromCloudinaryUrl,
} = require("../utils/cloudinary");

// Upload workspace image
exports.uploadWorkspaceImage = async (req, res, next) => {
  let tempFileCleaned = false;

  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
        code: "NO_FILE",
      });
    }

    if (!fs.existsSync(req.file.path)) {
      return res.status(500).json({
        success: false,
        message: "Uploaded file not found",
        code: "FILE_NOT_FOUND",
      });
    }

    const uploaded = await uploadFileToCloudinary(req.file.path, {
      folder: "hirelink/workspace-images",
      resource_type: "image",
      use_filename: true,
      unique_filename: true,
    });

    tempFileCleaned = true;
    fs.unlinkSync(req.file.path);

    const imageUrl = uploaded.secure_url;
    const imagePublicId =
      uploaded.public_id || extractPublicIdFromCloudinaryUrl(uploaded.secure_url);

    const fileData = {
      file: req.file,
      imageUrl,
      imagePublicId,
    };

    // Call service to handle business logic
    const result = await workspaceService.uploadWorkspaceImage(
      req.user.id,
      fileData
    );

    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    // Clean up temp file if it exists and wasn't already cleaned
    if (req.file && req.file.path && !tempFileCleaned) {
      try {
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
      } catch (cleanupError) {
        console.error("Error cleaning up temp file:", cleanupError);
      }
    }

    next(error);
  }
};

// Get workspace images
exports.getWorkspaceImages = async (req, res, next) => {
  try {
    const result = await workspaceService.getWorkspaceImages(req.user.id);

    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

// Delete workspace image
exports.deleteWorkspaceImage = async (req, res, next) => {
  try {
    const result = await workspaceService.deleteWorkspaceImage(
      req.user.id,
      req.params.imageId
    );

    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

// Reorder workspace images
exports.reorderWorkspaceImages = async (req, res, next) => {
  try {
    const { imageOrder } = req.body;

    const result = await workspaceService.reorderWorkspaceImages(
      req.user.id,
      imageOrder
    );

    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};
