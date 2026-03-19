const mongoose = require("mongoose");

// Stores connection/friend requests between users.
const connectionRequestSchema = new mongoose.Schema(
  {
    // User who sends the request.
    requester: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    // User who receives the request.
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    // Current state of this request.
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected"],
      default: "pending",
      index: true,
    },
    // When request was accepted/rejected.
    respondedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Prevents duplicate request between same user pair.
connectionRequestSchema.index({ requester: 1, recipient: 1 }, { unique: true });

// ConnectionRequest collection.
module.exports = mongoose.model("ConnectionRequest", connectionRequestSchema);
