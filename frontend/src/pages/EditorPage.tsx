// frontend/src/pages/EditorPage.tsx
import React, { useEffect, useRef, useState, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import CodeEditor from "../components/editor/CodeEditor";
import LivePreview from "../components/editor/LivePreview";
import ActiveUsersPanel from "../components/ActiveUsersPanel";
import ConnectionStatus from "../components/common/ConnectionStatus";
import { snippetApi } from "../api/snippetApi";
import type { Snippet } from "../api/snippetApi";
import useSocket from "../hooks/useSocket";

type RemoteCursor = {
  id: string;
  username: string;
  color: string;
  cursor: { lineNumber: number; column: number } | null;
};

const isLikelyObjectId = (s?: string | null) => {
  if (!s) return false;
  return /^[0-9a-fA-F]{24}$/.test(s);
};

const EditorPage: React.FC = () => {
  const { snippetId } = useParams<{ snippetId: string }>();
  const prevSnippetRef = useRef<string | null>(null);
  const navigate = useNavigate();
  const { joinSnippet, leaveSnippet, emitCodeChange, emitCursorMove, requestLatest, socket } = useSocket();

  const [title, setTitle] = useState("Untitled Snippet");
  const [html, setHtml] = useState("<h1>Hello World</h1>");
  const [css, setCss] = useState("body { font-family: sans-serif; }");
  const [js, setJs] = useState("console.log('Hello from JS');");

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const [remoteCursors, setRemoteCursors] = useState<Record<string, RemoteCursor>>({});
  const [activeUsers, setActiveUsers] = useState<string[]>([]);

  const isNew = snippetId === "new";

  const lastEmittedRef = useRef<{ html: string; css: string; js: string } | null>(null);
  const emitDebouncedRef = useRef<number | null>(null);
  const username = JSON.parse(localStorage.getItem("user") || "null")?.username ?? "anonymous";
  const color = JSON.parse(localStorage.getItem("user") || "null")?.color ?? undefined;

  // show/hide preview
  const [showPreview, setShowPreview] = useState(true);

  // join/leave snippet logic
  useEffect(() => {
    const prev = prevSnippetRef.current;
    if (prev && prev !== snippetId) {
      try {
        leaveSnippet(prev);
      } catch {
        // ignore
      }
      prevSnippetRef.current = null;
    }

    if (!snippetId || isNew) {
      prevSnippetRef.current = snippetId ?? null;
      return;
    }
    if (!isLikelyObjectId(snippetId)) {
      setError("Invalid snippet id");
      return;
    }

    joinSnippet(snippetId, username);
    prevSnippetRef.current = snippetId;
    requestLatest(snippetId);

    const onCodeUpdated = (state: { html: string; css: string; js: string }) => {
      if (
        lastEmittedRef.current &&
        lastEmittedRef.current.html === state.html &&
        lastEmittedRef.current.css === state.css &&
        lastEmittedRef.current.js === state.js
      )
        return;
      setHtml(state.html ?? "");
      setCss(state.css ?? "");
      setJs(state.js ?? "");
    };

    const onCursorUpdated = (payload: {
      username: string;
      color?: string | null;
      cursor: { lineNumber: number; column: number } | null;
      socketId?: string;
    }) => {
      const idKey = payload.socketId ?? payload.username;
      setRemoteCursors((prev) => ({
        ...prev,
        [idKey]: {
          id: idKey,
          username: payload.username,
          color: payload.color ?? "#3b82f6",
          cursor: payload.cursor ?? null,
        },
      }));
    };

    const onUserLeft = (p: { username: string; socketId?: string }) => {
      const idKey = p.socketId ?? p.username;
      setRemoteCursors((prev) => {
        const copy = { ...prev };
        delete copy[idKey];
        return copy;
      });
    };

    const onActiveUsers = (users: string[]) => {
      setActiveUsers(Array.isArray(users) ? users : []);
    };

    socket?.on("code-updated", onCodeUpdated);
    socket?.on("cursor-updated", onCursorUpdated);
    socket?.on("user-left", onUserLeft);
    socket?.on("active-users", onActiveUsers);

    return () => {
      socket?.off("code-updated", onCodeUpdated);
      socket?.off("cursor-updated", onCursorUpdated);
      socket?.off("user-left", onUserLeft);
      socket?.off("active-users", onActiveUsers);
      try {
        if (snippetId && !isNew) leaveSnippet(snippetId);
      } catch {
        // ignore
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snippetId, socket]);

  // load snippet
  useEffect(() => {
    const fetchSnippet = async () => {
      if (!snippetId || isNew) return;
      if (!isLikelyObjectId(snippetId)) {
        setError("Invalid snippet id");
        return;
      }
      try {
        setLoading(true);
        setError("");
        const snippet: Snippet = await snippetApi.getById(snippetId);
        setTitle(snippet.title || "Untitled Snippet");
        setHtml(snippet.html || "");
        setCss(snippet.css || "");
        setJs(snippet.js || "");
      } catch (err: any) {
        console.error(err);
        setError(err?.response?.data?.message || "Failed to load snippet");
      } finally {
        setLoading(false);
      }
    };
    fetchSnippet();
  }, [snippetId, isNew]);

  // emit code-change (debounced)
  const emitChange = (state: { html: string; css: string; js: string }) => {
    lastEmittedRef.current = { ...state };
    if (emitDebouncedRef.current) window.clearTimeout(emitDebouncedRef.current);
    emitDebouncedRef.current = window.setTimeout(() => {
      if (snippetId && !isNew) emitCodeChange(snippetId, state);
      emitDebouncedRef.current = null;
    }, 200);
  };

  const handleCodeChange = (value: { html: string; css: string; js: string }) => {
    setHtml(value.html);
    setCss(value.css);
    setJs(value.js);
    emitChange(value);
  };

  // cursor change from editor -> emit to socket (debounced)
  const cursorDebounceRef = useRef<number | null>(null);
  const handleCursorChange = (cursor: { lineNumber: number; column: number } | null) => {
    if (cursorDebounceRef.current) window.clearTimeout(cursorDebounceRef.current);
    cursorDebounceRef.current = window.setTimeout(() => {
      if (!snippetId || isNew || !isLikelyObjectId(snippetId)) return;
      emitCursorMove(snippetId, { username, cursor, color });
      cursorDebounceRef.current = null;
    }, 100);
  };

  // Save / Fork / Delete
  const handleSave = useCallback(async () => {
    try {
      setSaving(true);
      setError("");
      if (!snippetId || isNew) {
        const created = await snippetApi.create({
          title,
          html,
          css,
          js,
          isPublic: true,
        });
        navigate(`/editor/${created._id}`, { replace: true });
      } else {
        await snippetApi.update(snippetId, { title, html, css, js, isPublic: true });
      }
    } catch (err: any) {
      console.error(err);
      setError(err?.response?.data?.message || "Save failed. Try again.");
    } finally {
      setSaving(false);
    }
  }, [snippetId, isNew, title, html, css, js, navigate]);

  const handleFork = async () => {
    if (!snippetId || isNew) return;
    try {
      setSaving(true);
      setError("");
      const forked = await snippetApi.fork(snippetId);
      navigate(`/editor/${forked._id}`);
    } catch (err: any) {
      console.error(err);
      setError(err?.response?.data?.message || "Fork failed. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!snippetId || isNew) return;
    const ok = window.confirm("Are you sure you want to delete this snippet? This action is irreversible.");
    if (!ok) return;
    try {
      setDeleting(true);
      setError("");
      await snippetApi.delete(snippetId);
      navigate("/explore");
    } catch (err: any) {
      console.error(err);
      setError(err?.response?.data?.message || "Delete failed.");
    } finally {
      setDeleting(false);
    }
  };

  // Global keyboard shortcuts:
  // - Ctrl/Cmd+S => Save
  // - Ctrl/Cmd+P => Toggle Preview
  // - Ctrl/Cmd+Backspace => Delete
  // - Ctrl/Cmd+Shift+1/2/3 => Switch tabs (reliable)
  // - Ctrl/Cmd+1/2/3 => Best-effort switch (may be hijacked by browser)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const meta = e.ctrlKey || e.metaKey;

      // Ctrl/Cmd + S => Save
      if (meta && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void handleSave();
        return;
      }

      // Ctrl/Cmd + P => Toggle Preview
      if (meta && e.key.toLowerCase() === "p") {
        e.preventDefault();
        setShowPreview((v) => !v);
        return;
      }

      // Ctrl/Cmd + Backspace => Delete snippet
      if (meta && e.key === "Backspace") {
        if (!isNew && snippetId) {
          e.preventDefault();
          const ok = window.confirm("Delete this snippet? This cannot be undone.");
          if (ok) {
            void handleDelete();
          }
        }
        return;
      }

      // Ctrl/Cmd + Shift + 1/2/3 => Switch tabs (reliable)
      if (meta && e.shiftKey && ["1", "2", "3"].includes(e.key)) {
        e.preventDefault();
        const mapping: Record<string, "html" | "css" | "js"> = { "1": "html", "2": "css", "3": "js" };
        const tab = mapping[e.key];
        window.dispatchEvent(new CustomEvent("switch-editor-tab", { detail: tab }));
        return;
      }

      // Best-effort: Ctrl/Cmd + 1/2/3 (may be taken by browser)
      if (meta && !e.shiftKey && ["1", "2", "3"].includes(e.key)) {
        try {
          e.preventDefault();
        } catch {
          // ignore
        }
        const mapping: Record<string, "html" | "css" | "js"> = { "1": "html", "2": "css", "3": "js" };
        const tab = mapping[e.key];
        window.dispatchEvent(new CustomEvent("switch-editor-tab", { detail: tab }));
        return;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleSave, handleDelete, isNew, snippetId]);

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div>
          <input style={styles.titleInput} value={title} onChange={(e) => setTitle(e.target.value)} />
          <p style={styles.subtitle}>{isNew ? "New snippet" : `Snippet ID: ${snippetId}`}</p>
        </div>
        <div style={styles.headerRight}>
          <ConnectionStatus socket={socket ?? null} />
          <button style={styles.button} onClick={() => void handleSave()} disabled={saving || loading}>
            {saving ? "Saving..." : "Save"}
          </button>
          {!isNew && (
            <button
              style={{ ...styles.button, background: "#0f172a", borderColor: "#22c55e" }}
              onClick={() => void handleFork()}
              disabled={saving || loading}
            >
              Fork
            </button>
          )}
          {!isNew && (
            <button
              style={{ ...styles.button, background: "#ef4444", borderColor: "#ef4444" }}
              onClick={() => void handleDelete()}
              disabled={deleting}
            >
              {deleting ? "Deleting..." : "Delete"}
            </button>
          )}
          <Link to="/explore" style={styles.backLink}>
            ← Back to Explore
          </Link>
        </div>
      </header>

      {error && <p style={styles.error}>{error}</p>}
      {loading && <p>Loading snippet...</p>}

      {!loading && (
        <div style={styles.main}>
          <div style={styles.leftPane}>
            <CodeEditor
              html={html}
              css={css}
              js={js}
              onChange={handleCodeChange}
              onCursorChange={handleCursorChange}
              externalCursors={Object.values(remoteCursors)}
            />
          </div>

          <div style={styles.rightPane}>
            <div style={styles.usersPanelWrapper}>
              <ActiveUsersPanel users={activeUsers} current={username} compact={false} />
            </div>
            <div style={styles.previewWrapper}>
              {showPreview ? (
                <LivePreview html={html} css={css} js={js} />
              ) : (
                <div style={{ color: "#9ca3af", padding: 12 }}>Preview hidden — press Ctrl+P to show</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const styles: { [k: string]: React.CSSProperties } = {
  page: { minHeight: "100vh", background: "#020617", color: "#e5e7eb", padding: "0.75rem 1rem", boxSizing: "border-box" },

  // header sits above the page but remains part of the document flow
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "0.75rem",
    position: "relative",
    zIndex: 30,
    pointerEvents: "auto",
  },

  titleInput: { fontSize: "1.3rem", background: "transparent", border: "none", borderBottom: "1px solid #1f2937", color: "#e5e7eb", padding: "0.2rem 0", outline: "none", minWidth: "200px" },
  subtitle: { fontSize: "0.85rem", color: "#9ca3af" },

  // headerRight should render above preview overlays
  headerRight: { display: "flex", gap: "0.5rem", alignItems: "center", zIndex: 40 },

  button: { padding: "0.4rem 0.8rem", borderRadius: "999px", border: "1px solid #3b82f6", background: "#1d4ed8", color: "#f9fafb", fontSize: "0.85rem", cursor: "pointer" },
  backLink: { fontSize: "0.85rem", textDecoration: "none", color: "#60a5fa" },
  error: { color: "#fecaca", fontSize: "0.9rem", marginBottom: "0.5rem" },

  main: { display: "flex", gap: "0.75rem", height: "500px" },

  leftPane: { flex: 1 },

  // rightPane sits below header (lower zIndex) so header never overlaps content visually
  rightPane: { width: 420, display: "flex", flexDirection: "column", gap: "0.75rem", position: "relative", zIndex: 10 },

  usersPanelWrapper: { width: "100%" },

  // preview wrapper lower zIndex than header; iframe will be explicitly zIndex: 0
  previewWrapper: { flex: 1, minHeight: 300, position: "relative", zIndex: 5 },
};

export default EditorPage;
