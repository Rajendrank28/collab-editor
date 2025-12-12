// frontend/src/components/ActiveUsersPanel.tsx
import React from "react";

interface Props {
  users: string[]; // list of usernames
  current?: string; // current username to highlight
  compact?: boolean; // show compact view
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
];

const pickColor = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
  const idx = Math.abs(h) % defaultColors.length;
  return defaultColors[idx];
};

const ActiveUsersPanel: React.FC<Props> = ({ users = [], current, compact = false }) => {
  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <strong style={{ fontSize: "0.95rem" }}>Active</strong>
        <span style={styles.count}>{users.length}</span>
      </div>

      <div style={compact ? styles.compactList : styles.list}>
        {users.length === 0 && <div style={styles.empty}>No collaborators</div>}
        {users.map((u) => {
          const color = pickColor(u);
          const isCurrent = current && u === current;
          return (
            <div key={u} style={{ ...styles.userRow, opacity: isCurrent ? 1 : 0.95 }}>
              <div style={{ ...styles.avatar, background: color }}>
                <span style={styles.avatarText}>{u[0]?.toUpperCase() ?? "U"}</span>
              </div>
              {!compact && (
                <div style={styles.userMeta}>
                  <div style={styles.usernameRow}>
                    <span style={styles.username}>{u}</span>
                    {isCurrent && <span style={styles.youBadge}>you</span>}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const styles: { [k: string]: React.CSSProperties } = {
  container: {
    width: "100%",
    background: "#071129",
    border: "1px solid #122534",
    borderRadius: 8,
    padding: "0.5rem",
    boxSizing: "border-box",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "0.5rem",
  },
  count: {
    fontSize: "0.85rem",
    color: "#94a3b8",
    background: "#011425",
    padding: "0.15rem 0.45rem",
    borderRadius: 999,
    border: "1px solid #0b3746",
  },
  list: {
    display: "flex",
    flexDirection: "column",
    gap: "0.45rem",
  },
  compactList: {
    display: "flex",
    gap: "0.4rem",
    flexWrap: "wrap",
  },
  empty: {
    color: "#94a3b8",
    fontSize: "0.9rem",
  },
  userRow: {
    display: "flex",
    alignItems: "center",
    gap: "0.6rem",
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 8,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#fff",
    fontWeight: 700,
    fontSize: "0.95rem",
  },
  avatarText: {
    fontSize: "0.9rem",
    letterSpacing: 0.5,
  },
  userMeta: {
    display: "flex",
    flexDirection: "column",
  },
  usernameRow: {
    display: "flex",
    gap: "0.5rem",
    alignItems: "center",
  },
  username: {
    color: "#e6eef6",
    fontSize: "0.95rem",
  },
  youBadge: {
    fontSize: "0.7rem",
    color: "#0f172a",
    background: "#60a5fa",
    padding: "0.12rem 0.4rem",
    borderRadius: 6,
  },
};

export default ActiveUsersPanel;
