import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authApi } from "../api/authApi";

const RegisterPage: React.FC = () => {
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      await authApi.register({ username, email, password });
      setSuccess("Account created! You can now log in.");
      navigate("/login");
    } catch (err: any) {
      console.error(err);
      setError(
        err?.response?.data?.message ||
          "Registration failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Register</h1>
        {error && <p style={styles.error}>{error}</p>}
        {success && <p style={styles.success}>{success}</p>}
        <form style={styles.form} onSubmit={handleSubmit}>
          <label style={styles.label}>
            Username
            <input
              type="text"
              style={styles.input}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </label>
          <label style={styles.label}>
            Email
            <input
              type="email"
              style={styles.input}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label style={styles.label}>
            Password
            <input
              type="password"
              style={styles.input}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          <button style={styles.button} type="submit" disabled={loading}>
            {loading ? "Creating..." : "Create Account"}
          </button>
        </form>
        <p style={styles.text}>
          Already have an account? <Link to="/login">Login</Link>
        </p>
      </div>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    minHeight: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    background: "#0f172a",
    color: "#e5e7eb",
  },
  card: {
    width: "100%",
    maxWidth: "400px",
    background: "#020617",
    padding: "2rem",
    borderRadius: "0.75rem",
    boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
    border: "1px solid #1e293b",
  },
  title: {
    marginBottom: "1.5rem",
    fontSize: "1.75rem",
    textAlign: "center",
  },
  error: {
    marginBottom: "1rem",
    padding: "0.6rem 0.8rem",
    borderRadius: "0.5rem",
    background: "#7f1d1d",
    color: "#fee2e2",
    fontSize: "0.9rem",
  },
  success: {
    marginBottom: "1rem",
    padding: "0.6rem 0.8rem",
    borderRadius: "0.5rem",
    background: "#14532d",
    color: "#bbf7d0",
    fontSize: "0.9rem",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
  },
  label: {
    display: "flex",
    flexDirection: "column",
    fontSize: "0.9rem",
    gap: "0.35rem",
  },
  input: {
    padding: "0.55rem 0.75rem",
    borderRadius: "0.5rem",
    border: "1px solid #334155",
    background: "#020617",
    color: "#e5e7eb",
  },
  button: {
    marginTop: "0.5rem",
    padding: "0.6rem",
    borderRadius: "0.5rem",
    border: "none",
    background: "#22c55e",
    color: "#f9fafb",
    fontWeight: 600,
    cursor: "pointer",
  },
  text: {
    marginTop: "1rem",
    textAlign: "center",
    fontSize: "0.85rem",
  },
};

export default RegisterPage;
