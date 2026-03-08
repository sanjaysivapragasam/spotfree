import { useState } from "react";
import { auth } from "./firebase";
import { signInWithEmailAndPassword } from "firebase/auth";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  
  const handleLogin = async (e) => {
    e.preventDefault();

    try {
        await signInWithEmailAndPassword(auth, email, password);
        setError("");
    } catch (err) {
        setError("Invalid email or password");
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
      />

      <input
        type="password"
        placeholder="Password"
        style={styles.input}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      {error && <p style={styles.error}>{error}</p>}
      
      <button type="submit" style={styles.button}>
        Login
      </button>
    </form>
  );
}

const styles = {
  form: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    marginTop: 10,
  },

  title: {
    fontSize: 24,
    fontWeight: 700,
    marginBottom: 10,
  },

  input: {
    padding: "10px 12px",
    borderRadius: 6,
    border: "1px solid #e5e7eb",
    fontSize: 14,
    width: "100%",
  },

  button: {
    marginTop: 10,
    padding: "10px",
    borderRadius: 6,
    border: "none",
    background: "#16a34a",
    color: "#fff",
    fontWeight: 600,
    fontSize: 14,
    cursor: "pointer",
    width: "100%",
  },
};