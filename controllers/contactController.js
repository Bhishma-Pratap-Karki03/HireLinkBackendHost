const ContactMessage = require("../models/contactMessageModel");
// Handles public Contact Us submissions and admin-side message actions.

const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const isAdminUser = (req) =>
  String(req.user?.role || "").toLowerCase() === "admin";

const submitContactMessage = async (req, res) => {
  try {
    const name = String(req.body?.name || "").trim();
    const email = String(req.body?.email || "").trim().toLowerCase();
    const subject = String(req.body?.subject || "").trim();
    const message = String(req.body?.message || "").trim();

    if (!name || !email || !subject || !message) {
      return res.status(400).json({
        success: false,
        message: "All fields are required.",
      });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address.",
      });
    }

    const saved = await ContactMessage.create({
      name,
      email,
      subject,
      message,
    });

    return res.status(201).json({
      success: true,
      message: "Message submitted successfully.",
      data: {
        id: saved._id,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to submit contact message.",
      error: error.message,
    });
  }
};

const listContactMessagesForAdmin = async (req, res) => {
  try {
    if (!isAdminUser(req)) {
      return res.status(403).json({
        success: false,
        message: "Only admin can access contact messages.",
      });
    }

    const search = String(req.query?.search || "").trim();
    const status = String(req.query?.status || "all").toLowerCase();

    const query = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { subject: { $regex: search, $options: "i" } },
        { message: { $regex: search, $options: "i" } },
      ];
    }

    if (status === "read") {
      query.isRead = true;
    } else if (status === "unread") {
      query.isRead = false;
    }

    const messages = await ContactMessage.find(query)
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      messages,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch contact messages.",
      error: error.message,
    });
  }
};

const markContactMessageAsRead = async (req, res) => {
  try {
    if (!isAdminUser(req)) {
      return res.status(403).json({
        success: false,
        message: "Only admin can update contact messages.",
      });
    }

    const { messageId } = req.params;
    if (!messageId) {
      return res.status(400).json({
        success: false,
        message: "Message id is required.",
      });
    }

    const updated = await ContactMessage.findByIdAndUpdate(
      messageId,
      { isRead: true, readAt: new Date() },
      { new: true },
    ).lean();

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Message not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Message marked as read.",
      data: updated,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update contact message.",
      error: error.message,
    });
  }
};

const deleteContactMessageForAdmin = async (req, res) => {
  try {
    if (!isAdminUser(req)) {
      return res.status(403).json({
        success: false,
        message: "Only admin can delete contact messages.",
      });
    }

    const { messageId } = req.params;
    if (!messageId) {
      return res.status(400).json({
        success: false,
        message: "Message id is required.",
      });
    }

    const deleted = await ContactMessage.findByIdAndDelete(messageId).lean();

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Message not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Message deleted successfully.",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to delete contact message.",
      error: error.message,
    });
  }
};

module.exports = {
  submitContactMessage,
  listContactMessagesForAdmin,
  markContactMessageAsRead,
  deleteContactMessageForAdmin,
};


