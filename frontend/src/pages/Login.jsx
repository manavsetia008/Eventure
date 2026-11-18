import { useEffect, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Eye, EyeOff, Loader2 } from "lucide-react";
import { useAuth } from "../auth.jsx";
import Logo from "../components/Logo.jsx";

export default function Login({ initialMode }) {
  const { user, login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || "/";

  const isSignupPath = location.pathname.includes("signup") || initialMode === "register";
  const [mode, setMode] = useState(isSignupPath ? "register" : "login");

  useEffect(() => {
    if (location.pathname.includes("signup")) {
      setMode("register");
    } else if (location.pathname.includes("login")) {
      setMode("login");
    }
  }, [location.pathname]);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [demoBusy, setDemoBusy] = useState(false);

  if (user) {
    return <Navigate to="/" replace />;
  }

  const setField = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    if (error) setError("");
  };

  async function handleDemoLogin() {
    setError("");
    setDemoBusy(true);
    try {
      setForm((f) => ({
        ...f,
        email: "demo@eventure.app",
        password: "demo1234",
      }));
      await login("demo@eventure.app", "demo1234");
      navigate(from, { replace: true });
    } catch (err) {
      setError(err?.message || "Failed to sign in with demo account. Please check backend connection.");
    } finally {
      setDemoBusy(false);
    }
  }

  async function submit(e) {
    e.preventDefault();
    setError("");

    if (mode === "register") {
      if (!form.name.trim()) {
        setError("Please enter your full name.");
        return;
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(form.email.trim())) {
        setError("Please enter a valid email address.");
        return;
      }
      if (form.password.length < 6) {
        setError("Password must be at least 6 characters.");
        return;
      }
      if (form.password !== form.confirmPassword) {
        setError("Passwords do not match.");
        return;
      }
    }

    setBusy(true);
    try {
      if (mode === "login") {
        await login(form.email.trim(), form.password);
      } else {
        await register({
          name: form.name.trim(),
          email: form.email.trim().toLowerCase(),
          password: form.password,
          confirm_password: form.confirmPassword,
        });
      }
      navigate(from, { replace: true });
    } catch (err) {
      setError(err?.message || "Authentication failed. Please check your credentials.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        {/* Top header with home link and logo */}
        <div className="login-card-head">
          <Link to="/" className="login-back-link" aria-label="Back to home">
            <ArrowLeft size={16} />
            <span>Home</span>
          </Link>
          <Logo size={24} />
        </div>

        <div className="login-header">
          <h2>{mode === "login" ? "Welcome back" : "Create account"}</h2>
          <p className="login-subtext">
            {mode === "login"
              ? "Sign in to access your campus timeline and event threads"
              : "Enter your campus details to begin tracking events cleanly"}
          </p>
        </div>

        {error && (
          <div className="login-error-banner" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={submit} className="login-form">
          {mode === "register" && (
            <label className="login-label">
              <span>Full name</span>
              <input
                type="text"
                value={form.name}
                onChange={setField("name")}
                placeholder="Your full name"
                required
                className="login-input"
                autoComplete="name"
              />
            </label>
          )}

          <label className="login-label">
            <span>Email address</span>
            <input
              type="email"
              value={form.email}
              onChange={setField("email")}
              placeholder="you@college.edu"
              required
              className="login-input"
              autoComplete="email"
            />
          </label>

          <label className="login-label">
            <span>Password</span>
            <div className="password-input-wrap">
              <input
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={setField("password")}
                placeholder="At least 6 characters"
                minLength={6}
                required
                className="login-input"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowPassword((p) => !p)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </label>

          {mode === "register" && (
            <label className="login-label">
              <span>Confirm Password</span>
              <div className="password-input-wrap">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={form.confirmPassword}
                  onChange={setField("confirmPassword")}
                  placeholder="Re-enter password"
                  minLength={6}
                  required
                  className="login-input"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowConfirmPassword((p) => !p)}
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                >
                  {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </label>
          )}

          <button
            type="submit"
            className="btn login-submit-btn"
            disabled={busy || demoBusy}
          >
            {busy ? (
              <>
                <Loader2 size={16} className="btn-spinner" />
                <span>{mode === "login" ? "Signing in..." : "Creating account..."}</span>
              </>
            ) : (
              mode === "login" ? "Sign in" : "Create account"
            )}
          </button>
        </form>

        {mode === "login" && (
          <div className="login-demo-action">
            <button
              type="button"
              className="btn ghost login-demo-btn"
              onClick={handleDemoLogin}
              disabled={busy || demoBusy}
            >
              {demoBusy ? (
                <>
                  <Loader2 size={16} className="btn-spinner" />
                  <span>Signing in with demo...</span>
                </>
              ) : (
                "Use demo account"
              )}
            </button>
          </div>
        )}

        <div className="login-toggle-row">
          {mode === "login" ? (
            <p className="login-switch-text">
              Don't have an account?{" "}
              <Link
                to="/signup"
                className="login-switch-link"
                onClick={(e) => {
                  e.preventDefault();
                  setMode("register");
                  setError("");
                }}
              >
                Sign up
              </Link>
            </p>
          ) : (
            <p className="login-switch-text">
              Already have an account?{" "}
              <Link
                to="/login"
                className="login-switch-link"
                onClick={(e) => {
                  e.preventDefault();
                  setMode("login");
                  setError("");
                }}
              >
                Sign in
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
