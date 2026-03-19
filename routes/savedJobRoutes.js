const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const savedJobController = require("../controllers/savedJobController");

const router = express.Router();

router.get("/status/:jobId", protect, savedJobController.checkSaved);
router.get("/mine", protect, savedJobController.listSaved);
router.post("/toggle", protect, savedJobController.toggleSaveJob);

module.exports = router;
