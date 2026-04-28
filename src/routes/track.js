/**
 * Track Route
 * ───────────
 * POST /track — validates payload, verifies workspace, inserts page view.
 */
import { Router } from "express";
import { validateTrackPayload } from "../middleware/validate.js";
import { verifyWorkspace } from "../middleware/verifyWorkspace.js";
import { handleTrack } from "../controllers/trackController.js";

const router = Router();

/**
 * POST /track
 * Flow: validate schema → verify workspace exists → controller → Supabase
 */
router.post("/track", validateTrackPayload, verifyWorkspace, handleTrack);

export default router;
