// employerService.js - Business logic for fetching recruiter data

// Import the User model
const User = require("../models/userModel");
const JobPost = require("../models/jobPostModel");
const ConnectionRequest = require("../models/connectionRequestModel");

class EmployerService {
  // Get all recruiters for public employers page
  async getAllRecruiters() {
    // Define admin email to exclude from employers list
    const ADMIN_EMAIL = "hirelinknp@gmail.com";

    // Find all users with role 'recruiter' AND exclude admin email
    // Only select fields needed for public employers page
    const recruiters = await User.find({
      role: "recruiter",
      email: { $ne: ADMIN_EMAIL }, // Exclude admin by email
    })
      .select(
        "fullName profilePicture address companySize foundedYear websiteUrl email phone about workspaceImages"
      )
      .lean(); // Use lean() for better performance since we don't need Mongoose document methods

    // If no recruiters found, return empty array
    if (!recruiters || recruiters.length === 0) {
      return {
        recruiters: [],
        message: "No recruiters found",
      };
    }

    const vacancyAgg = await JobPost.aggregate([
      {
        $match: {
          status: "published",
          isActive: true,
        },
      },
      {
        $group: {
          _id: "$recruiterId",
          count: { $sum: 1 },
        },
      },
    ]);

    const vacancyMap = vacancyAgg.reduce((acc, item) => {
      acc[item._id.toString()] = item.count;
      return acc;
    }, {});

    // Format the recruiter data for public view
    const formattedRecruiters = recruiters.map((recruiter) => {
      // Get full profile picture URL
      let profilePictureUrl = "";
      if (recruiter.profilePicture && recruiter.profilePicture !== "") {
        // Check if the URL already has the full path
        if (recruiter.profilePicture.startsWith("http")) {
          profilePictureUrl = recruiter.profilePicture;
        } else {
          // Add the base URL for local images
          profilePictureUrl = `${
            process.env.BASE_URL || "http://localhost:5000"
          }${recruiter.profilePicture}`;
        }
      }

      // Get workspace images URLs
      const workspaceImages = (recruiter.workspaceImages || [])
        .map((image) => {
          if (image.imageUrl && image.imageUrl !== "") {
            if (image.imageUrl.startsWith("http")) {
              return image.imageUrl;
            } else {
              return `${process.env.BASE_URL || "http://localhost:5000"}${
                image.imageUrl
              }`;
            }
          }
          return null;
        })
        .filter((url) => url !== null);

      // Format address for display
      let displayAddress = "No location provided";
      if (recruiter.address && recruiter.address.trim() !== "") {
        displayAddress = recruiter.address;
      }

      return {
        id: recruiter._id.toString(),
        name: recruiter.fullName || "Unnamed Company",
        logo: profilePictureUrl,
        location: displayAddress,
        email: recruiter.email || "",
        companySize: recruiter.companySize || "",
        foundedYear: recruiter.foundedYear || "",
        websiteUrl: recruiter.websiteUrl || "",
        about: recruiter.about || "",
        workspaceImages: workspaceImages,
        // Additional company info that might be useful
        vacancies: vacancyMap[recruiter._id.toString()] || 0,
        isFeatured: recruiter.companySize && recruiter.companySize !== "",
      };
    });

    // Return the formatted recruiters
    return {
      recruiters: formattedRecruiters,
      total: formattedRecruiters.length,
      message: "Recruiters fetched successfully",
    };
  }

  // Get single recruiter by ID
  async getRecruiterById(recruiterId, viewerId = null) {
    // Find the recruiter by ID
    const recruiter = await User.findOne({
      _id: recruiterId,
      role: "recruiter",
    })
      .select(
        "fullName profilePicture address companySize foundedYear websiteUrl email phone about workspaceImages linkedinUrl instagramUrl facebookUrl profileVisibility"
      )
      .lean();

    if (!recruiter) {
      throw new Error("Recruiter not found");
    }

    if (recruiter.profileVisibility === "private") {
      if (!viewerId) {
        const error = new Error(
          "This employer has set their profile to private. Details are not available."
        );
        error.statusCode = 403;
        throw error;
      }

      if (String(viewerId) !== String(recruiter._id)) {
        const viewer = await User.findById(viewerId).select("role").lean();
        const isAdmin = viewer?.role === "admin";
        if (!isAdmin) {
          const link = await ConnectionRequest.findOne({
            status: "accepted",
            $or: [
              { requester: viewerId, recipient: recruiter._id },
              { requester: recruiter._id, recipient: viewerId },
            ],
          })
            .select("_id")
            .lean();
          if (!link) {
            const error = new Error(
              "This employer has set their profile to private. Details are not available."
            );
            error.statusCode = 403;
            throw error;
          }
        }
      }
    }

    // Get full profile picture URL
    let profilePictureUrl = "";
    if (recruiter.profilePicture && recruiter.profilePicture !== "") {
      if (recruiter.profilePicture.startsWith("http")) {
        profilePictureUrl = recruiter.profilePicture;
      } else {
        profilePictureUrl = `${
          process.env.BASE_URL || "http://localhost:5000"
        }${recruiter.profilePicture}`;
      }
    }

    // Get workspace images URLs
    const workspaceImages = (recruiter.workspaceImages || [])
      .sort((a, b) => a.order - b.order) // Sort by order
      .map((image) => {
        if (image.imageUrl && image.imageUrl !== "") {
          if (image.imageUrl.startsWith("http")) {
            return image.imageUrl;
          } else {
            return `${process.env.BASE_URL || "http://localhost:5000"}${
              image.imageUrl
            }`;
          }
        }
        return null;
      })
      .filter((url) => url !== null);

    // Format the recruiter data for detailed view
    const formattedRecruiter = {
      id: recruiter._id.toString(),
      name: recruiter.fullName || "Unnamed Company",
      profileVisibility: recruiter.profileVisibility || "public",
      logo: profilePictureUrl,
      location: recruiter.address || "No location provided",
      email: recruiter.email || "",
      companySize: recruiter.companySize || "",
      foundedYear: recruiter.foundedYear || "",
      websiteUrl: recruiter.websiteUrl || "",
      about: recruiter.about || "",
      workspaceImages: workspaceImages,
      linkedinUrl: recruiter.linkedinUrl || "",
      instagramUrl: recruiter.instagramUrl || "",
      facebookUrl: recruiter.facebookUrl || "",
    };

    return {
      company: formattedRecruiter,
      message: "Recruiter details fetched successfully",
    };
  }
}

// Export a single instance of the EmployerService class
module.exports = new EmployerService();
