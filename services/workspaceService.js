// Workspace Service handles workspace gallery image business logic

const User = require("../models/userModel");
const path = require("path");
const fs = require("fs");
const { NotFoundError, ValidationError } = require("../utils/AppError");

const MAX_WORKSPACE_IMAGES = 6;

class WorkspaceService {
  // Upload workspace image
  async uploadWorkspaceImage(userId, fileData) {
    const { file, tempPath, targetPath, imageUrl } = fileData;

    const user = await User.findById(userId);
    if (!user) {
      throw new NotFoundError("User");
    }

    // Check if user already has maximum images
    if (
      user.workspaceImages &&
      user.workspaceImages.length >= MAX_WORKSPACE_IMAGES
    ) {
      throw new ValidationError(
        `Maximum ${MAX_WORKSPACE_IMAGES} images allowed in workspace gallery`
      );
    }

    // Create workspace image object
    const workspaceImage = {
      imageUrl,
      fileName: file.originalname,
      fileSize: file.size,
      uploadedAt: new Date(),
      order: user.workspaceImages.length, // Set order based on current count
    };

    // Add to user's workspaceImages array
    user.workspaceImages.push(workspaceImage);
    await user.save();

    // Get the added image with its ID
    const addedImage = user.workspaceImages[user.workspaceImages.length - 1];

    return {
      message: "Workspace image uploaded successfully",
      image: addedImage,
    };
  }

  // Get all workspace images for a user
  async getWorkspaceImages(userId) {
    const user = await User.findById(userId).select("workspaceImages");

    if (!user) {
      throw new NotFoundError("User");
    }

    return {
      images: user.workspaceImages || [],
    };
  }

  // Delete workspace image
  async deleteWorkspaceImage(userId, imageId) {
    const user = await User.findById(userId);
    if (!user) {
      throw new NotFoundError("User");
    }

    // Find the image to delete
    const imageIndex = user.workspaceImages.findIndex(
      (img) => img._id.toString() === imageId
    );

    if (imageIndex === -1) {
      throw new NotFoundError("Workspace image");
    }

    const imageToDelete = user.workspaceImages[imageIndex];

    // Delete the file from server
    const imagePath = path.join(
      __dirname,
      "..",
      "public",
      imageToDelete.imageUrl
    );

    if (fs.existsSync(imagePath)) {
      try {
        fs.unlinkSync(imagePath);
      } catch (error) {
        console.error("Error deleting workspace image file:", error);
      }
    }

    // Remove from array
    user.workspaceImages.splice(imageIndex, 1);

    // Reorder remaining images
    user.workspaceImages.forEach((img, index) => {
      img.order = index;
    });

    await user.save();

    return {
      message: "Workspace image deleted successfully",
    };
  }

  // Reorder workspace images
  async reorderWorkspaceImages(userId, imageOrder) {
    if (!Array.isArray(imageOrder)) {
      throw new ValidationError("Invalid image order data");
    }

    const user = await User.findById(userId);
    if (!user) {
      throw new NotFoundError("User");
    }

    // Create a map for quick lookup
    const imageMap = new Map();
    user.workspaceImages.forEach((img) => {
      imageMap.set(img._id.toString(), img);
    });

    // Recreate workspaceImages array in new order
    const reorderedImages = [];
    imageOrder.forEach((imageId, index) => {
      const image = imageMap.get(imageId);
      if (image) {
        image.order = index;
        reorderedImages.push(image);
      }
    });

    // Add any remaining images (shouldn't happen if frontend sends all IDs)
    user.workspaceImages.forEach((img) => {
      if (
        !reorderedImages.find((ri) => ri._id.toString() === img._id.toString())
      ) {
        img.order = reorderedImages.length;
        reorderedImages.push(img);
      }
    });

    user.workspaceImages = reorderedImages;
    await user.save();

    return {
      message: "Workspace images reordered successfully",
      images: user.workspaceImages,
    };
  }
}

module.exports = new WorkspaceService();
