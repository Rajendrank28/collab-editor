// backend/src/sockets/snippetSocket.ts
import { Server, Socket } from "socket.io";
import { redis } from "../config/redis"; // ioredis client (lowercase command names)

interface SnippetState {
  html: string;
  css: string;
  js: string;
}

type CursorPos = { lineNumber: number; column: number };

const safeParse = (s: string | null) => {
  if (!s) return null;
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
};

const normalizeUsername = (u: any) => (typeof u === "string" && u ? u : "anonymous");

const SOCKET_HASH_FOR = (snippetId: string) => `snippet:${snippetId}:sockets`;
const SNIPPET_CODE_KEY = (snippetId: string) => `snippet:${snippetId}:code`;

export const snippetSocket = (io: Server, socket: Socket) => {
  console.log("🟢 socket connected:", socket.id);

  // Helper: broadcast active users for a snippet (dedup usernames)
  const broadcastActiveUsers = async (snippetId: string) => {
    try {
      const hashKey = SOCKET_HASH_FOR(snippetId);
      const values: string[] = await redis.hvals(hashKey); // ioredis: hvals
      const usernames = values.map((v) => {
        try {
          const parsed = JSON.parse(v);
          return parsed?.username ?? String(v);
        } catch {
          return String(v);
        }
      });
      // Option A: dedupe by username (show unique usernames only)
      const unique = Array.from(new Set(usernames));
      io.to(snippetId).emit("active-users", unique);
    } catch (err) {
      console.error("broadcastActiveUsers error:", err);
    }
  };

  // join-snippet: store socket-scoped presence and send current code + active users
  socket.on("join-snippet", async ({ snippetId, username }: { snippetId: string; username?: string }) => {
    try {
      if (!snippetId) return;
      const u = normalizeUsername(username);
      socket.join(snippetId);

      // store socket->username in hash: JSON string
      const hashKey = SOCKET_HASH_FOR(snippetId);
      await redis.hset(hashKey, socket.id, JSON.stringify({ username: u, joinedAt: Date.now() })); // ioredis: hset

      // mark snippet active (optional)
      await redis.sadd("active-snippets", snippetId); // ioredis: sadd

      // broadcast updated active users
      await broadcastActiveUsers(snippetId);

      // send current code (if any)
      try {
        const raw = await redis.get(SNIPPET_CODE_KEY(snippetId));
        const state = safeParse(raw) as SnippetState | null;
        if (state) socket.emit("code-updated", state);
      } catch (err) {
        console.error("redis get snippet code error:", err);
      }

      console.log(`👥 ${u} joined snippet ${snippetId} (socket ${socket.id})`);
    } catch (err) {
      console.error("join-snippet error:", err);
    }
  });

  // leave-snippet: explicit leave from client
  socket.on("leave-snippet", async ({ snippetId }: { snippetId: string }) => {
    try {
      if (!snippetId) return;
      socket.leave(snippetId);
      const hashKey = SOCKET_HASH_FOR(snippetId);
      await redis.hdel(hashKey, socket.id); // ioredis: hdel

      // if no sockets remain, optionally remove snippet from active set
      const remaining = await redis.hlen(hashKey); // ioredis: hlen
      if (!remaining) {
        await redis.srem("active-snippets", snippetId); // ioredis: srem
      }

      await broadcastActiveUsers(snippetId);
      console.log(`👋 socket ${socket.id} left snippet ${snippetId}`);
    } catch (err) {
      console.error("leave-snippet error:", err);
    }
  });

  // code-change (persist to redis and broadcast)
  let codeDebounceTimer: NodeJS.Timeout | null = null;
  const persistAndBroadcastCode = async (snippetId: string, state: SnippetState) => {
    try {
      await redis.set(SNIPPET_CODE_KEY(snippetId), JSON.stringify(state)); // ioredis: set
      socket.to(snippetId).emit("code-updated", state);
    } catch (err) {
      console.error("persistAndBroadcastCode error:", err);
    }
  };
  const scheduleCodePersist = (snippetId: string, state: SnippetState) => {
    if (codeDebounceTimer) clearTimeout(codeDebounceTimer);
    codeDebounceTimer = setTimeout(() => persistAndBroadcastCode(snippetId, state), 200);
  };

  socket.on("code-change", (data: { snippetId: string; html?: string; css?: string; js?: string }) => {
    try {
      const { snippetId, html = "", css = "", js = "" } = data;
      if (!snippetId) return;
      const state: SnippetState = { html, css, js };
      scheduleCodePersist(snippetId, state);
    } catch (err) {
      console.error("code-change handler error:", err);
    }
  });

  // cursor-move -> broadcast to others
  socket.on(
    "cursor-move",
    (payload: {
      snippetId: string;
      username?: string;
      color?: string | null;
      cursor: CursorPos | null;
    }) => {
      try {
        const { snippetId, username, cursor, color } = payload;
        if (!snippetId) return;
        socket.to(snippetId).emit("cursor-updated", {
          username: normalizeUsername(username),
          color: color ?? null,
          cursor: cursor ?? null,
          socketId: socket.id,
        });
      } catch (err) {
        console.error("cursor-move handler error:", err);
      }
    }
  );

  // disconnect: remove this socket from all snippet hashes it was part of
  socket.on("disconnect", async (reason) => {
    try {
      console.log("🔴 socket disconnected:", socket.id, "reason:", reason);
      const rooms = Array.from(socket.rooms).filter((r) => r !== socket.id);
      for (const room of rooms) {
        try {
          const hashKey = SOCKET_HASH_FOR(room);
          await redis.hdel(hashKey, socket.id); // ioredis: hdel
          const remaining = await redis.hlen(hashKey); // ioredis: hlen
          if (!remaining) {
            await redis.srem("active-snippets", room); // ioredis: srem
          }
          await broadcastActiveUsers(room);
        } catch (err) {
          console.error("disconnect cleanup error for room", room, err);
        }
      }
    } catch (err) {
      console.error("disconnect handler error:", err);
    }
  });
};
