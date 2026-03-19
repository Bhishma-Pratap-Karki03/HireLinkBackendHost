const mongoose = require("mongoose");

// Stores direct chat messages between two users.
const messageSchema = new mongoose.Schema(
  {
    // Sender of the message.
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    // Receiver of the message.
    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    // Message text content.
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    // Set when receiver reads the message.
    readAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Helps conversation listing sorted by latest messages.
messageSchema.index({ sender: 1, receiver: 1, createdAt: -1 });

// Message collection.
module.exports = mongoose.model("Message", messageSchema);
