const express = require("express");
const { getHint } = require("../controllers/mentor.controller");
const { askDoubt, askCodeHelp } = require("../controllers/doubt.controller");
const verifyAuth = require("../middleware/auth.middleware");

const router = express.Router();

router.post("/hint", verifyAuth, getHint);
router.post("/ask", verifyAuth, askDoubt);
router.post("/code-help", verifyAuth, askCodeHelp);

module.exports = router;
