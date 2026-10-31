const express = require("express");
const { runCode } = require("../controllers/execute.controller");
const verifyAuth = require("../middleware/auth.middleware");
const executeRateLimit = require("../middleware/executeRateLimit");

const router = express.Router();

router.post("/", verifyAuth, executeRateLimit, runCode);

module.exports = router;
