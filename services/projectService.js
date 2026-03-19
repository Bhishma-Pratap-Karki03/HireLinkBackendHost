// Project Service handles project-related business logic

const User = require("../models/userModel");
const path = require("path");
const fs = require("fs");
const { NotFoundError, ValidationError } = require("../utils/AppError");

class ProjectService {
  // Add project to user profile
  async addProject(userId, projectData, fileData = null) {
    const {
      projectTitle,
      projectDescription,
      startDate,
      endDate,
      isOngoing,
      projectUrl,
      technologies,
    } = projectData;

    // Validate required fields
    if (!projectTitle || !projectTitle.trim()) {
      throw new ValidationError("Project title is required");
    }

    if (!startDate) {
      throw new ValidationError("Start date is required");
    }

    // Validate dates
    const start = new Date(startDate);
    if (isNaN(start.getTime())) {
      throw new ValidationError("Invalid start date");
    }

    let end = null;
    if (endDate && !isOngoing) {
      end = new Date(endDate);
      if (isNaN(end.getTime())) {
        throw new ValidationError("Invalid end date");
      }
      if (end < start) {
        throw new ValidationError("End date cannot be before start date");
      }
    }

    const user = await User.findById(userId);
    if (!user) {
      throw new NotFoundError("User");
    }

    // Parse technologies if provided
    let technologiesArray = [];
    if (technologies) {
      if (typeof technologies === "string") {
        technologiesArray = technologies
          .split(",")
          .map((tech) => tech.trim())
          .filter((tech) => tech !== "");
      } else if (Array.isArray(technologies)) {
        technologiesArray = technologies
          .map((tech) => tech.trim())
          .filter((tech) => tech !== "");
      }
    }

    // Create new project object
    const newProject = {
      projectTitle: projectTitle.trim(),
      projectDescription: projectDescription || "",
      startDate: start,
      endDate: isOngoing ? null : end,
      isOngoing: !!isOngoing,
      projectUrl: projectUrl ? projectUrl.trim() : "",
      technologies: technologiesArray,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Handle cover image if uploaded
    if (fileData) {
      const { coverImageUrl, fileName, fileSize } = fileData;
      newProject.coverImage = coverImageUrl;
      newProject.coverImageFileName = fileName;
      newProject.coverImageFileSize = fileSize;
    }

    // Add to user's projects array
    user.projects.push(newProject);
    await user.save();

    // Get the added project with its ID
    const addedProject = user.projects[user.projects.length - 1];

    return {
      message: "Project added successfully",
      project: addedProject,
    };
  }

  // Update project in user profile
  async updateProject(userId, projectId, projectData, fileData = null) {
    const {
      projectTitle,
      projectDescription,
      startDate,
      endDate,
      isOngoing,
      projectUrl,
      technologies,
    } = projectData;

    const user = await User.findById(userId);
    if (!user) {
      throw new NotFoundError("User");
    }

    // Find the project to update
    const project = user.projects.id(projectId);
    if (!project) {
      throw new NotFoundError("Project");
    }

    // Validate dates if provided
    if (startDate) {
      const start = new Date(startDate);
      if (isNaN(start.getTime())) {
        throw new ValidationError("Invalid start date");
      }
      project.startDate = start;
    }

    if (endDate && !isOngoing) {
      const end = new Date(endDate);
      if (isNaN(end.getTime())) {
        throw new ValidationError("Invalid end date");
      }
      if (end < project.startDate) {
        throw new ValidationError("End date cannot be before start date");
      }
      project.endDate = end;
    } else if (isOngoing) {
      project.endDate = null;
    }

    // Update fields if provided
    if (projectTitle !== undefined) {
      if (!projectTitle.trim()) {
        throw new ValidationError("Project title cannot be empty");
      }
      project.projectTitle = projectTitle.trim();
    }

    if (projectDescription !== undefined) {
      project.projectDescription = projectDescription || "";
    }

    if (isOngoing !== undefined) {
      project.isOngoing = isOngoing;
      if (isOngoing) {
        project.endDate = null;
      }
    }

    if (projectUrl !== undefined) {
      project.projectUrl = projectUrl ? projectUrl.trim() : "";
    }

    if (technologies !== undefined) {
      let technologiesArray = [];
      if (typeof technologies === "string") {
        technologiesArray = technologies
          .split(",")
          .map((tech) => tech.trim())
          .filter((tech) => tech !== "");
      } else if (Array.isArray(technologies)) {
        technologiesArray = technologies
          .map((tech) => tech.trim())
          .filter((tech) => tech !== "");
      }
      project.technologies = technologiesArray;
    }

    // Handle cover image update if new file is uploaded
    if (fileData) {
      // Delete old cover image if it exists
      if (project.coverImage && project.coverImage !== "") {
        const oldImagePath = path.join(
          __dirname,
          "..",
          "public",
          project.coverImage
        );
        if (fs.existsSync(oldImagePath)) {
          try {
            fs.unlinkSync(oldImagePath);
          } catch (error) {
            console.error("Error deleting old project cover image:", error);
          }
        }
      }

      const { coverImageUrl, fileName, fileSize } = fileData;
      project.coverImage = coverImageUrl;
      project.coverImageFileName = fileName;
      project.coverImageFileSize = fileSize;
    }

    project.updatedAt = new Date();
    await user.save();

    return {
      message: "Project updated successfully",
      project: project,
    };
  }

  // Remove project from user profile
  async removeProject(userId, projectId) {
    const user = await User.findById(userId);
    if (!user) {
      throw new NotFoundError("User");
    }

    // Find the project to remove
    const project = user.projects.id(projectId);
    if (!project) {
      throw new NotFoundError("Project");
    }

    // Delete the cover image file if it exists
    if (project.coverImage && project.coverImage !== "") {
      const imagePath = path.join(
        __dirname,
        "..",
        "public",
        project.coverImage
      );
      if (fs.existsSync(imagePath)) {
        try {
          fs.unlinkSync(imagePath);
        } catch (error) {
          console.error("Error deleting project cover image:", error);
        }
      }
    }

    // Remove the project
    project.remove();
    await user.save();

    return {
      message: "Project removed successfully",
    };
  }
}

module.exports = new ProjectService();

