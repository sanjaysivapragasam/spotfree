import { useState } from "react";

const USER_SERVICE = "http://localhost:8004";

export default function Login({ onLogin }) {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`${USER_SERVICE}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.detail || "Invalid email or password");
        return;
      }

      // Store token so other parts of the app can use it for future requests
      localStorage.setItem("token", data.token);
      onLogin(data.user);
    } catch {
      setError("Could not connect to server. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleLogin} style={styles.form}>
      <h2 style={styles.title}>Login</h2>

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
        {loading ? "Logging in…" : "Login"}
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
