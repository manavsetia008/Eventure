import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth.jsx";

export default function Login() {
  const { user, login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || "/";
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "", college: "", goals: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={from} replace />;
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "login") await login(form.email, form.password);
      else await register(form);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login">
      <section className="login-intro">
        <h1>Eventure</h1>
        <p className="tagline">Every event, one thread.</p>
        <ul>
          <li>Find events near you and see how long the trip takes</li>
          <li>Keep every stage and deadline in one timeline</li>
          <li>Get told when two plans clash, and which one to skip</li>
          <li>Read reviews from students who actually went</li>
        </ul>
      </section>
      <form className="card login-card" onSubmit={submit}>
        <h2>{mode === "login" ? "Sign in" : "Create your account"}</h2>
        {mode === "register" && (
          <label>Name<input value={form.name} onChange={set("name")} required /></label>
        )}
        <label>Email<input type="email" value={form.email} onChange={set("email")} required /></label>
        <label>Password<input type="password" value={form.password} onChange={set("password")} minLength={6} required /></label>
        {mode === "register" && (
          <>
            <label>College<input value={form.college} onChange={set("college")} placeholder="IIIT Delhi" /></label>
            <label>Your goals<input value={form.goals} onChange={set("goals")} placeholder="hackathon, ai, internships" /></label>
          </>
        )}
        {error && <p className="error">{error}</p>}
        <button className="btn" disabled={busy}>{busy ? "Please wait..." : mode === "login" ? "Sign in" : "Create account"}</button>
        <button type="button" className="linklike" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}>
          {mode === "login" ? "New here? Create an account" : "Already have an account? Sign in"}
        </button>
        {mode === "login" && (import.meta.env.DEV || import.meta.env.VITE_SHOW_DEMO === "1") && (
          <p className="muted small">Demo: demo@eventure.app / demo1234</p>
        )}
      </form>
    </div>
  );
}
