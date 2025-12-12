// frontend/src/components/editor/CodeEditor.tsx
import React, { useEffect, useRef, useState } from "react";
import Editor, { useMonaco } from "@monaco-editor/react";

type LanguageTab = "html" | "css" | "js";

export interface CodeEditorProps {
  html: string;
  css: string;
  js: string;
  onChange: (value: { html: string; css: string; js: string }) => void;
  onCursorChange?: (cursor: { lineNumber: number; column: number } | null) => void;
  externalCursors?: {
    id: string; // socketId or username
    username: string;
    color?: string;
    cursor: { lineNumber: number; column: number } | null;
  }[];
}

const defaultColors = [
  "#ef4444",
  "#f97316",
  "#f59e0b",
  "#10b981",
  "#06b6d4",
  "#3b82f6",
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
];

const pickColor = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
  return defaultColors[Math.abs(h) % defaultColors.length];
};

const sanitizeClass = (s: string) => s.replace(/[^a-z0-9\-_]/gi, "_");

// returns '#000' or '#fff' for contrast against background hex color
const contrastColor = (hex: string) => {
  // remove hash
  const h = hex.replace("#", "");
  // parse r,g,b
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  // luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#000000" : "#ffffff";
};

const CodeEditor: React.FC<CodeEditorProps> = ({ html, css, js, onChange, onCursorChange, externalCursors }) => {
  const [activeTab, setActiveTab] = useState<LanguageTab>("html");
  const monaco = useMonaco();
  const editorRef = useRef<any>(null);
  const decorationIdsRef = useRef<Record<string, string[]>>({});
  const [labelPositions, setLabelPositions] = useState<
    { id: string; username: string; color: string; top: number; left: number }[]
  >([]);

  // mount handler
  const handleMount = (editor: any, _monacoApi: any) => {
    editorRef.current = editor;

    editor.onDidChangeCursorSelection(() => {
      const pos = editor.getPosition();
      const cursor = pos ? { lineNumber: pos.lineNumber, column: pos.column } : null;
      if (onCursorChange) onCursorChange(cursor);
    });

    // Recompute positions on scroll/layout change
    editor.onDidScrollChange(() => {
      recomputeLabelPositions();
    });
    editor.onDidLayoutChange(() => {
      recomputeLabelPositions();
    });
    // recompute on model change (e.g., switching tabs affects model)
    editor.onDidChangeModelContent(() => {
      recomputeLabelPositions();
    });
  };

  const handleEditorChange = (value: string | undefined) => {
    const safeValue = value ?? "";
    if (activeTab === "html") onChange({ html: safeValue, css, js });
    else if (activeTab === "css") onChange({ html, css: safeValue, js });
    else onChange({ html, css, js: safeValue });
    // after content changes, labels may move; schedule recompute
    requestAnimationFrame(() => recomputeLabelPositions());
  };

  // Apply decorations for cursor markers and inject minimal CSS for marker styling
  useEffect(() => {
    if (!monaco || !editorRef.current) return;
    const editor = editorRef.current;
    const model = editor.getModel();
    if (!model) return;

    const decorations: { range: any; options: any }[] = [];
    const cssRules: string[] = [];

    (externalCursors ?? []).forEach((c) => {
      if (!c.cursor) return;
      const { lineNumber, column } = c.cursor;
      const id = c.id || c.username;
      const safeId = sanitizeClass(String(id));
      const className = `collab-cursor-${safeId}`;
      const color = c.color || pickColor(c.username);
      const col = Math.max(1, column ?? 1);

      const range = new (monaco as any).Range(lineNumber, col, lineNumber, col);

      const options: any = {
        inlineClassName: className,
        hoverMessage: [{ value: c.username }],
      };

      decorations.push({ range, options });

      // CSS: subtle background + left border for marker, and label styling via overlay (we also keep label CSS for safety)
      cssRules.push(
        `.${className} { background-color: ${color}22; border-left: 2px solid ${color}; }`
      );
    });

    const currentDecIds = Object.values(decorationIdsRef.current).flat();
    try {
      const newIds = editor.deltaDecorations(currentDecIds, decorations.map((d) => ({ range: d.range, options: d.options })));
      // map ids back one-to-one
      let idx = 0;
      const finalMap: Record<string, string[]> = {};
      (externalCursors ?? []).forEach((c) => {
        const id = c.id || c.username;
        if (!c.cursor) {
          finalMap[id] = [];
          return;
        }
        const decId = newIds[idx++];
        finalMap[id] = decId ? [decId] : [];
      });
      decorationIdsRef.current = finalMap;
    } catch (err) {
      decorationIdsRef.current = {};
    }

    // inject CSS for markers
    try {
      const head = document.head;
      let styleEl = document.getElementById("collab-editor-cursors") as HTMLStyleElement | null;
      const combined = cssRules.join("\n");
      if (!styleEl) {
        styleEl = document.createElement("style");
        styleEl.id = "collab-editor-cursors";
        styleEl.innerHTML = combined;
        head.appendChild(styleEl);
      } else {
        styleEl.innerHTML = combined;
      }
    } catch {
      // ignore
    }

    // recompute label overlay positions immediately
    requestAnimationFrame(() => recomputeLabelPositions());

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalCursors, monaco]);

  // Compute overlay positions for labels (floating DOM overlays)
  const recomputeLabelPositions = () => {
    const editor = editorRef.current;
    const mon = monaco;
    if (!editor || !mon) {
      setLabelPositions([]);
      return;
    }
    const domNode = editor.getDomNode();
    if (!domNode) {
      setLabelPositions([]);
      return;
    }
    const rect = domNode.getBoundingClientRect();
    const newPositions: { id: string; username: string; color: string; top: number; left: number }[] = [];

    (externalCursors ?? []).forEach((c) => {
      if (!c.cursor) return;
      const { lineNumber, column } = c.cursor;
      try {
        // getScrolledVisiblePosition gives coordinates relative to the editor's viewport
        const pos = editor.getScrolledVisiblePosition({ lineNumber, column });
        if (!pos) return;
        // editor content area top-left
        const contentDom = domNode.querySelector(".view-lines") as HTMLElement | null;
        // compute left position as pos.left; fallback to 0
        const left = pos.left + (contentDom ? contentDom.getBoundingClientRect().left - rect.left : 0);
        const top = pos.top + (contentDom ? contentDom.getBoundingClientRect().top - rect.top : 0);
        const color = c.color || pickColor(c.username);
        newPositions.push({
          id: c.id,
          username: c.username,
          color,
          top,
          left,
        });
      } catch {
        // ignore per-cursor errors
      }
    });

    // For smooth animation we set the state once with new positions
    setLabelPositions(newPositions);
  };

  // Recompute positions on window resize (and on first mount)
  useEffect(() => {
    const onResize = () => recomputeLabelPositions();
    window.addEventListener("resize", onResize);
    // initial compute
    requestAnimationFrame(() => recomputeLabelPositions());
    return () => {
      window.removeEventListener("resize", onResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Helper: current code & language
  const getCurrentCode = () => (activeTab === "html" ? html : activeTab === "css" ? css : js);
  const getLanguage = () => (activeTab === "html" ? "html" : activeTab === "css" ? "css" : "javascript");

  return (
    <div style={styles.container}>
      <div style={styles.tabs}>
        <button style={{ ...styles.tabButton, ...(activeTab === "html" ? styles.activeTab : {}) }} onClick={() => setActiveTab("html")}>
          HTML
        </button>
        <button style={{ ...styles.tabButton, ...(activeTab === "css" ? styles.activeTab : {}) }} onClick={() => setActiveTab("css")}>
          CSS
        </button>
        <button style={{ ...styles.tabButton, ...(activeTab === "js" ? styles.activeTab : {}) }} onClick={() => setActiveTab("js")}>
          JS
        </button>
      </div>

      <div style={styles.editorWrapper}>
        <div style={{ position: "relative", height: "100%" }}>
          <Editor
            height="100%"
            defaultLanguage={getLanguage()}
            language={getLanguage()}
            theme="vs-dark"
            value={getCurrentCode()}
            onChange={handleEditorChange}
            onMount={handleMount}
            options={{
              fontSize: 14,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              automaticLayout: true,
              glyphMargin: true,
              lineNumbers: "on",
            }}
          />

          {/* Overlay for floating labels */}
          <div
            style={{
              pointerEvents: "none", // let mouse events pass through to editor
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
            }}
          >
            {labelPositions.map((p) => {
              const bg = p.color;
              const fg = contrastColor(bg);
              const title = p.username;
              // small offset so label doesn't overlap the caret
              const style: React.CSSProperties = {
                position: "absolute",
                transform: "translate(-6px, -1.6em)",
                top: p.top,
                left: p.left,
                transition: "transform 120ms ease-out, top 120ms ease-out, left 120ms ease-out, opacity 120ms ease-out",
                background: bg,
                color: fg,
                padding: "4px 8px",
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial',
                whiteSpace: "nowrap",
                maxWidth: 180,
                overflow: "hidden",
                textOverflow: "ellipsis",
                boxShadow: "0 2px 8px rgba(0,0,0,0.35)",
                pointerEvents: "auto", // allow hover for tooltip if needed
                opacity: 0.95,
              };
              return (
                <div key={p.id} title={title} style={style}>
                  {p.username}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

const styles: { [k: string]: React.CSSProperties } = {
  container: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    borderRadius: "0.75rem",
    overflow: "hidden",
    border: "1px solid #1f2937",
    background: "#020617",
  },
  tabs: {
    display: "flex",
    gap: "0.25rem",
    padding: "0.4rem 0.5rem",
    background: "#020617",
    borderBottom: "1px solid #1f2937",
  },
  tabButton: {
    padding: "0.3rem 0.7rem",
    borderRadius: "999px",
    border: "none",
    background: "transparent",
    color: "#9ca3af",
    fontSize: "0.85rem",
    cursor: "pointer",
  },
  activeTab: {
    background: "#111827",
    color: "#e5e7eb",
    border: "1px solid #374151",
  },
  editorWrapper: {
    flex: 1,
    position: "relative",
  },
};

export default CodeEditor;
