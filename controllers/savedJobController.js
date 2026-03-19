// Handles save/unsave and listing of saved jobs for candidates.
const SavedJob = require("../models/savedJobModel");
const JobPost = require("../models/jobPostModel");

exports.toggleSaveJob = async (req, res) => {
  try {
    const userId = req.user.id;
    const { jobId } = req.body;

    if (!jobId) {
      return res.status(400).json({
        success: false,
        message: "Job ID is required",
      });
    }

    const job = await JobPost.findById(jobId);
    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Job not found",
      });
    }

    const existing = await SavedJob.findOne({ candidate: userId, job: jobId });
    if (existing) {
      await existing.deleteOne();
      return res.status(200).json({ success: true, saved: false });
    }

    await SavedJob.create({ candidate: userId, job: jobId });
    return res.status(201).json({ success: true, saved: true });
  } catch (error) {
    console.error("Toggle save job error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error saving job",
      error: error.message,
    });
  }
};

exports.checkSaved = async (req, res) => {
  try {
    const userId = req.user.id;
    const { jobId } = req.params;

    const existing = await SavedJob.findOne({ candidate: userId, job: jobId });
    return res.status(200).json({
      success: true,
      saved: Boolean(existing),
    });
  } catch (error) {
    console.error("Check saved job error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error checking saved job",
      error: error.message,
    });
  }
};

exports.listSaved = async (req, res) => {
  try {
    const userId = req.user.id;
    const savedJobs = await SavedJob.find({ candidate: userId })
      .populate({ path: "job", populate: { path: "recruiterId", select: "profilePicture fullName" } })
      .sort({ createdAt: -1 })
      .lean();

    const mapped = savedJobs.map((item) => {
      const job = item.job || {};
      const recruiter = job.recruiterId || {};
      return {
        ...item,
        recruiterName: recruiter.fullName || "",
        job: {
          ...job,
          companyName: job.companyName || recruiter.fullName || "Company",
          companyLogo: job.companyLogo || recruiter.profilePicture || "",
        },
      };
    });

    return res.status(200).json({ success: true, savedJobs: mapped });
  } catch (error) {
    console.error("List saved jobs error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error fetching saved jobs",
      error: error.message,
    });
  }
};


