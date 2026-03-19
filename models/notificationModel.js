const mongoose = require("mongoose");

// Stores in-app notifications shown to users.
const notificationSchema = new mongoose.Schema(
  {
    // User who receives this notification.
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    // User who triggered this notification.
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // Notification category.
    type: {
      type: String,
      enum: [
        "connection_request_received",
        "connection_request_accepted",
        "application_status_updated",
        "project_review_received",
        "company_review_received",
      ],
      required: true,
      index: true,
    },
    // Optional linked entities for specific notification types.
    request: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ConnectionRequest",
      default: null,
    },
    application: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AppliedJob",
      default: null,
    },
    // Read/unread state.
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    // Text and route target shown in UI.
    message: {
      type: String,
      required: true,
      trim: true,
    },
    targetPath: {
      type: String,
      default: "",
      trim: true,
    },
  },
  { timestamps: true }
);

// Fast lookup for recent notifications of one user.
notificationSchema.index({ user: 1, createdAt: -1 });

// Notification collection.
module.exports = mongoose.model("Notification", notificationSchema);
