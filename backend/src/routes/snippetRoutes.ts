// backend/src/routes/snippetRoutes.ts
import express from "express";
import * as snippetController from "../controllers/snippetController";
import { auth } from "../middleware/auth"; // adjust path if needed

const router = express.Router();

// Public list
router.get("/", snippetController.listSnippets);

// Protected create
router.post("/", auth, snippetController.createSnippet);

// Get single
router.get("/:id", snippetController.getSnippet);

// Update (protected)
router.put("/:id", auth, snippetController.updateSnippet);

// Delete (protected)
router.delete("/:id", auth, snippetController.deleteSnippet);

// Fork (protected)
router.post("/:id/fork", auth, snippetController.forkSnippet);

export default router;
