const mongoose = require("mongoose");
const ConnectionRequest = require("../models/connectionRequestModel");
const Notification = require("../models/notificationModel");
const User = require("../models/userModel");
const { getIO } = require("../socket");

// Controller for sending/accepting/declining connections between candidates and recruiters.
const ALLOWED_ROLES = new Set(["candidate", "recruiter"]);
const FEED_NOTIFICATION_TYPES = [
  "connection_request_received",
  "connection_request_accepted",
  "application_status_updated",
  "project_review_received",
  "company_review_received",
];

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const buildProfilePath = (userDoc) => {
  const id = userDoc?._id?.toString?.() || "";
  const role = (userDoc?.role || "").toString().toLowerCase();
  if (!id) return "/home";
  return role === "recruiter" ? `/employer/${id}` : `/candidate/${id}`;
};

const mapNotification = (item) => {
  const actorId = item.actor?._id?.toString?.() || item.actor?.toString?.() || "";
  const actorRole = item.actor?.role || "";
  const actorName = item.actor?.fullName || "User";
  const message =
    item.type === "connection_request_accepted"
      ? `${actorName} accepted your connection request.`
      : item.type === "connection_request_received"
        ? `${actorName} sent you a connection request.`
        : item.type === "project_review_received"
          ? item.message || `${actorName} reviewed your project.`
          : item.type === "company_review_received"
            ? item.message || `${actorName} reviewed your company profile.`
        : item.message || "Your application status was updated.";
  const targetPath =
    item.targetPath ||
    (item.type === "application_status_updated"
      ? "/candidate/applied-status"
      : buildProfilePath(item.actor));
  return {
    id: item._id.toString(),
    type: item.type,
    isRead: Boolean(item.isRead),
    message,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    targetPath,
    actor: {
      id: actorId,
      fullName: item.actor?.fullName || "User",
      role: actorRole,
      profilePicture: item.actor?.profilePicture || "",
    },
  };
};

const emitNotificationCreated = async (userId, notificationId) => {
  const io = getIO();
  if (!io) return;

  const notification = await Notification.findById(notificationId)
    .populate("actor", "fullName role profilePicture")
    .lean();
  if (!notification) return;

  const unreadCount = await Notification.countDocuments({
    user: userId,
    isRead: false,
  });

  io.to(`user:${userId}`).emit("notification:connection:new", {
    notification: mapNotification(notification),
    unreadCount,
  });
};

const isConnectableRole = async (userId) => {
  const user = await User.findById(userId).select("role").lean();
  return !!user && ALLOWED_ROLES.has(user.role);
};

const getDisplayNameById = async (userId) => {
  if (!isValidObjectId(userId)) return "User";
  const user = await User.findById(userId).select("fullName").lean();
  return user?.fullName || "User";
};

exports.sendConnectionRequest = async (req, res, next) => {
  try {
    const requesterId = req.user?.id;
    const { recipientId } = req.body;

    if (!requesterId || !isValidObjectId(requesterId)) {
      return res.status(401).json({
        success: false,
        message: "Not authorized",
      });
    }

    if (!recipientId || !isValidObjectId(recipientId)) {
      return res.status(400).json({
        success: false,
        message: "Valid recipientId is required",
      });
    }

    if (requesterId === recipientId) {
      return res.status(400).json({
        success: false,
        message: "You cannot connect with yourself",
      });
    }

    const [requesterAllowed, recipientAllowed] = await Promise.all([
      isConnectableRole(requesterId),
      isConnectableRole(recipientId),
    ]);

    if (!requesterAllowed || !recipientAllowed) {
      return res.status(403).json({
        success: false,
        message: "Only candidates and recruiters can connect",
      });
    }

    const existing = await ConnectionRequest.findOne({
      requester: requesterId,
      recipient: recipientId,
    });

    if (existing) {
      return res.status(200).json({
        success: true,
        message: "Connection status already exists",
        status: existing.status,
      });
    }

    const reciprocal = await ConnectionRequest.findOne({
      requester: recipientId,
      recipient: requesterId,
    });

    if (reciprocal && reciprocal.status === "pending") {
      reciprocal.status = "accepted";
      reciprocal.respondedAt = new Date();
      await reciprocal.save();
      const accepterName = await getDisplayNameById(reciprocal.recipient);

      const acceptedNotification = await Notification.create({
        user: reciprocal.requester,
        actor: reciprocal.recipient,
        type: "connection_request_accepted",
        request: reciprocal._id,
        message: `${accepterName} accepted your connection request.`,
      });

      const io = getIO();
      const payload = {
        type: "accepted",
        requesterId: reciprocal.requester.toString(),
        recipientId: reciprocal.recipient.toString(),
        requestId: reciprocal._id.toString(),
        status: "accepted",
        occurredAt: reciprocal.respondedAt?.toISOString?.() || new Date().toISOString(),
      };
      io?.to(`user:${requesterId}`).emit("connection:request:updated", payload);
      io?.to(`user:${recipientId}`).emit("connection:request:updated", payload);
      await emitNotificationCreated(reciprocal.requester.toString(), acceptedNotification._id);

      return res.status(200).json({
        success: true,
        message: "Connection request accepted",
        status: "accepted",
      });
    }

    const request = await ConnectionRequest.create({
      requester: requesterId,
      recipient: recipientId,
      status: "pending",
    });
    const requesterName = await getDisplayNameById(requesterId);

    const requestNotification = await Notification.create({
      user: recipientId,
      actor: requesterId,
      type: "connection_request_received",
      request: request._id,
      message: `${requesterName} sent you a connection request.`,
    });

    const io = getIO();
    const payload = {
      type: "new",
      requesterId,
      recipientId,
      requestId: request._id.toString(),
      status: "pending",
      occurredAt: request.createdAt?.toISOString?.() || new Date().toISOString(),
    };
    io?.to(`user:${recipientId}`).emit("connection:request:new", payload);
    io?.to(`user:${requesterId}`).emit("connection:request:updated", payload);
    await emitNotificationCreated(recipientId, requestNotification._id);

    return res.status(201).json({
      success: true,
      message: "Connection request sent",
      status: request.status,
    });
  } catch (error) {
    next(error);
  }
};

exports.respondConnectionRequest = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const { requesterId, action } = req.body;

    if (!requesterId || !isValidObjectId(requesterId)) {
      return res.status(400).json({
        success: false,
        message: "Valid requesterId is required",
      });
    }

    if (!["accept", "reject", "delete"].includes(action)) {
      return res.status(400).json({
        success: false,
        message: "action must be accept, reject or delete",
      });
    }

    const request = await ConnectionRequest.findOne({
      requester: requesterId,
      recipient: userId,
      status: "pending",
    });

    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Pending request not found",
      });
    }

    if (action === "accept") {
      request.status = "accepted";
      request.respondedAt = new Date();
      await request.save();
      const accepterName = await getDisplayNameById(request.recipient);
      const acceptedNotification = await Notification.create({
        user: request.requester,
        actor: request.recipient,
        type: "connection_request_accepted",
        request: request._id,
        message: `${accepterName} accepted your connection request.`,
      });
      await emitNotificationCreated(request.requester.toString(), acceptedNotification._id);
    } else {
      await request.deleteOne();
    }

    const io = getIO();
    const payload = {
      type: action === "accept" ? "accepted" : "removed",
      requesterId: request.requester.toString(),
      recipientId: request.recipient.toString(),
      requestId: request._id.toString(),
      status: action === "accept" ? "accepted" : "none",
      occurredAt:
        action === "accept"
          ? request.respondedAt?.toISOString?.() || new Date().toISOString()
          : new Date().toISOString(),
    };
    io?.to(`user:${request.requester.toString()}`).emit("connection:request:updated", payload);
    io?.to(`user:${request.recipient.toString()}`).emit("connection:request:updated", payload);

    return res.status(200).json({
      success: true,
      message:
        action === "accept"
          ? "Connection request accepted"
          : "Connection request removed",
      status: action === "accept" ? "accepted" : "none",
    });
  } catch (error) {
    next(error);
  }
};

exports.getConnectionStatuses = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const targetIdsRaw = (req.query.targetIds || "").toString();
    const targetIds = targetIdsRaw
      .split(",")
      .map((id) => id.trim())
      .filter((id) => isValidObjectId(id) && id !== userId);

    if (targetIds.length === 0) {
      return res.status(200).json({ success: true, statuses: {} });
    }

    const requests = await ConnectionRequest.find({
      $or: [
        { requester: userId, recipient: { $in: targetIds } },
        { recipient: userId, requester: { $in: targetIds } },
      ],
    })
      .select("requester recipient status")
      .lean();

    const statuses = {};
    targetIds.forEach((id) => {
      statuses[id] = "none";
    });

    requests.forEach((item) => {
      const requesterId = item.requester.toString();
      const recipientId = item.recipient.toString();
      const otherUserId = requesterId === userId ? recipientId : requesterId;

      if (!targetIds.includes(otherUserId)) {
        return;
      }

      if (item.status === "accepted") {
        statuses[otherUserId] = "friend";
      } else if (item.status === "pending") {
        statuses[otherUserId] = "pending";
      } else {
        statuses[otherUserId] = "none";
      }
    });

    return res.status(200).json({
      success: true,
      statuses,
    });
  } catch (error) {
    next(error);
  }
};

exports.getIncomingConnectionRequests = async (req, res, next) => {
  try {
    const userId = req.user?.id;

    if (!userId || !isValidObjectId(userId)) {
      return res.status(401).json({
        success: false,
        message: "Not authorized",
      });
    }

    const requests = await ConnectionRequest.find({
      recipient: userId,
      status: "pending",
    })
      .populate("requester", "fullName email role profilePicture currentJobTitle")
      .sort({ createdAt: -1 })
      .lean();

    const mapped = requests
      .filter((request) => request.requester)
      .map((request) => ({
        id: request._id,
        requester: {
          id: request.requester._id,
          fullName: request.requester.fullName || "User",
          email: request.requester.email || "",
          role: request.requester.role || "",
          profilePicture: request.requester.profilePicture || "",
          currentJobTitle: request.requester.currentJobTitle || "",
        },
        createdAt: request.createdAt,
      }));

    return res.status(200).json({
      success: true,
      requests: mapped,
    });
  } catch (error) {
    next(error);
  }
};

exports.getConnectedUsers = async (req, res, next) => {
  try {
    const userId = req.user?.id;

    if (!userId || !isValidObjectId(userId)) {
      return res.status(401).json({
        success: false,
        message: "Not authorized",
      });
    }

    const connections = await ConnectionRequest.find({
      status: "accepted",
      $or: [{ requester: userId }, { recipient: userId }],
    })
      .populate("requester", "fullName email role profilePicture currentJobTitle")
      .populate("recipient", "fullName email role profilePicture currentJobTitle")
      .sort({ updatedAt: -1 })
      .lean();

    const friends = connections
      .map((item) => {
        const requesterId = item.requester?._id?.toString();
        const recipientId = item.recipient?._id?.toString();
        const otherUser =
          requesterId === userId ? item.recipient : item.requester;

        if (!otherUser) return null;

        return {
          id: otherUser._id,
          fullName: otherUser.fullName || "User",
          email: otherUser.email || "",
          role: otherUser.role || "",
          profilePicture: otherUser.profilePicture || "",
          currentJobTitle: otherUser.currentJobTitle || "",
          connectedAt: item.respondedAt || item.updatedAt || item.createdAt,
        };
      })
      .filter(Boolean);

    return res.status(200).json({
      success: true,
      friends,
    });
  } catch (error) {
    next(error);
  }
};

exports.removeConnection = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const { targetUserId } = req.body;

    if (!userId || !isValidObjectId(userId)) {
      return res.status(401).json({
        success: false,
        message: "Not authorized",
      });
    }

    if (!targetUserId || !isValidObjectId(targetUserId)) {
      return res.status(400).json({
        success: false,
        message: "Valid targetUserId is required",
      });
    }

    const deleted = await ConnectionRequest.findOneAndDelete({
      status: "accepted",
      $or: [
        { requester: userId, recipient: targetUserId },
        { requester: targetUserId, recipient: userId },
      ],
    });

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Connection not found",
      });
    }

    const io = getIO();
    const payload = {
      type: "connection-removed",
      requesterId: deleted.requester.toString(),
      recipientId: deleted.recipient.toString(),
      requestId: deleted._id.toString(),
      status: "none",
      occurredAt: new Date().toISOString(),
    };
    io?.to(`user:${deleted.requester.toString()}`).emit("connection:request:updated", payload);
    io?.to(`user:${deleted.recipient.toString()}`).emit("connection:request:updated", payload);

    return res.status(200).json({
      success: true,
      message: "Connection removed",
    });
  } catch (error) {
    next(error);
  }
};

exports.getMutualConnections = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const { targetUserId } = req.params;

    if (!userId || !isValidObjectId(userId)) {
      return res.status(401).json({
        success: false,
        message: "Not authorized",
      });
    }

    if (!targetUserId || !isValidObjectId(targetUserId)) {
      return res.status(400).json({
        success: false,
        message: "Valid targetUserId is required",
      });
    }

    if (userId === targetUserId) {
      return res.status(200).json({
        success: true,
        count: 0,
        mutualConnections: [],
      });
    }

    const [myConnections, targetConnections] = await Promise.all([
      ConnectionRequest.find({
        status: "accepted",
        $or: [{ requester: userId }, { recipient: userId }],
      })
        .select("requester recipient")
        .lean(),
      ConnectionRequest.find({
        status: "accepted",
        $or: [{ requester: targetUserId }, { recipient: targetUserId }],
      })
        .select("requester recipient")
        .lean(),
    ]);

    const myConnectedIds = new Set(
      myConnections.map((item) => {
        const requesterId = item.requester.toString();
        const recipientId = item.recipient.toString();
        return requesterId === userId ? recipientId : requesterId;
      }),
    );

    const targetConnectedIds = targetConnections.map((item) => {
      const requesterId = item.requester.toString();
      const recipientId = item.recipient.toString();
      return requesterId === targetUserId ? recipientId : requesterId;
    });

    const mutualIds = targetConnectedIds.filter((id) => myConnectedIds.has(id));

    if (mutualIds.length === 0) {
      return res.status(200).json({
        success: true,
        count: 0,
        mutualConnections: [],
      });
    }

    const users = await User.find({ _id: { $in: mutualIds } })
      .select("fullName profilePicture role currentJobTitle")
      .lean();

    const usersById = new Map(users.map((user) => [user._id.toString(), user]));
    const mutualConnections = mutualIds
      .map((id) => usersById.get(id))
      .filter(Boolean)
      .map((user) => ({
        id: user._id.toString(),
        fullName: user.fullName || "User",
        profilePicture: user.profilePicture || "",
        role: user.role || "",
        currentJobTitle: user.currentJobTitle || "",
      }));

    return res.status(200).json({
      success: true,
      count: mutualConnections.length,
      mutualConnections,
    });
  } catch (error) {
    next(error);
  }
};

exports.getRecentConnectionNotifications = async (req, res, next) => {
  try {
    const userId = req.user?.id;

    if (!userId || !isValidObjectId(userId)) {
      return res.status(401).json({
        success: false,
        message: "Not authorized",
      });
    }

    const requestedLimit = Number.parseInt((req.query.limit || "5").toString(), 10);
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(Math.max(requestedLimit, 1), 100)
      : 5;
    const requestedPage = Number.parseInt((req.query.page || "1").toString(), 10);
    const page = Number.isFinite(requestedPage)
      ? Math.max(requestedPage, 1)
      : 1;
    const skip = (page - 1) * limit;
    const q = (req.query.q || "").toString().trim();
    const from = (req.query.from || "").toString().trim();
    const to = (req.query.to || "").toString().trim();

    const query = {
      user: userId,
      type: {
        $in: FEED_NOTIFICATION_TYPES,
      },
    };
    if (q) {
      query.message = { $regex: q, $options: "i" };
    }
    if (from || to) {
      const createdAt = {};
      if (from) {
        const fromDate = new Date(`${from}T00:00:00.000Z`);
        if (!Number.isNaN(fromDate.getTime())) {
          createdAt.$gte = fromDate;
        }
      }
      if (to) {
        const toDate = new Date(`${to}T23:59:59.999Z`);
        if (!Number.isNaN(toDate.getTime())) {
          createdAt.$lte = toDate;
        }
      }
      if (Object.keys(createdAt).length > 0) {
        query.createdAt = createdAt;
      }
    }

    const [notifications, total] = await Promise.all([
      Notification.find(query)
      .populate("actor", "fullName role profilePicture")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
      Notification.countDocuments(query),
    ]);

    const unreadCount = await Notification.countDocuments({
      user: userId,
      type: {
        $in: FEED_NOTIFICATION_TYPES,
      },
      isRead: false,
    });

    return res.status(200).json({
      success: true,
      notifications: notifications.map(mapNotification),
      unreadCount,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(Math.ceil(total / limit), 1),
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.markConnectionNotificationRead = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const { notificationId } = req.body;

    if (!userId || !isValidObjectId(userId)) {
      return res.status(401).json({
        success: false,
        message: "Not authorized",
      });
    }

    if (!notificationId || !isValidObjectId(notificationId)) {
      return res.status(400).json({
        success: false,
        message: "Valid notificationId is required",
      });
    }

    const notification = await Notification.findOneAndUpdate(
      {
        _id: notificationId,
        user: userId,
        type: {
          $in: FEED_NOTIFICATION_TYPES,
        },
      },
      { $set: { isRead: true } },
      { new: true }
    )
      .populate("actor", "fullName role profilePicture")
      .lean();

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    const unreadCount = await Notification.countDocuments({
      user: userId,
      type: {
        $in: FEED_NOTIFICATION_TYPES,
      },
      isRead: false,
    });

    return res.status(200).json({
      success: true,
      notification: mapNotification(notification),
      unreadCount,
    });
  } catch (error) {
    next(error);
  }
};

exports.deleteConnectionNotification = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const { notificationId } = req.body;

    if (!userId || !isValidObjectId(userId)) {
      return res.status(401).json({
        success: false,
        message: "Not authorized",
      });
    }

    if (!notificationId || !isValidObjectId(notificationId)) {
      return res.status(400).json({
        success: false,
        message: "Valid notificationId is required",
      });
    }

    const deleted = await Notification.findOneAndDelete({
      _id: notificationId,
      user: userId,
      type: {
        $in: FEED_NOTIFICATION_TYPES,
      },
    }).lean();

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    const unreadCount = await Notification.countDocuments({
      user: userId,
      type: {
        $in: FEED_NOTIFICATION_TYPES,
      },
      isRead: false,
    });

    return res.status(200).json({
      success: true,
      message: "Notification removed",
      notificationId,
      unreadCount,
    });
  } catch (error) {
    next(error);
  }
};





