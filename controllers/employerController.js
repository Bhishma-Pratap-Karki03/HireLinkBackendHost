// employerController.js - Handles fetching recruiter data for public employers page

// Import the employer service
const employerService = require("../services/employerService");

// Get all recruiters for public employers page
exports.getAllRecruiters = async (req, res, next) => {
  try {
    // Call the employer service to get all recruiters
    const result = await employerService.getAllRecruiters();

    // Return success response with recruiter data
    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Get recruiters error:", error);

    // Handle any unexpected errors
    res.status(500).json({
      success: false,
      message: "Server error fetching employers data",
      error: error.message,
    });
  }
};

// Get single recruiter/employer details by ID
exports.getRecruiterById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const viewerId = req.user?.id || null;

    // Call the employer service to get recruiter by ID
    const result = await employerService.getRecruiterById(id, viewerId);

    // Return success response with recruiter data
    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Get recruiter by ID error:", error);

    // Handle not found error
    if (error.message.includes("not found")) {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    if (error.statusCode === 403) {
      return res.status(403).json({
        success: false,
        message: error.message,
      });
    }

    // Handle any unexpected errors
    res.status(500).json({
      success: false,
      message: "Server error fetching employer details",
      error: error.message,
    });
  }
};
