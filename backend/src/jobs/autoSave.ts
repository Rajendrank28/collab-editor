// backend/src/jobs/autoSave.ts
import mongoose from "mongoose";
import { Redis } from "ioredis";

type SnippetCodeState = { html?: string; css?: string; js?: string };

const ACTIVE_SET_KEY = "active-snippets";
const SNIPPET_CODE_KEY = (id: string) => `snippet:${id}:code`;

/**
 * Start an auto-save background job that:
 * 1) reads active snippet ids from Redis set "active-snippets"
 * 2) for each id reads snippet:<id>:code JSON from redis
 * 3) updates MongoDB Snippet document with the code (if the doc exists)
 *
 * Note: this expects a Mongoose model named "Snippet" to be registered
 * (e.g. via your models file). We carefully detect it via mongoose.models.
 */
export function startAutoSave(redisClient: Redis, intervalMs = 30_000) {
  if (!redisClient) {
    console.warn("AutoSave: redis client not provided — auto-save disabled.");
    return { stop: () => {} };
  }

  let timer: NodeJS.Timeout | null = null;
  let running = false;

  // Safe lookup of Mongoose model
  const getSnippetModel = () => {
    // Prefer existing model if registered
    if (mongoose.models && mongoose.models.Snippet) {
      return mongoose.models.Snippet;
    }
    try {
      // try require (in case your project registers model under a path)
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const maybe = require("../models/snippet");
      return maybe.default || maybe.Snippet || maybe;
    } catch {
      // fallback: try mongoose.model (may throw if not defined)
      try {
        return mongoose.model("Snippet");
      } catch (err) {
        console.error("AutoSave: Could not resolve Snippet model from mongoose or ../models/snippet. Make sure your model is registered.", err);
        return null;
      }
    }
  };

  // One pass of the job
  const runOnce = async () => {
    if (running) return;
    running = true;
    const Snippet = getSnippetModel();
    if (!Snippet) {
      running = false;
      return;
    }

    try {
      const activeIds: string[] = await redisClient.smembers(ACTIVE_SET_KEY);
      if (!Array.isArray(activeIds) || activeIds.length === 0) {
        // nothing active
        running = false;
        return;
      }

      // Log summary
      console.log(`⏱️ Auto-saving snippets: [ ${activeIds.join(", ")} ]`);

      // Process every active snippet (in parallel but safely)
      await Promise.all(
        activeIds.map(async (id) => {
          if (!id) return;
          try {
            const raw = await redisClient.get(SNIPPET_CODE_KEY(id));
            if (!raw) {
              // nothing to save for this snippet right now
              return;
            }
            let parsed: SnippetCodeState | null = null;
            try {
              parsed = JSON.parse(raw);
            } catch {
              parsed = null;
            }
            if (!parsed) return;

            // Optional: check snippet doc exists
            const doc = await Snippet.findById(id).exec();
            if (!doc) {
              // no snippet document (maybe deleted) — clean up redis keys
              try {
                await redisClient.srem(ACTIVE_SET_KEY, id);
                await redisClient.del(SNIPPET_CODE_KEY(id));
              } catch (e) {
                // ignore cleanup errors
              }
              return;
            }

            // Update fields if changed — only update fields present in parsed
            const update: any = {};
            if (typeof parsed.html === "string") update.html = parsed.html;
            if (typeof parsed.css === "string") update.css = parsed.css;
            if (typeof parsed.js === "string") update.js = parsed.js;
            if (Object.keys(update).length === 0) return;

            update.updatedAt = new Date();

            // Save to mongo — use findByIdAndUpdate to avoid replacing other fields
            await Snippet.findByIdAndUpdate(id, { $set: update }, { new: false }).exec();
          } catch (err) {
            console.error("AutoSave error for id", id, err);
          }
        })
      );
    } catch (err) {
      console.error("AutoSave job error:", err);
    } finally {
      running = false;
    }
  };

  // Start timer
  timer = setInterval(() => {
    void runOnce();
  }, intervalMs);

  // Run initial immediate pass
  void runOnce().catch((e) => console.error("AutoSave initial run error:", e));

  const stop = () => {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  };

  // Return control handle
  return { stop };
}

export default startAutoSave;
