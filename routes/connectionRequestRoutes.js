const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const {
  sendConnectionRequest,
  respondConnectionRequest,
  getConnectionStatuses,
  getIncomingConnectionRequests,
  getConnectedUsers,
  removeConnection,
  getMutualConnections,
  getRecentConnectionNotifications,
  markConnectionNotificationRead,
  deleteConnectionNotification,
} = require("../controllers/connectionRequestController");

router.post("/request", protect, sendConnectionRequest);
router.post("/respond", protect, respondConnectionRequest);
router.get("/statuses", protect, getConnectionStatuses);
router.get("/incoming", protect, getIncomingConnectionRequests);
router.get("/friends", protect, getConnectedUsers);
router.get("/mutual/:targetUserId", protect, getMutualConnections);
router.get("/notifications", protect, getRecentConnectionNotifications);
router.post("/notifications/read", protect, markConnectionNotificationRead);
router.post("/notifications/delete", protect, deleteConnectionNotification);
router.post("/remove", protect, removeConnection);

module.exports = router;
