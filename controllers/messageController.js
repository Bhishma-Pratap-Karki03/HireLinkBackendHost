const mongoose = require("mongoose");
const Message = require("../models/messageModel");
const User = require("../models/userModel");
const ConnectionRequest = require("../models/connectionRequestModel");
const { getIO } = require("../socket");

// Chat controller for one-to-one candidate/recruiter messaging.
const ALLOWED_ROLES = new Set(["candidate", "recruiter"]);

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const normalizeUser = (userDoc) => {
  if (!userDoc) return null;
  return {
    id: userDoc._id.toString(),
    fullName: userDoc.fullName || "User",
    email: userDoc.email || "",
    role: userDoc.role || "",
    profilePicture: userDoc.profilePicture || "",
    currentJobTitle: userDoc.currentJobTitle || "",
  };
};

const getAllowedUser = async (userId) => {
  if (!isValidObjectId(userId)) return null;
  const user = await User.findById(userId)
    .select("fullName email role profilePicture currentJobTitle")
    .lean();
  if (!user || !ALLOWED_ROLES.has(user.role)) return null;
  return user;
};

exports.getConversations = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId || !isValidObjectId(userId)) {
      return res.status(401).json({
        success: false,
        message: "Not authorized",
      });
    }

    const [recentMessages, friends, unreadCountsRaw] = await Promise.all([
      Message.find({
        $or: [{ sender: userId }, { receiver: userId }],
      })
        .sort({ createdAt: -1 })
        .populate("sender", "fullName email role profilePicture currentJobTitle")
        .populate("receiver", "fullName email role profilePicture currentJobTitle")
        .lean(),
      ConnectionRequest.find({
        status: "accepted",
        $or: [{ requester: userId }, { recipient: userId }],
      })
        .populate("requester", "fullName email role profilePicture currentJobTitle")
        .populate("recipient", "fullName email role profilePicture currentJobTitle")
        .lean(),
      Message.aggregate([
        {
          $match: {
            receiver: new mongoose.Types.ObjectId(userId),
            readAt: null,
          },
        },
        {
          $group: {
            _id: "$sender",
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const unreadCounts = unreadCountsRaw.reduce((acc, entry) => {
      const senderId = entry?._id?.toString?.();
      if (!senderId) return acc;
      acc[senderId] = entry.count || 0;
      return acc;
    }, {});

    const conversationMap = new Map();

    recentMessages.forEach((message) => {
      const senderId = message.sender?._id?.toString();
      const receiverId = message.receiver?._id?.toString();
      const otherUser =
        senderId === userId ? message.receiver : message.sender;
      const otherUserId = otherUser?._id?.toString();
      if (!otherUserId || !ALLOWED_ROLES.has(otherUser.role)) return;

      if (!conversationMap.has(otherUserId)) {
        conversationMap.set(otherUserId, {
          user: normalizeUser(otherUser),
          lastMessage: {
            id: message._id.toString(),
            content: message.content,
            createdAt: message.createdAt,
            senderId,
            receiverId,
          },
          updatedAt: message.createdAt,
          unreadCount: unreadCounts[otherUserId] || 0,
        });
      }
    });

    friends.forEach((entry) => {
      const requesterId = entry.requester?._id?.toString();
      const recipientId = entry.recipient?._id?.toString();
      const otherUser =
        requesterId === userId ? entry.recipient : entry.requester;
      const otherUserId = otherUser?._id?.toString();
      if (!otherUserId || !ALLOWED_ROLES.has(otherUser.role)) return;

      if (!conversationMap.has(otherUserId)) {
        const connectedAt = entry.respondedAt || entry.updatedAt || entry.createdAt;
        conversationMap.set(otherUserId, {
          user: normalizeUser(otherUser),
          lastMessage: null,
          updatedAt: connectedAt,
          unreadCount: unreadCounts[otherUserId] || 0,
        });
      }
    });

    const conversations = Array.from(conversationMap.values()).sort((a, b) => {
      const dateA = new Date(a.updatedAt).getTime();
      const dateB = new Date(b.updatedAt).getTime();
      return dateB - dateA;
    });

    return res.status(200).json({
      success: true,
      conversations,
    });
  } catch (error) {
    next(error);
  }
};

exports.getConversationMessages = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const { userId: otherUserId } = req.params;

    if (!userId || !isValidObjectId(userId)) {
      return res.status(401).json({
        success: false,
        message: "Not authorized",
      });
    }

    if (!otherUserId || !isValidObjectId(otherUserId)) {
      return res.status(400).json({
        success: false,
        message: "Valid userId is required",
      });
    }

    const otherUser = await getAllowedUser(otherUserId);
    if (!otherUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const messages = await Message.find({
      $or: [
        { sender: userId, receiver: otherUserId },
        { sender: otherUserId, receiver: userId },
      ],
    })
      .sort({ createdAt: 1 })
      .lean();

    const readAt = new Date();
    const readResult = await Message.updateMany(
      {
        sender: otherUserId,
        receiver: userId,
        readAt: null,
      },
      {
        $set: { readAt },
      }
    );

    if ((readResult?.modifiedCount || 0) > 0) {
      const io = getIO();
      io
        ?.to(`user:${otherUserId}`)
        .emit("message:read", { byUserId: userId, readAt: readAt.toISOString() });
    }

    return res.status(200).json({
      success: true,
      user: normalizeUser(otherUser),
      messages: messages.map((message) => ({
        id: message._id.toString(),
        senderId: message.sender.toString(),
        receiverId: message.receiver.toString(),
        content: message.content,
        createdAt: message.createdAt,
        readAt: message.readAt,
      })),
    });
  } catch (error) {
    next(error);
  }
};

exports.sendMessage = async (req, res, next) => {
  try {
    const senderId = req.user?.id;
    const { receiverId, content } = req.body;

    if (!senderId || !isValidObjectId(senderId)) {
      return res.status(401).json({
        success: false,
        message: "Not authorized",
      });
    }

    if (!receiverId || !isValidObjectId(receiverId)) {
      return res.status(400).json({
        success: false,
        message: "Valid receiverId is required",
      });
    }

    if (senderId === receiverId) {
      return res.status(400).json({
        success: false,
        message: "You cannot message yourself",
      });
    }

    const sender = await getAllowedUser(senderId);
    if (!sender) {
      return res.status(403).json({
        success: false,
        message: "Only candidates and recruiters can send messages",
      });
    }

    const receiver = await getAllowedUser(receiverId);
    if (!receiver) {
      return res.status(404).json({
        success: false,
        message: "Receiver not found",
      });
    }

    const trimmed = (content || "").toString().trim();
    if (!trimmed) {
      return res.status(400).json({
        success: false,
        message: "Message content is required",
      });
    }

    const message = await Message.create({
      sender: senderId,
      receiver: receiverId,
      content: trimmed,
    });

    const payload = {
      id: message._id.toString(),
      senderId,
      receiverId,
      content: message.content,
      createdAt: message.createdAt,
      sender: normalizeUser(sender),
      receiver: normalizeUser(receiver),
    };

    const io = getIO();
    io?.to(`user:${receiverId}`).emit("message:new", payload);
    io?.to(`user:${senderId}`).emit("message:new", payload);

    return res.status(201).json({
      success: true,
      message: payload,
    });
  } catch (error) {
    next(error);
  }
};


