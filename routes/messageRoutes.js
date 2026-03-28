const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const {
  getConversations,
  getConversationMessages,
  sendMessage,
  deleteConversation,
} = require("../controllers/messageController");

router.get("/conversations", protect, getConversations);
router.get("/conversation/:userId", protect, getConversationMessages);
router.delete("/conversation/:userId", protect, deleteConversation);
router.post("/send", protect, sendMessage);

module.exports = router;
