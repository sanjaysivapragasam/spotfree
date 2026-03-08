import { useState } from "react";
import { auth } from "./firebase";
import { createUserWithEmailAndPassword } from "firebase/auth";

export default function Signup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSignup = async (e) => {
    e.preventDefault();

    try {
        await createUserWithEmailAndPassword(auth, email, password);
        setError("");
    } catch (err) {
        if (err.code === "auth/email-already-in-use") {
        setError("This email is already registered.");
        } 
        else if (err.code === "auth/weak-password") {
        setError("Password must be at least 6 characters.");
        } 
        else {
        setError("Failed to create account.");
        }
    }
  };

  return (
    <form onSubmit={handleSignup} style={styles.form}>
      <h2 style={styles.title}>Sign Up</h2>

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
        Create Account
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