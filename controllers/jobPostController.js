const mongoose = require("mongoose");
const JobPost = require("../models/jobPostModel");
const User = require("../models/userModel");
const AppliedJob = require("../models/appliedJobModel");

// Handles recruiter/admin job post create, edit, list, and status actions.
const ADMIN_EMAIL = "hirelinknp@gmail.com";
const MAX_INTERVIEW_STAGES = 6;

const isAdmin = (user) =>
  user &&
  (String(user.role || "").toLowerCase() === "admin" ||
    String(user.email || "").toLowerCase() === ADMIN_EMAIL);

const normalizeInterviewStages = (interviewStages) => {
  if (!Array.isArray(interviewStages)) {
    return [];
  }

  return interviewStages
    .slice(0, MAX_INTERVIEW_STAGES)
    .map((stage) => {
      if (!stage || typeof stage !== "object") {
        return null;
      }
      return {
        name: String(stage.name || "").trim(),
        salary: String(stage.salary || "").trim(),
      };
    })
    .filter((stage) => stage && stage.name);
};

const listJobPosts = async (req, res) => {
  try {
    const {
      search,
      location,
      department,
      workMode,
      jobType,
      jobLevel,
      experience,
      education,
      skills,
      currency,
      salaryFrom,
      salaryTo,
      sort = "newest",
      recruiterId,
      page = "1",
      limit = "20",
    } = req.query;

    const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
    const limitNumber = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 50);

    const match = {
      isActive: true,
      status: "published",
    };

    if (recruiterId && mongoose.Types.ObjectId.isValid(recruiterId)) {
      match.recruiterId = new mongoose.Types.ObjectId(recruiterId);
    }

    if (location) {
      match.location = new RegExp(location, "i");
    }

    if (department) {
      match.department = new RegExp(department, "i");
    }

    if (workMode) {
      const workModeList = String(workMode)
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
      if (workModeList.length > 0) {
        match.workMode = { $in: workModeList };
      }
    }

    if (jobType) {
      const jobTypeList = String(jobType)
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
      if (jobTypeList.length > 0) {
        match.jobType = { $in: jobTypeList.map((item) => new RegExp(item, "i")) };
      }
    }

    if (jobLevel) {
      const jobLevelList = String(jobLevel)
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
      if (jobLevelList.length > 0) {
        match.jobLevel = { $in: jobLevelList.map((item) => new RegExp(item, "i")) };
      }
    }

    if (experience) {
      match.experience = new RegExp(experience, "i");
    }

    if (education) {
      match.education = new RegExp(education, "i");
    }

    if (skills) {
      const skillsList = String(skills)
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
      if (skillsList.length > 0) {
        match.requiredSkills = { $all: skillsList };
      }
    }

    if (currency) {
      match.currency = currency;
    }

    const basePipeline = [{ $match: match }];

    const shouldHandleSalary =
      salaryFrom !== undefined || salaryTo !== undefined || sort === "salary";

    if (shouldHandleSalary) {
      basePipeline.push({
        $addFields: {
          salaryFromNumber: {
            $convert: { input: "$salaryFrom", to: "double", onError: null },
          },
          salaryToNumber: {
            $convert: { input: "$salaryTo", to: "double", onError: null },
          },
        },
      });

      const salaryFilters = [];
      if (salaryFrom !== undefined && salaryFrom !== "") {
        const minSalary = Number(salaryFrom);
        if (!Number.isNaN(minSalary)) {
          salaryFilters.push({ $gte: ["$salaryFromNumber", minSalary] });
        }
      }

      if (salaryTo !== undefined && salaryTo !== "") {
        const maxSalary = Number(salaryTo);
        if (!Number.isNaN(maxSalary)) {
          salaryFilters.push({ $lte: ["$salaryToNumber", maxSalary] });
        }
      }

      if (salaryFilters.length > 0) {
        basePipeline.push({
          $match: {
            $expr: {
              $and: salaryFilters,
            },
          },
        });
      }
    }

    const jobsPipeline = [...basePipeline];

    jobsPipeline.push(
      {
        $lookup: {
          from: "users",
          localField: "recruiterId",
          foreignField: "_id",
          as: "recruiter",
        },
      },
      {
        $unwind: {
          path: "$recruiter",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $addFields: {
          companyName: { $ifNull: ["$recruiter.fullName", ""] },
          companyLogo: { $ifNull: ["$recruiter.profilePicture", ""] },
        },
      },
    );

    if (search) {
      const searchRegex = new RegExp(search, "i");
      jobsPipeline.push({
        $match: {
          $or: [
            { jobTitle: searchRegex },
            { department: searchRegex },
            { location: searchRegex },
            { companyName: searchRegex },
          ],
        },
      });
    }

    const sortStage =
      sort === "oldest"
        ? { createdAt: 1 }
        : sort === "salary"
        ? { salaryFromNumber: 1 }
        : { createdAt: -1 };

    jobsPipeline.push({ $sort: sortStage });
    jobsPipeline.push({ $skip: (pageNumber - 1) * limitNumber });
    jobsPipeline.push({ $limit: limitNumber });

    if (shouldHandleSalary) {
      jobsPipeline.push({
        $project: {
          salaryFromNumber: 0,
          salaryToNumber: 0,
          recruiter: 0,
        },
      });
    } else {
      jobsPipeline.push({
        $project: {
          recruiter: 0,
        },
      });
    }

    const totalPipeline = [...basePipeline];
    totalPipeline.push(
      {
        $lookup: {
          from: "users",
          localField: "recruiterId",
          foreignField: "_id",
          as: "recruiter",
        },
      },
      {
        $unwind: {
          path: "$recruiter",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $addFields: {
          companyName: { $ifNull: ["$recruiter.fullName", ""] },
        },
      },
    );

    if (search) {
      const searchRegex = new RegExp(search, "i");
      totalPipeline.push({
        $match: {
          $or: [
            { jobTitle: searchRegex },
            { department: searchRegex },
            { location: searchRegex },
            { companyName: searchRegex },
          ],
        },
      });
    }

    totalPipeline.push({ $count: "total" });

    const [jobs, totalResult] = await Promise.all([
      JobPost.aggregate(jobsPipeline),
      JobPost.aggregate(totalPipeline),
    ]);

    const total = totalResult.length > 0 ? totalResult[0].total : 0;

    res.status(200).json({
      success: true,
      jobs,
      total,
      page: pageNumber,
      limit: limitNumber,
    });
  } catch (error) {
    console.error("List job posts error:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching job posts",
      error: error.message,
    });
  }
};

const getJobCategoriesSummary = async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 7, 1), 20);

    const summary = await JobPost.aggregate([
      {
        $match: {
          isActive: true,
          status: "published",
        },
      },
      {
        $project: {
          titleName: {
            $trim: {
              input: {
                $ifNull: ["$jobTitle", "$department"],
              },
            },
          },
        },
      },
      {
        $match: {
          titleName: { $ne: "" },
        },
      },
      {
        $group: {
          _id: { $toLower: "$titleName" },
          name: { $first: "$titleName" },
          vacancies: { $sum: 1 },
        },
      },
      {
        $sort: {
          vacancies: -1,
          name: 1,
        },
      },
      {
        $facet: {
          topCategories: [{ $limit: limit }],
          totals: [
            {
              $group: {
                _id: null,
                totalVacancies: { $sum: "$vacancies" },
                totalTitles: { $sum: 1 },
              },
            },
          ],
        },
      },
    ]);

    const topCategories = (summary?.[0]?.topCategories || []).map((item) => ({
      name: item.name,
      vacancies: item.vacancies || 0,
    }));
    const totals = summary?.[0]?.totals?.[0] || {
      totalVacancies: 0,
      totalTitles: 0,
    };

    return res.status(200).json({
      success: true,
      categories: topCategories,
      totalVacancies: totals.totalVacancies || 0,
      totalCategories: totals.totalTitles || 0,
    });
  } catch (error) {
    console.error("Get job categories summary error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error fetching category summary",
      error: error.message,
    });
  }
};

const getCompanyVacancySummary = async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 7, 1), 20);

    const summary = await JobPost.aggregate([
      {
        $match: {
          isActive: true,
          status: "published",
        },
      },
      {
        $project: {
          recruiterId: 1,
          openingsNumber: {
            $convert: {
              input: "$openings",
              to: "int",
              onError: 1,
              onNull: 1,
            },
          },
        },
      },
      {
        $group: {
          _id: "$recruiterId",
          vacancies: { $sum: "$openingsNumber" },
          jobsCount: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "recruiter",
        },
      },
      {
        $unwind: {
          path: "$recruiter",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $addFields: {
          companyName: { $ifNull: ["$recruiter.fullName", "Company"] },
          companyLogo: { $ifNull: ["$recruiter.profilePicture", ""] },
        },
      },
      {
        $sort: {
          vacancies: -1,
          jobsCount: -1,
          companyName: 1,
        },
      },
      {
        $facet: {
          topCompanies: [{ $limit: limit }],
          totals: [
            {
              $group: {
                _id: null,
                totalVacancies: { $sum: "$vacancies" },
                totalCompanies: { $sum: 1 },
              },
            },
          ],
        },
      },
    ]);

    const companies = (summary?.[0]?.topCompanies || []).map((item) => ({
      companyId: item._id,
      name: item.companyName || "Company",
      logo: item.companyLogo || "",
      vacancies: item.vacancies || 0,
      jobsCount: item.jobsCount || 0,
    }));

    const totals = summary?.[0]?.totals?.[0] || {
      totalVacancies: 0,
      totalCompanies: 0,
    };

    return res.status(200).json({
      success: true,
      companies,
      totalVacancies: totals.totalVacancies || 0,
      totalCompanies: totals.totalCompanies || 0,
    });
  } catch (error) {
    console.error("Get company vacancy summary error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error fetching company vacancy summary",
      error: error.message,
    });
  }
};

const listRecruiterJobPosts = async (req, res) => {
  try {
    const userId = req.user.id;
    const recruiter = await User.findById(userId).lean();
    if (!recruiter || recruiter.role !== "recruiter") {
      return res.status(403).json({
        success: false,
        message: "Only recruiters can access this resource",
      });
    }

    const pipeline = [
      { $match: { recruiterId: new mongoose.Types.ObjectId(userId) } },
      {
        $lookup: {
          from: "appliedjobs",
          localField: "_id",
          foreignField: "job",
          as: "applications",
        },
      },
      {
        $addFields: {
          applicantsCount: { $size: "$applications" },
        },
      },
      {
        $addFields: {
          statusLabel: {
            $cond: [
              {
                $and: [
                  { $eq: ["$status", "published"] },
                  { $eq: ["$isActive", true] },
                  { $gte: ["$deadline", new Date()] },
                ],
              },
              "Open",
              "Closed",
            ],
          },
        },
      },
      {
        $project: {
          applications: 0,
          __v: 0,
        },
      },
      { $sort: { createdAt: -1 } },
    ];

    const jobs = await JobPost.aggregate(pipeline);

    res.status(200).json({
      success: true,
      jobs,
    });
  } catch (error) {
    console.error("Recruiter job posts error:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching recruiter job posts",
      error: error.message,
    });
  }
};

const updateJobPost = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const recruiter = await User.findById(userId).lean();
    if (!recruiter || recruiter.role !== "recruiter") {
      return res.status(403).json({
        success: false,
        message: "Only recruiters can update jobs",
      });
    }

    const job = await JobPost.findById(id);
    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Job not found",
      });
    }

    if (job.recruiterId.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to update this job",
      });
    }

    const updates = { ...req.body };
    delete updates.recruiterId;

    if (updates.interviewStages !== undefined) {
      if (
        Array.isArray(updates.interviewStages) &&
        updates.interviewStages.length > MAX_INTERVIEW_STAGES
      ) {
        return res.status(400).json({
          success: false,
          message: `Maximum ${MAX_INTERVIEW_STAGES} interview stages are allowed`,
        });
      }
      updates.interviewStages = normalizeInterviewStages(updates.interviewStages);
    }

    const updated = await JobPost.findByIdAndUpdate(id, updates, {
      new: true,
    });

    res.status(200).json({
      success: true,
      message: "Job updated successfully",
      jobPost: updated,
    });
  } catch (error) {
    console.error("Update job post error:", error);
    res.status(500).json({
      success: false,
      message: "Server error updating job post",
      error: error.message,
    });
  }
};

const getJobPostById = async (req, res) => {
  try {
    const { id } = req.params;
    const job = await JobPost.findById(id)
      .populate(
        "recruiterId",
        "fullName profilePicture email address companySize foundedYear websiteUrl about",
      )
      .lean();

    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Job not found",
      });
    }

    const recruiter = job.recruiterId || {};
    const companyLogo = recruiter.profilePicture || "";
    const jobResponse = {
      id: job._id.toString(),
      jobTitle: job.jobTitle,
      companyName: recruiter.fullName || "Company",
      companyLogo,
      companyEmail: job.contactEmail || recruiter.email || "",
      companyLocation: recruiter.address || "",
      companyAbout: recruiter.about || "",
      department: job.department || "",
      location: job.location || "",
      jobLevel: job.jobLevel || "",
      jobType: job.jobType || "",
      workMode: job.workMode || "",
      gender: job.gender || "both",
      openings: job.openings || 0,
      deadline: job.deadline,
      description: job.description || "",
      responsibilities: job.responsibilities || [],
      requirements: job.requirements || [],
      requiredSkills: job.requiredSkills || [],
      experience: job.experience || "",
      education: job.education || "",
      salaryFrom: job.salaryFrom || "",
      salaryTo: job.salaryTo || "",
      currency: job.currency || "",
      benefits: job.benefits || [],
      interviewStages: job.interviewStages || [],
      assessmentId: job.assessmentId || null,
      assessmentRequired: job.assessmentRequired || false,
      assessmentSource: job.assessmentSource || "recruiter",
      createdAt: job.createdAt,
    };

    return res.status(200).json({
      success: true,
      job: jobResponse,
    });
  } catch (error) {
    console.error("Get job post error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error fetching job",
      error: error.message,
    });
  }
};

const createJobPost = async (req, res) => {
  try {
    const userId = req.user.id;
    const recruiter = await User.findById(userId);

    if (!recruiter || recruiter.role !== "recruiter") {
      return res.status(403).json({
        success: false,
        message: "Only recruiters can post jobs",
      });
    }

    const {
      jobTitle,
      department,
      location,
      workMode,
      gender,
      jobLevel,
      jobType,
      openings,
      deadline,
      description,
      contactEmail,
      responsibilities,
      requirements,
      requiredSkills,
      experience,
      education,
      salaryFrom,
      salaryTo,
      currency,
      benefits,
      interviewStages,
      assessmentId,
      assessmentRequired,
      status,
    } = req.body;

    const requiredFields = {
      jobTitle,
      department,
      location,
      workMode,
      gender,
      jobLevel,
      jobType,
      openings,
      deadline,
      description,
      salaryFrom,
      salaryTo,
      currency,
    };

    const missing = Object.entries(requiredFields)
      .filter(([, value]) => value === undefined || value === null || value === "")
      .map(([key]) => key);

    if (missing.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
        missingFields: missing,
      });
    }

    if (
      Array.isArray(interviewStages) &&
      interviewStages.length > MAX_INTERVIEW_STAGES
    ) {
      return res.status(400).json({
        success: false,
        message: `Maximum ${MAX_INTERVIEW_STAGES} interview stages are allowed`,
      });
    }

    const openingsNumber = Number(openings);
    if (Number.isNaN(openingsNumber) || openingsNumber < 1) {
      return res.status(400).json({
        success: false,
        message: "Openings must be a positive number",
      });
    }

    const deadlineDate = new Date(deadline);
    if (Number.isNaN(deadlineDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid deadline date",
      });
    }

    const jobPost = new JobPost({
      recruiterId: userId,
      jobTitle: jobTitle.trim(),
      department: department.trim(),
      location: location.trim(),
      workMode,
      gender,
      jobLevel: jobLevel.trim(),
      jobType: jobType.trim(),
      contactEmail: contactEmail ? contactEmail.trim() : "",
      openings: openingsNumber,
      deadline: deadlineDate,
      description: description || "",
      responsibilities: Array.isArray(responsibilities) ? responsibilities : [],
      requirements: Array.isArray(requirements) ? requirements : [],
      requiredSkills: Array.isArray(requiredSkills) ? requiredSkills : [],
      experience: experience || "",
      education: education || "",
      salaryFrom: String(salaryFrom).trim(),
      salaryTo: String(salaryTo).trim(),
      currency: currency.trim(),
      benefits: Array.isArray(benefits) ? benefits : [],
      interviewStages: normalizeInterviewStages(interviewStages),
      assessmentId: assessmentId || null,
      assessmentRequired: Boolean(assessmentRequired),
      assessmentSource: assessmentId ? "recruiter" : undefined,
      status: status || "published",
    });

    const savedJobPost = await jobPost.save();

    res.status(201).json({
      success: true,
      message: "Job posted successfully",
      jobPost: savedJobPost,
    });
  } catch (error) {
    console.error("Create job post error:", error);
    res.status(500).json({
      success: false,
      message: "Server error creating job post",
      error: error.message,
    });
  }
};

const listJobPostsForAdmin = async (req, res) => {
  try {
    if (!isAdmin(req.user)) {
      return res.status(403).json({
        success: false,
        message: "Only admin can access this resource",
      });
    }

    const search = String(req.query.search || "").trim();
    const status = String(req.query.status || "all").toLowerCase();

    const match = {};

    if (status === "active") {
      match.isActive = true;
    } else if (status === "inactive") {
      match.isActive = false;
    }

    if (search) {
      const regex = new RegExp(search, "i");
      match.$or = [{ jobTitle: regex }, { location: regex }, { department: regex }];
    }

    const jobs = await JobPost.aggregate([
      { $match: match },
      {
        $lookup: {
          from: "users",
          localField: "recruiterId",
          foreignField: "_id",
          as: "recruiter",
        },
      },
      {
        $unwind: {
          path: "$recruiter",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: "appliedjobs",
          localField: "_id",
          foreignField: "job",
          as: "applications",
        },
      },
      {
        $addFields: {
          applicantsCount: { $size: "$applications" },
          recruiterName: { $ifNull: ["$recruiter.fullName", "Unknown"] },
        },
      },
      {
        $project: {
          applications: 0,
          recruiter: 0,
          __v: 0,
        },
      },
      { $sort: { createdAt: -1 } },
    ]);

    return res.status(200).json({
      success: true,
      jobs,
    });
  } catch (error) {
    console.error("Admin job list error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error loading admin jobs",
      error: error.message,
    });
  }
};

const updateJobStatusByAdmin = async (req, res) => {
  try {
    if (!isAdmin(req.user)) {
      return res.status(403).json({
        success: false,
        message: "Only admin can access this resource",
      });
    }

    const { id } = req.params;
    const { action } = req.body;
    const normalized = String(action || "").toLowerCase();

    if (!["activate", "deactivate"].includes(normalized)) {
      return res.status(400).json({
        success: false,
        message: "Action must be activate or deactivate",
      });
    }

    const job = await JobPost.findById(id);
    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Job not found",
      });
    }

    job.isActive = normalized === "activate";
    await job.save();

    return res.status(200).json({
      success: true,
      message:
        normalized === "activate"
          ? "Job activated successfully"
          : "Job deactivated successfully",
      job: {
        id: job._id,
        isActive: job.isActive,
      },
    });
  } catch (error) {
    console.error("Admin update job status error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error updating job status",
      error: error.message,
    });
  }
};

module.exports = {
  createJobPost,
  listJobPosts,
  getJobCategoriesSummary,
  getCompanyVacancySummary,
  getJobPostById,
  listRecruiterJobPosts,
  updateJobPost,
  listJobPostsForAdmin,
  updateJobStatusByAdmin,
};


