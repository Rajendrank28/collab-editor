// frontend/src/hooks/useSocket.ts
import { useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";

type CodeState = { html: string; css: string; js: string };
type CursorPos = { lineNumber: number; column: number };

interface UseSocketReturn {
  socket: Socket | null;
  joinSnippet: (snippetId: string, username?: string) => void;
  leaveSnippet: (snippetId: string) => void;
  emitCodeChange: (snippetId: string, state: CodeState) => void;
  emitCursorMove: (snippetId: string, params: { username?: string; cursor: CursorPos | null; color?: string | null }) => void;
  requestLatest: (snippetId: string) => void;
  getSocketId: () => string | null;
}

const SOCKET_URL = "http://localhost:5000";

export const useSocket = (): UseSocketReturn => {
  const socketRef = useRef<Socket | null>(null);
  const joinedRoomsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    // read token from localStorage if present
    const token = localStorage.getItem("token") || null;
    const s = io(SOCKET_URL, {
      autoConnect: true,
      transports: ["websocket"],
      auth: {
        token,
      },
    });
    socketRef.current = s;

    s.on("connect", () => {
      console.log("socket connected (client):", s.id);
    });

    s.on("connect_error", (err) => {
      console.error("Socket connect_error:", err.message);
    });

    s.on("disconnect", (reason) => {
      console.log("socket disconnected (client):", reason);
    });

    const handleBeforeUnload = () => {
      const socket = socketRef.current;
      if (!socket) return;
      joinedRoomsRef.current.forEach((snippetId) => {
        try {
          socket.emit("leave-snippet", { snippetId });
        } catch {
          // noop
        }
      });
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      if (socketRef.current) {
        joinedRoomsRef.current.forEach((snippetId) => {
          try {
            socketRef.current?.emit("leave-snippet", { snippetId });
          } catch {
            // ignore
          }
        });
        socketRef.current.disconnect();
        socketRef.current = null;
        joinedRoomsRef.current.clear();
      }
    };
  }, []);

  const joinSnippet = (snippetId: string, username?: string) => {
    const socket = socketRef.current;
    if (!socket) return;
    socket.emit("join-snippet", { snippetId, username });
    joinedRoomsRef.current.add(snippetId);
  };

  const leaveSnippet = (snippetId: string) => {
    const socket = socketRef.current;
    if (!socket) return;
    socket.emit("leave-snippet", { snippetId });
    joinedRoomsRef.current.delete(snippetId);
  };

  const emitCodeChange = (snippetId: string, state: CodeState) => {
    socketRef.current?.emit("code-change", { snippetId, ...state });
  };

  const emitCursorMove = (snippetId: string, params: { username?: string; cursor: CursorPos | null; color?: string | null }) => {
    socketRef.current?.emit("cursor-move", { snippetId, username: params.username, cursor: params.cursor, color: params.color ?? null });
  };

  const requestLatest = (snippetId: string) => {
    socketRef.current?.emit("request-latest", { snippetId });
  };

  const getSocketId = () => socketRef.current?.id ?? null;

  return {
    socket: socketRef.current,
    joinSnippet,
    leaveSnippet,
    emitCodeChange,
    emitCursorMove,
    requestLatest,
    getSocketId,
  };
};

export default useSocket;
