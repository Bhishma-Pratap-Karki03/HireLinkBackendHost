const User = require("../models/userModel");
const ConnectionRequest = require("../models/connectionRequestModel");
const path = require("path");
const fs = require("fs");

class ProfileService {
  // Get current user's profile information
  async getMyProfile(userId) {
    // Find user by ID, excluding sensitive information
    const user = await User.findById(userId).select(
      "-password -verificationCode -resetCode"
    );

    if (!user) {
      throw new Error("User not found");
    }

    return {
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        phone: user.phone || "",
        address: user.address || "",
        about: user.about || "",
        currentJobTitle: user.currentJobTitle || "",
        profilePicture: user.profilePicture || "",
        profileVisibility: user.profileVisibility || "public",
        resume: user.resume || "",
        resumeFileName: user.resumeFileName || "",
        resumeFileSize: user.resumeFileSize || 0,
        connectionsCount: user.connectionsCount || 0,
        isVerified: user.isVerified,
        companySize: user.companySize || "",
        foundedYear: user.foundedYear || "",
        experience: user.experience || [],
        education: user.education || [],
        skills: user.skills || [],
        certifications: user.certifications || [],
        languages: user.languages || [],
        websiteUrl: user.websiteUrl || "",
        linkedinUrl: user.linkedinUrl || "",
        instagramUrl: user.instagramUrl || "",
        facebookUrl: user.facebookUrl || "",
        projects: user.projects || [],
        workspaceImages: user.workspaceImages || [],
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    };
  }

  async updateProfile(userId, updateData) {
    const {
      fullName,
      currentJobTitle,
      phone,
      address,
      about,
      companySize,
      foundedYear,
      websiteUrl,
      linkedinUrl,
      instagramUrl,
      facebookUrl,
      profileVisibility,
    } = updateData;

    // Validate phone number format if provided
    if (phone && phone.trim() !== "") {
      const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
      const cleanedPhone = phone.replace(/[\s\-\(\)]/g, "");

      if (!phoneRegex.test(cleanedPhone)) {
        throw new Error("Please provide a valid phone number");
      }
    }

    // Validate founded year if provided
    if (foundedYear && foundedYear.trim() !== "") {
      const yearNum = parseInt(foundedYear.trim());
      const currentYear = new Date().getFullYear();

      // Check if it's a valid number
      if (isNaN(yearNum)) {
        throw new Error("Please provide a valid year number");
      }

      // Check year range
      if (yearNum < 1800 || yearNum > currentYear) {
        throw new Error(
          `Please provide a valid founded year between 1800 and ${currentYear}`
        );
      }
    }

    // Prepare update object with only provided fields
    const updateFields = {};
    if (fullName !== undefined) updateFields.fullName = fullName.trim();
    if (currentJobTitle !== undefined)
      updateFields.currentJobTitle = currentJobTitle.trim();
    if (phone !== undefined) updateFields.phone = phone.trim();
    if (address !== undefined) updateFields.address = address.trim();
    if (about !== undefined) updateFields.about = about.trim();
    if (companySize !== undefined)
      updateFields.companySize = companySize.trim();
    if (foundedYear !== undefined)
      updateFields.foundedYear = foundedYear.trim();

    // Add website and social media fields
    if (websiteUrl !== undefined) updateFields.websiteUrl = websiteUrl.trim();
    if (linkedinUrl !== undefined)
      updateFields.linkedinUrl = linkedinUrl.trim();
    if (instagramUrl !== undefined)
      updateFields.instagramUrl = instagramUrl.trim();
    if (facebookUrl !== undefined)
      updateFields.facebookUrl = facebookUrl.trim();
    if (profileVisibility !== undefined) {
      const normalizedVisibility = String(profileVisibility).trim().toLowerCase();
      if (!["public", "private"].includes(normalizedVisibility)) {
        throw new Error("Profile visibility must be public or private");
      }
      updateFields.profileVisibility = normalizedVisibility;
    }

    console.log("Updating profile with fields:", updateFields); // Debug log

    // Update user and return updated document
    const user = await User.findByIdAndUpdate(
      userId,
      { $set: updateFields },
      { new: true, select: "-password -verificationCode -resetCode" }
    );

    if (!user) {
      throw new Error("User not found");
    }

    return {
      message: "Profile updated successfully",
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        phone: user.phone || "",
        address: user.address || "",
        companySize: user.companySize || "",
        foundedYear: user.foundedYear || "",
        about: user.about || "",
        currentJobTitle: user.currentJobTitle || "",
        profilePicture: user.profilePicture || "",
        profileVisibility: user.profileVisibility || "public",
      },
    };
  }

  // Upload new profile picture for user
  async uploadProfilePicture(userId, file) {
    // This function should not handle file movement anymore
    // File movement is handled in the controller
    throw new Error("This function should not be called directly");
  }

  // Remove user's profile picture
  async removeProfilePicture(userId) {
    const user = await User.findById(userId);

    if (!user) {
      throw new Error("User not found");
    }

    // Delete the profile picture file from server if it exists and is not empty
    if (user.profilePicture && user.profilePicture !== "") {
      const imagePath = path.join(
        __dirname,
        "..",
        "public",
        user.profilePicture
      );
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }

    // Clear profile picture field in user document
    user.profilePicture = "";
    await user.save();

    return {
      message: "Profile picture removed successfully",
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        profilePicture: "",
      },
    };
  }

  // Get public profile information for any user (for viewing other profiles)
  async getUserProfile(userId, viewerId = null) {
    const user = await User.findById(userId).select(
      "-password -verificationCode -resetCode -phone" // Remove sensitive data
    );

    if (!user) {
      const error = new Error("User not found");
      error.statusCode = 404;
      throw error;
    }

    if (["candidate", "recruiter"].includes(user.role) && user.profileVisibility === "private") {
      if (!viewerId) {
        const roleLabel = user.role === "recruiter" ? "employer" : "candidate";
        const error = new Error(
          `This ${roleLabel} has set their profile to private. Details are not available.`
        );
        error.statusCode = 403;
        throw error;
      }

      if (String(viewerId) !== String(user._id)) {
        const viewer = await User.findById(viewerId).select("role").lean();
        const isAdmin = viewer?.role === "admin";
        if (!isAdmin) {
          const link = await ConnectionRequest.findOne({
            status: "accepted",
            $or: [
              { requester: viewerId, recipient: user._id },
              { requester: user._id, recipient: viewerId },
            ],
          })
            .select("_id")
            .lean();
          if (!link) {
            const roleLabel = user.role === "recruiter" ? "employer" : "candidate";
            const error = new Error(
              `This ${roleLabel} has set their profile to private. Details are not available.`
            );
            error.statusCode = 403;
            throw error;
          }
        }
      }
    }

    // Get full profile picture URL
    let profilePictureUrl = "";
    if (user.profilePicture && user.profilePicture !== "") {
      if (user.profilePicture.startsWith("http")) {
        profilePictureUrl = user.profilePicture;
      } else {
        profilePictureUrl = `${
          process.env.BASE_URL || "http://localhost:5000"
        }${user.profilePicture}`;
      }
    }

    // Format the user data for public view
    const publicUserData = {
      id: user._id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      currentJobTitle: user.currentJobTitle || "",
      profilePicture: profilePictureUrl,
      profileVisibility: user.profileVisibility || "public",
      about: user.about || "",
      address: user.address || "",
      resume: user.resume || "",
      resumeFileName: user.resumeFileName || "",
      resumeFileSize: user.resumeFileSize || 0,
      skills: user.skills || [],
      experience: user.experience || [],
      education: user.education || [],
      certifications: user.certifications || [],
      languages: user.languages || [],
      projects: user.projects || [],
    };

    return { user: publicUserData };
  }

  // Add experience to user profile
  async addExperience(userId, experienceData) {
    const {
      jobTitle,
      jobType,
      organization,
      location,
      description,
      startDate,
      endDate,
      isCurrent,
    } = experienceData;

    // Validate required fields
    if (!jobTitle || !jobTitle.trim()) {
      throw new Error("Job title is required");
    }

    if (!organization || !organization.trim()) {
      throw new Error("Organization name is required");
    }

    if (!startDate) {
      throw new Error("Start date is required");
    }

    // Validate dates
    const start = new Date(startDate);
    if (isNaN(start.getTime())) {
      throw new Error("Invalid start date");
    }

    let end = null;
    if (endDate && !isCurrent) {
      end = new Date(endDate);
      if (isNaN(end.getTime())) {
        throw new Error("Invalid end date");
      }
      if (end < start) {
        throw new Error("End date cannot be before start date");
      }
    }

    const user = await User.findById(userId);

    if (!user) {
      throw new Error("User not found");
    }

    // Create new experience object
    const newExperience = {
      jobTitle: jobTitle.trim(),
      jobType: jobType || "Full-time",
      organization: organization.trim(),
      location: location ? location.trim() : "",
      description: description || "",
      startDate: start,
      endDate: isCurrent ? null : end,
      isCurrent: !!isCurrent,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Add to user's experiences array
    user.experience.push(newExperience);
    await user.save();

    // Get the added experience with its ID
    const addedExperience = user.experience[user.experience.length - 1];

    return {
      message: "Experience added successfully",
      experience: addedExperience,
    };
  }

  // Update experience in user profile
  async updateExperience(userId, experienceId, updateData) {
    const {
      jobTitle,
      jobType,
      organization,
      location,
      description,
      startDate,
      endDate,
      isCurrent,
    } = updateData;

    const user = await User.findById(userId);

    if (!user) {
      throw new Error("User not found");
    }

    // Find the experience to update
    const experience = user.experience.id(experienceId);

    if (!experience) {
      throw new Error("Experience not found");
    }

    // Validate dates if provided
    if (startDate) {
      const start = new Date(startDate);
      if (isNaN(start.getTime())) {
        throw new Error("Invalid start date");
      }
      experience.startDate = start;
    }

    if (endDate && !isCurrent) {
      const end = new Date(endDate);
      if (isNaN(end.getTime())) {
        throw new Error("Invalid end date");
      }
      if (end < experience.startDate) {
        throw new Error("End date cannot be before start date");
      }
      experience.endDate = end;
    } else if (isCurrent) {
      experience.endDate = null;
    }

    // Update fields if provided
    if (jobTitle !== undefined) {
      if (!jobTitle.trim()) {
        throw new Error("Job title cannot be empty");
      }
      experience.jobTitle = jobTitle.trim();
    }

    if (jobType !== undefined) {
      experience.jobType = jobType;
    }

    if (organization !== undefined) {
      if (!organization.trim()) {
        throw new Error("Organization name cannot be empty");
      }
      experience.organization = organization.trim();
    }

    if (location !== undefined) {
      experience.location = location ? location.trim() : "";
    }

    if (description !== undefined) {
      experience.description = description || "";
    }

    if (isCurrent !== undefined) {
      experience.isCurrent = isCurrent;
      if (isCurrent) {
        experience.endDate = null;
      }
    }

    experience.updatedAt = new Date();
    await user.save();

    return {
      message: "Experience updated successfully",
      experience: experience,
    };
  }

  // Remove experience from user profile
  async removeExperience(userId, experienceId) {
    const user = await User.findById(userId);

    if (!user) {
      throw new Error("User not found");
    }

    // Find the experience to remove
    const experience = user.experience.id(experienceId);

    if (!experience) {
      throw new Error("Experience not found");
    }

    // Remove the experience
    experience.remove();
    await user.save();

    return {
      message: "Experience removed successfully",
    };
  }

  async addEducation(userId, educationData) {
    const {
      degreeTitle,
      degreeType,
      institution,
      location,
      description,
      startDate,
      endDate,
      isCurrent,
    } = educationData;

    // Validate required fields
    if (!degreeTitle || !degreeTitle.trim()) {
      throw new Error("Degree title is required");
    }

    if (!institution || !institution.trim()) {
      throw new Error("Institution name is required");
    }

    if (!startDate) {
      throw new Error("Start date is required");
    }

    // Validate dates
    const start = new Date(startDate);
    if (isNaN(start.getTime())) {
      throw new Error("Invalid start date");
    }

    let end = null;
    if (endDate && !isCurrent) {
      end = new Date(endDate);
      if (isNaN(end.getTime())) {
        throw new Error("Invalid end date");
      }
      if (end < start) {
        throw new Error("End date cannot be before start date");
      }
    }

    const user = await User.findById(userId);

    if (!user) {
      throw new Error("User not found");
    }

    // Create new education object
    const newEducation = {
      degreeTitle: degreeTitle.trim(),
      degreeType: degreeType || "Bachelor's",
      institution: institution.trim(),
      location: location ? location.trim() : "",
      description: description || "",
      startDate: start,
      endDate: isCurrent ? null : end,
      isCurrent: !!isCurrent,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Add to user's education array
    user.education.push(newEducation);
    await user.save();

    // Get the added education with its ID
    const addedEducation = user.education[user.education.length - 1];

    return {
      message: "Education added successfully",
      education: addedEducation,
    };
  }

  // Update education in user profile
  async updateEducation(userId, educationId, updateData) {
    const {
      degreeTitle,
      degreeType,
      institution,
      location,
      description,
      startDate,
      endDate,
      isCurrent,
    } = updateData;

    const user = await User.findById(userId);

    if (!user) {
      throw new Error("User not found");
    }

    // Find the education to update
    const education = user.education.id(educationId);

    if (!education) {
      throw new Error("Education not found");
    }

    // Validate dates if provided
    if (startDate) {
      const start = new Date(startDate);
      if (isNaN(start.getTime())) {
        throw new Error("Invalid start date");
      }
      education.startDate = start;
    }

    if (endDate && !isCurrent) {
      const end = new Date(endDate);
      if (isNaN(end.getTime())) {
        throw new Error("Invalid end date");
      }
      if (end < education.startDate) {
        throw new Error("End date cannot be before start date");
      }
      education.endDate = end;
    } else if (isCurrent) {
      education.endDate = null;
    }

    // Update fields if provided
    if (degreeTitle !== undefined) {
      if (!degreeTitle.trim()) {
        throw new Error("Degree title cannot be empty");
      }
      education.degreeTitle = degreeTitle.trim();
    }

    if (degreeType !== undefined) {
      education.degreeType = degreeType;
    }

    if (institution !== undefined) {
      if (!institution.trim()) {
        throw new Error("Institution name cannot be empty");
      }
      education.institution = institution.trim();
    }

    if (location !== undefined) {
      education.location = location ? location.trim() : "";
    }

    if (description !== undefined) {
      education.description = description || "";
    }

    if (isCurrent !== undefined) {
      education.isCurrent = isCurrent;
      if (isCurrent) {
        education.endDate = null;
      }
    }

    education.updatedAt = new Date();
    await user.save();

    return {
      message: "Education updated successfully",
      education: education,
    };
  }

  // Remove education from user profile
  async removeEducation(userId, educationId) {
    const user = await User.findById(userId);

    if (!user) {
      throw new Error("User not found");
    }

    // Find the education to remove
    const education = user.education.id(educationId);

    if (!education) {
      throw new Error("Education not found");
    }

    // Remove the education
    education.remove();
    await user.save();

    return {
      message: "Education removed successfully",
    };
  }

  async addSkill(userId, skillData) {
    const {
      skillName,
      proficiencyLevel,
      yearsOfExperience,
      category,
      // Remove description from destructuring
    } = skillData;

    // Validate required fields
    if (!skillName || !skillName.trim()) {
      throw new Error("Skill name is required");
    }

    // Validate years of experience
    if (yearsOfExperience !== undefined) {
      if (yearsOfExperience < 0 || yearsOfExperience > 50) {
        throw new Error("Years of experience must be between 0 and 50");
      }
    }

    const user = await User.findById(userId);

    if (!user) {
      throw new Error("User not found");
    }

    // Create new skill object WITHOUT description
    const newSkill = {
      skillName: skillName.trim(),
      proficiencyLevel: proficiencyLevel || "Intermediate",
      yearsOfExperience: yearsOfExperience || 1,
      category: category || "Technical",
      // Remove description
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Add to user's skills array
    user.skills.push(newSkill);
    await user.save();

    // Get the added skill with its ID
    const addedSkill = user.skills[user.skills.length - 1];

    return {
      message: "Skill added successfully",
      skill: addedSkill,
    };
  }

  // In profileService.js, update the updateSkill method
  async updateSkill(userId, skillId, updateData) {
    const {
      skillName,
      proficiencyLevel,
      yearsOfExperience,
      category,
      // Remove description from destructuring
    } = updateData;

    const user = await User.findById(userId);

    if (!user) {
      throw new Error("User not found");
    }

    // Find the skill to update
    const skill = user.skills.id(skillId);

    if (!skill) {
      throw new Error("Skill not found");
    }

    // Validate years of experience if provided
    if (yearsOfExperience !== undefined) {
      if (yearsOfExperience < 0 || yearsOfExperience > 50) {
        throw new Error("Years of experience must be between 0 and 50");
      }
      skill.yearsOfExperience = yearsOfExperience;
    }

    // Update fields if provided
    if (skillName !== undefined) {
      if (!skillName.trim()) {
        throw new Error("Skill name cannot be empty");
      }
      skill.skillName = skillName.trim();
    }

    if (proficiencyLevel !== undefined) {
      skill.proficiencyLevel = proficiencyLevel;
    }

    if (category !== undefined) {
      skill.category = category;
    }
    skill.updatedAt = new Date();
    await user.save();

    return {
      message: "Skill updated successfully",
      skill: skill,
    };
  }

  // Remove skill from user profile
  async removeSkill(userId, skillId) {
    const user = await User.findById(userId);

    if (!user) {
      throw new Error("User not found");
    }

    console.log("Looking for skill ID:", skillId);
    console.log("User skills:", user.skills);

    // Convert skillId to string for comparison
    const skillIdStr = skillId.toString();

    // Find the skill index using findIndex instead of .id()
    const skillIndex = user.skills.findIndex(
      (skill) => skill._id.toString() === skillIdStr
    );

    console.log("Found skill at index:", skillIndex);

    if (skillIndex === -1) {
      throw new Error("Skill not found");
    }

    // Remove the skill using splice (more reliable than .remove())
    user.skills.splice(skillIndex, 1);

    await user.save();

    console.log("Skill removed successfully");
    return {
      message: "Skill removed successfully",
    };
  }

  async addLanguage(userId, languageData) {
    const { languageName, rating } = languageData;

    // Validate required fields
    if (!languageName || !languageName.trim()) {
      throw new Error("Language name is required");
    }

    // Validate rating
    if (rating !== undefined) {
      if (rating < 1 || rating > 5) {
        throw new Error("Rating must be between 1 and 5");
      }
    }

    const user = await User.findById(userId);

    if (!user) {
      throw new Error("User not found");
    }

    // Check if language already exists
    const languageExists = user.languages.some(
      (lang) => lang.languageName.toLowerCase() === languageName.toLowerCase()
    );

    if (languageExists) {
      throw new Error("Language already exists in your profile");
    }

    // Create new language object
    const newLanguage = {
      languageName: languageName.trim(),
      rating: rating || 3,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Add to user's languages array
    user.languages.push(newLanguage);
    await user.save();

    // Get the added language with its ID
    const addedLanguage = user.languages[user.languages.length - 1];

    return {
      message: "Language added successfully",
      language: addedLanguage,
    };
  }

  // Update language in user profile
  async updateLanguage(userId, languageId, updateData) {
    const { languageName, rating } = updateData;

    const user = await User.findById(userId);

    if (!user) {
      throw new Error("User not found");
    }

    // Find the language to update
    const language = user.languages.id(languageId);

    if (!language) {
      throw new Error("Language not found");
    }

    // Validate rating if provided
    if (rating !== undefined) {
      if (rating < 1 || rating > 5) {
        throw new Error("Rating must be between 1 and 5");
      }
      language.rating = rating;
    }

    // Update language name if provided
    if (languageName !== undefined) {
      if (!languageName.trim()) {
        throw new Error("Language name cannot be empty");
      }

      // Check if new language name already exists (excluding current language)
      const languageExists = user.languages.some(
        (lang) =>
          lang._id.toString() !== languageId &&
          lang.languageName.toLowerCase() === languageName.toLowerCase()
      );

      if (languageExists) {
        throw new Error("Language already exists in your profile");
      }

      language.languageName = languageName.trim();
    }

    language.updatedAt = new Date();
    await user.save();

    return {
      message: "Language updated successfully",
      language: language,
    };
  }

  // Remove language from user profile
  // Remove language from user profile
  async removeLanguage(userId, languageId) {
    const user = await User.findById(userId);

    if (!user) {
      throw new Error("User not found");
    }

    console.log("Looking for language ID:", languageId);
    console.log("User languages:", user.languages);

    // Convert languageId to string for comparison
    const languageIdStr = languageId.toString();

    // Find the language index
    const languageIndex = user.languages.findIndex(
      (lang) => lang._id.toString() === languageIdStr
    );

    console.log("Found language at index:", languageIndex);

    if (languageIndex === -1) {
      throw new Error("Language not found");
    }

    // Remove the language using splice
    user.languages.splice(languageIndex, 1);

    await user.save();

    console.log("Language removed successfully");
    return {
      message: "Language removed successfully",
    };
  }

  async addCertification(userId, certificationData) {
    const {
      certificationName,
      issuingOrganization,
      credentialId,
      issueDate,
      expirationDate,
      doesNotExpire,
      credentialUrl,
    } = certificationData;

    // Validate required fields
    if (!certificationName || !certificationName.trim()) {
      throw new Error("Certification name is required");
    }

    if (!issuingOrganization || !issuingOrganization.trim()) {
      throw new Error("Issuing organization is required");
    }

    if (!issueDate) {
      throw new Error("Issue date is required");
    }

    // Validate dates
    const issue = new Date(issueDate);
    if (isNaN(issue.getTime())) {
      throw new Error("Invalid issue date");
    }

    let expiration = null;
    if (expirationDate && !doesNotExpire) {
      expiration = new Date(expirationDate);
      if (isNaN(expiration.getTime())) {
        throw new Error("Invalid expiration date");
      }
      if (expiration < issue) {
        throw new Error("Expiration date cannot be before issue date");
      }
    }

    const user = await User.findById(userId);

    if (!user) {
      throw new Error("User not found");
    }

    // Create new certification object
    const newCertification = {
      certificationName: certificationName.trim(),
      issuingOrganization: issuingOrganization.trim(),
      credentialId: credentialId ? credentialId.trim() : "",
      issueDate: issue,
      expirationDate: doesNotExpire ? null : expiration,
      doesNotExpire: !!doesNotExpire,
      credentialUrl: credentialUrl ? credentialUrl.trim() : "",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Add to user's certifications array
    user.certifications.push(newCertification);
    await user.save();

    // Get the added certification with its ID
    const addedCertification =
      user.certifications[user.certifications.length - 1];

    return {
      message: "Certification added successfully",
      certification: addedCertification,
    };
  }

  // Update certification in user profile
  async updateCertification(userId, certificationId, updateData) {
    const {
      certificationName,
      issuingOrganization,
      credentialId,
      issueDate,
      expirationDate,
      doesNotExpire,
      credentialUrl,
    } = updateData;

    const user = await User.findById(userId);

    if (!user) {
      throw new Error("User not found");
    }

    // Find the certification to update
    const certification = user.certifications.id(certificationId);

    if (!certification) {
      throw new Error("Certification not found");
    }

    // Validate dates if provided
    if (issueDate) {
      const issue = new Date(issueDate);
      if (isNaN(issue.getTime())) {
        throw new Error("Invalid issue date");
      }
      certification.issueDate = issue;
    }

    if (expirationDate && !doesNotExpire) {
      const expiration = new Date(expirationDate);
      if (isNaN(expiration.getTime())) {
        throw new Error("Invalid expiration date");
      }
      if (expiration < certification.issueDate) {
        throw new Error("Expiration date cannot be before issue date");
      }
      certification.expirationDate = expiration;
    } else if (doesNotExpire) {
      certification.expirationDate = null;
    }

    // Update fields if provided
    if (certificationName !== undefined) {
      if (!certificationName.trim()) {
        throw new Error("Certification name cannot be empty");
      }
      certification.certificationName = certificationName.trim();
    }

    if (issuingOrganization !== undefined) {
      if (!issuingOrganization.trim()) {
        throw new Error("Issuing organization cannot be empty");
      }
      certification.issuingOrganization = issuingOrganization.trim();
    }

    if (credentialId !== undefined) {
      certification.credentialId = credentialId ? credentialId.trim() : "";
    }

    if (doesNotExpire !== undefined) {
      certification.doesNotExpire = doesNotExpire;
      if (doesNotExpire) {
        certification.expirationDate = null;
      }
    }

    if (credentialUrl !== undefined) {
      certification.credentialUrl = credentialUrl ? credentialUrl.trim() : "";
    }

    certification.updatedAt = new Date();
    await user.save();

    return {
      message: "Certification updated successfully",
      certification: certification,
    };
  }

  // Remove certification from user profile
  async removeCertification(userId, certificationId) {
    try {
      // Update user by pulling the certification from the certifications array
      const user = await User.findByIdAndUpdate(
        userId,
        {
          $pull: { certifications: { _id: certificationId } },
        },
        { new: true }
      );

      if (!user) {
        throw new Error("User not found");
      }

      return {
        message: "Certification removed successfully",
      };
    } catch (error) {
      console.error("Error removing certification:", error);
      throw new Error("Failed to remove certification");
    }
  }
}

// Export a single instance of the ProfileService class
module.exports = new ProfileService();
