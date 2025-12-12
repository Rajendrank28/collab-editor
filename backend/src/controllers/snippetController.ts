// backend/src/controllers/snippetController.ts
import { Request, Response } from "express";
import mongoose from "mongoose";

type SnippetDoc = {
  _id: string;
  title?: string;
  html?: string;
  css?: string;
  js?: string;
  isPublic?: boolean;
  owner?: string | null;
  views?: number;
  createdAt?: Date;
  updatedAt?: Date;
};

// === Safe model resolver ===
// Try to import the model file if available, otherwise fall back to mongoose.models or mongoose.model("Snippet").
function resolveSnippetModel(): any {
  // If the model is already registered with mongoose, return it.
  if (mongoose.models && (mongoose.models.Snippet || mongoose.models.snippet)) {
    return mongoose.models.Snippet || mongoose.models.snippet;
  }

  // Try requiring the model file (many projects export default or named)
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const maybe = require("../models/snippet");
    // CommonJS / ES module default export
    if (maybe && (maybe.default || maybe.Snippet || maybe)) {
      return maybe.default || maybe.Snippet || maybe;
    }
  } catch (err) {
    // not found or require failed — we'll try mongoose.model below
  }

  // Final fallback: try to get model by name (may throw if not defined)
  try {
    return mongoose.model("Snippet");
  } catch (err) {
    throw new Error(
      "Snippet model could not be resolved. Ensure backend/src/models/snippet.ts exists and registers the model as `module.exports = mongoose.model('Snippet', schema)` or exports default."
    );
  }
}

const SnippetModel = resolveSnippetModel();

// Helper to check ObjectId validity
const isValidObjectId = (id?: string) => {
  if (!id) return false;
  return mongoose.Types.ObjectId.isValid(id);
};

export const listSnippets = async (req: Request, res: Response) => {
  try {
    const page = Number(req.query.page || 1);
    const limit = 20;
    const skip = (page - 1) * limit;
    const docs = await SnippetModel.find({ isPublic: true }).sort({ updatedAt: -1 }).skip(skip).limit(limit).lean().exec();
    res.json(docs);
  } catch (err) {
    console.error("List snippets error:", err);
    res.status(500).json({ message: "Failed to list snippets" });
  }
};

export const getSnippet = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    if (!isValidObjectId(id)) return res.status(400).json({ message: "Invalid snippet id" });

    // Atomic increment views by 1 and return updated document
    const snippet = await SnippetModel.findByIdAndUpdate(id, { $inc: { views: 1 } }, { new: true }).lean().exec();

    if (!snippet) return res.status(404).json({ message: "Snippet not found" });

    res.json(snippet);
  } catch (err) {
    console.error("Get snippet error:", err);
    res.status(500).json({ message: "Failed to get snippet" });
  }
};

export const createSnippet = async (req: Request, res: Response) => {
  try {
    const { title, html, css, js, isPublic } = req.body;
    const owner = (req as any).userId ?? null;
    const doc = new SnippetModel({ title, html, css, js, owner, isPublic: !!isPublic, views: 0 });
    await doc.save();
    res.status(201).json(doc);
  } catch (err) {
    console.error("Create snippet error:", err);
    res.status(500).json({ message: "Failed to create snippet" });
  }
};

export const updateSnippet = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    if (!isValidObjectId(id)) return res.status(400).json({ message: "Invalid id" });
    const data = req.body;
    const doc = await SnippetModel.findByIdAndUpdate(id, { $set: data }, { new: true }).exec();
    if (!doc) return res.status(404).json({ message: "Not found" });
    res.json(doc);
  } catch (err) {
    console.error("Update snippet error:", err);
    res.status(500).json({ message: "Failed to update snippet" });
  }
};

export const deleteSnippet = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    if (!isValidObjectId(id)) return res.status(400).json({ message: "Invalid id" });
    await SnippetModel.findByIdAndDelete(id).exec();
    res.status(204).end();
  } catch (err) {
    console.error("Delete snippet error:", err);
    res.status(500).json({ message: "Failed to delete snippet" });
  }
};

export const forkSnippet = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    if (!isValidObjectId(id)) return res.status(400).json({ message: "Invalid id" });
    const original = await SnippetModel.findById(id).lean().exec();
    if (!original) return res.status(404).json({ message: "Not found" });
    const owner = (req as any).userId ?? null;
    const copy = new SnippetModel({
      title: `${original.title || "Untitled"} (Fork)`,
      html: original.html,
      css: original.css,
      js: original.js,
      isPublic: original.isPublic,
      owner,
      views: 0,
    });
    await copy.save();
    res.status(201).json(copy);
  } catch (err) {
    console.error("Fork snippet error:", err);
    res.status(500).json({ message: "Failed to fork snippet" });
  }
};
