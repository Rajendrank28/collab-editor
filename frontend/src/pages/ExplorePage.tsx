// frontend/src/pages/ExplorePage.tsx
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { snippetApi } from "../api/snippetApi";
import type { Snippet } from "../api/snippetApi";

const ExplorePage: React.FC = () => {
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchSnippets = async () => {
      try {
        setLoading(true);
        setError("");
        const data = await snippetApi.listPublic(1);
        setSnippets(Array.isArray(data) ? data : []);
      } catch (err: any) {
        console.error(err);
        setError(
          err?.response?.data?.message || "Failed to load snippets. Try again."
        );
      } finally {
        setLoading(false);
      }
    };

    fetchSnippets();
  }, []);

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1>Explore Snippets</h1>
        <Link to="/editor/new" style={styles.newButton}>
          + New Snippet
        </Link>
      </header>

      {loading && <p>Loading snippets...</p>}
      {error && <p style={styles.error}>{error}</p>}
      {!loading && !error && snippets.length === 0 && (
        <p>No public snippets yet. Create one!</p>
      )}

      <div style={styles.grid}>
        {snippets.map((snippet) => {
          const id = snippet && snippet._id ? String(snippet._id) : null;
          return (
            <div key={id ?? Math.random()} style={styles.cardWrapper}>
              {id ? (
                <Link to={`/editor/${id}`} style={styles.card}>
                  <h2 style={styles.cardTitle}>{snippet.title || "Untitled"}</h2>
                  <p style={styles.cardSubtitle}>
                    Views: {snippet.views ?? 0} · Updated:{" "}
                    {snippet.updatedAt
                      ? new Date(snippet.updatedAt).toLocaleString()
                      : "—"}
                  </p>
                </Link>
              ) : (
                <div style={styles.card}>
                  <h2 style={styles.cardTitle}>{snippet.title || "Untitled"}</h2>
                  <p style={styles.cardSubtitle}>Invalid id</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    minHeight: "100vh",
    padding: "1.5rem 2rem",
    background: "#020617",
    color: "#e5e7eb",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "1.5rem",
  },
  newButton: {
    padding: "0.5rem 0.9rem",
    borderRadius: "999px",
    border: "1px solid #22c55e",
    background: "transparent",
    color: "#22c55e",
    fontSize: "0.9rem",
    cursor: "pointer",
    textDecoration: "none",
  },
  error: {
    color: "#fecaca",
    marginBottom: "1rem",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
    gap: "1rem",
  },
  cardWrapper: {
    position: "relative",
  },
  card: {
    display: "block",
    background: "#020617",
    borderRadius: "0.75rem",
    border: "1px solid #1f2937",
    padding: "1rem",
    textDecoration: "none",
    color: "#e5e7eb",
  },
  cardTitle: {
    marginBottom: "0.3rem",
    fontSize: "1.1rem",
  },
  cardSubtitle: {
    fontSize: "0.85rem",
    color: "#9ca3af",
  },
};

export default ExplorePage;
