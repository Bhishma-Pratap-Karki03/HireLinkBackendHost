const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const {
  getConversations,
  getConversationMessages,
  sendMessage,
} = require("../controllers/messageController");

router.get("/conversations", protect, getConversations);
router.get("/conversation/:userId", protect, getConversationMessages);
router.post("/send", protect, sendMessage);

module.exports = router;
