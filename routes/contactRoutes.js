const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const {
  submitContactMessage,
  listContactMessagesForAdmin,
  markContactMessageAsRead,
  deleteContactMessageForAdmin,
} = require("../controllers/contactController");

router.post("/", submitContactMessage);
router.get("/admin/messages", protect, listContactMessagesForAdmin);
router.patch("/admin/messages/:messageId/read", protect, markContactMessageAsRead);
router.delete("/admin/messages/:messageId", protect, deleteContactMessageForAdmin);

module.exports = router;
