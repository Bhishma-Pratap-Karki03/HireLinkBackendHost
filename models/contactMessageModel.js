const mongoose = require("mongoose");

// Stores messages submitted from the public contact-us form.
const contactMessageSchema = new mongoose.Schema(
  {
    // Sender name shown to admin in contact messages.
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    // Sender email for follow-up communication.
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 180,
    },
    // Short subject line of the message.
    subject: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    // Full message body written by the sender.
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 3000,
    },
    // Tracks whether admin has marked this message as read.
    isRead: {
      type: Boolean,
      default: false,
    },
    // Stores exact time when message was marked as read.
    readAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

// ContactMessage collection.
module.exports = mongoose.model("ContactMessage", contactMessageSchema);
