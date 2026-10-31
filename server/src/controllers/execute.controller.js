const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const ApiResponse = require("../utils/ApiResponse");
const axios = require("axios");

const JUDGE0_URL = "https://judge0-ce.p.rapidapi.com/submissions";
const MAX_CODE_BYTES = 20 * 1024;
const MAX_STDIN_BYTES = 5 * 1024;
const JUDGE0_TIMEOUT_MS = 30_000;

function byteLength(value) {
    return Buffer.byteLength(String(value ?? ""), "utf8");
}

async function runWithJudge0(code, stdin) {
    const apiKey = process.env.JUDGE0_API_KEY?.trim();
    if (!apiKey) {
        throw new ApiError(
            503,
            "Code runner is not configured. Set JUDGE0_API_KEY in server/.env and restart the server.",
        );
    }

    const body = {
        source_code: code,
        language_id: 71,
    };
    if (stdin) {
        body.stdin = stdin;
    }

    const submitResponse = await axios.post(
        `${JUDGE0_URL}?base64_encoded=false&wait=true`,
        body,
        {
            headers: {
                "X-RapidAPI-Key": apiKey,
                "X-RapidAPI-Host":
                    process.env.JUDGE0_API_HOST?.trim() ||
                    "judge0-ce.p.rapidapi.com",
                "Content-Type": "application/json",
            },
            timeout: JUDGE0_TIMEOUT_MS,
        },
    );

    const stdout = (submitResponse.data.stdout || "").trim();
    const stderr = (submitResponse.data.stderr || "").trim();
    const compileOutput = (submitResponse.data.compile_output || "").trim();

    if (compileOutput) {
        return {
            success: false,
            output: "",
            error: compileOutput,
            status: "failed",
        };
    }

    return {
        success: !stderr,
        output: stdout || "(no output)",
        error: stderr || undefined,
        status: stderr ? "failed" : "completed",
    };
}

/** POST /api/execute — run Python via Judge0 (RapidAPI). Auth + size limits required. */
const runCode = asyncHandler(async (req, res) => {
    const { code, stdin } = req.body;

    if (!code || !String(code).trim()) {
        throw new ApiError(400, "code is required");
    }

    if (byteLength(code) > MAX_CODE_BYTES) {
        throw new ApiError(400, "Source code is too large (max 20 KB).");
    }

    const stdinValue = stdin == null ? "" : String(stdin);
    if (byteLength(stdinValue) > MAX_STDIN_BYTES) {
        throw new ApiError(400, "Stdin is too large (max 5 KB).");
    }

    try {
        const result = await runWithJudge0(String(code), stdinValue);
        return res.status(200).json(
            new ApiResponse(200, result, "Code executed"),
        );
    } catch (err) {
        if (err instanceof ApiError) {
            throw err;
        }

        const status = err.response?.status;
        // Never log request headers or API keys — status only.
        console.error("Judge0 execute failed:", status || "network/timeout");

        if (status === 401 || status === 403) {
            throw new ApiError(
                502,
                "Code runner rejected the request. Check server configuration and try again.",
            );
        }

        if (status === 429) {
            throw new ApiError(
                429,
                "Code runner is rate-limited. Please wait a moment and try again.",
            );
        }

        if (err.code === "ECONNABORTED" || err.message?.includes("timeout")) {
            throw new ApiError(
                504,
                "Code execution timed out. Try a simpler program.",
            );
        }

        throw new ApiError(
            502,
            "Unable to run code right now. Please try again.",
        );
    }
});

module.exports = { runCode };
