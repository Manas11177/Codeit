const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require("../utils/ApiError");
const pool = require('../config/db');

const ALLOWED_PROGRESS_STATUSES = new Set(['started', 'in_progress']);

const updateProgress = asyncHandler(async (req, res) => {
    const { lesson_id, status } = req.body;
    const user_id = req.user.id;

    if (!lesson_id || !status) {
        throw new ApiError(400, "lesson_id and status are required");
    }

    if (!ALLOWED_PROGRESS_STATUSES.has(status)) {
        throw new ApiError(
            400,
            'Invalid status. Only "started" and "in_progress" are allowed on this endpoint.',
        );
    }

    const existing = await pool.query(
        "SELECT * FROM progress WHERE user_id = $1 AND lesson_id = $2",
        [user_id, lesson_id]
    );

    let result;

    if (existing.rows.length > 0) {
        result = await pool.query(
            `UPDATE progress
             SET status = $1,
                 attempts = attempts + 1,
                 completed_at = CASE WHEN $1 = 'completed' THEN NOW() ELSE completed_at END
             WHERE user_id = $2 AND lesson_id = $3
             RETURNING *`,
            [status, user_id, lesson_id]
        );
    } else {
        result = await pool.query(
            `INSERT INTO progress (user_id, lesson_id, status, attempts, completed_at)
             VALUES ($1, $2, $3, 1, CASE WHEN $3 = 'completed' THEN NOW() ELSE NULL END)
             RETURNING *`,
            [user_id, lesson_id, status]
        );
    }

    return res
        .status(200)
        .json(new ApiResponse(200, result.rows[0], "Progress updated successfully"));
});

const getMyProgress = asyncHandler(async (req, res) => {
    const user_id = req.user.id;

    const result = await pool.query(
        "SELECT * FROM progress WHERE user_id = $1",
        [user_id]
    );

    return res
        .status(200)
        .json(new ApiResponse(200, result.rows, "Your progress fetched successfully"));
});

module.exports = { updateProgress, getMyProgress };