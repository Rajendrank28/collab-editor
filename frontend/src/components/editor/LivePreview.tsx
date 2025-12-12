// frontend/src/components/editor/LivePreview.tsx
import React, { useEffect, useRef } from "react";

interface LivePreviewProps {
  html: string;
  css: string;
  js: string;
  debounceMs?: number; // optional override (default 500)
}

const LivePreview: React.FC<LivePreviewProps> = ({ html, css, js, debounceMs = 500 }) => {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const updateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const buildDocument = (h: string, c: string, j: string) => {
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<style>
  html,body { height: 100%; margin: 0; padding: 0; box-sizing: border-box; }
  ${c}
</style>
</head>
<body>
${h}
<script>
  (function () {
    try {
      ${j}
    } catch (err) {
      try {
        const el = document.createElement('div');
        el.style.position = 'fixed';
        el.style.left = '0';
        el.style.right = '0';
        el.style.bottom = '0';
        el.style.background = '#ffdddd';
        el.style.color = '#900';
        el.style.padding = '10px';
        el.style.fontFamily = 'monospace';
        el.style.zIndex = '2147483647';
        el.textContent = 'JS Error: ' + (err && err.message ? err.message : String(err));
        document.body.appendChild(el);
      } catch (e) {
        // ignore
      }
      console.error(err);
    }
  })();
<\/script>
</body>
</html>`;
  };

  const writeToIframe = (content: string) => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) return;
    doc.open();
    doc.write(content);
    doc.close();
  };

  useEffect(() => {
    if (updateTimer.current) clearTimeout(updateTimer.current);
    updateTimer.current = setTimeout(() => {
      try {
        const doc = buildDocument(html, css, js);
        writeToIframe(doc);
        try {
          const iframeWindow = iframeRef.current?.contentWindow;
          iframeWindow?.scrollTo?.(0, 0);
        } catch {
          // ignore
        }
      } catch (err) {
        console.error("LivePreview write error:", err);
      } finally {
        updateTimer.current = null;
      }
    }, debounceMs);

    return () => {
      if (updateTimer.current) {
        clearTimeout(updateTimer.current);
        updateTimer.current = null;
      }
    };
  }, [html, css, js, debounceMs]);

  useEffect(() => {
    const initial = buildDocument(html, css, js);
    writeToIframe(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <iframe
      ref={iframeRef}
      title="Live Preview"
      sandbox="allow-scripts allow-same-origin"
      style={{
        width: "100%",
        height: "100%",
        border: "1px solid #111827",
        borderRadius: 8,
        background: "#ffffff",
        display: "block",
        position: "relative",
        zIndex: 0, // ensure the iframe stays beneath header UI
      }}
    />
  );

};

export default LivePreview;
