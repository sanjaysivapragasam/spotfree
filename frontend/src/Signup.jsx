import { useState } from "react";

const USER_SERVICE = "http://localhost:8004";

export default function Signup({ onLogin }) {
  const [name, setName]         = useState("");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  const handleSignup = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`${USER_SERVICE}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 409) {
          setError("This email is already registered.");
        } else {
          setError(data.detail || "Failed to create account.");
        }
        return;
      }

      // Store token and log the user straight in after signup
      localStorage.setItem("token", data.token);
      onLogin(data.user);
    } catch {
      setError("Could not connect to server. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSignup} style={styles.form}>
      <h2 style={styles.title}>Sign Up</h2>

      <input
        type="text"
        placeholder="Full Name"
        style={styles.input}
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />

      <input
        type="email"
        placeholder="Email"
        style={styles.input}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />

      <input
        type="password"
        placeholder="Password"
        style={styles.input}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />

      {error && <p style={styles.error}>{error}</p>}

      <button type="submit" style={styles.button} disabled={loading}>
        {loading ? "Creating account…" : "Create Account"}
      </button>
    </form>
  );
}

const styles = {
  form:   { display: "flex", flexDirection: "column", gap: 12, marginTop: 10 },
  title:  { fontSize: 24, fontWeight: 700, marginBottom: 10 },
  input:  { padding: "10px 12px", borderRadius: 6, border: "1px solid #e5e7eb", fontSize: 14, width: "100%" },
  button: { marginTop: 10, padding: "10px", borderRadius: 6, border: "none", background: "#16a34a", color: "#fff", fontWeight: 600, fontSize: 14, cursor: "pointer", width: "100%" },
  error:  { color: "#dc2626", fontSize: 13 },
};
