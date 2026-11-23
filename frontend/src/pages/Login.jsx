import { useEffect, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Eye, EyeOff, Loader2 } from "lucide-react";
import { api } from "../api";
import { useAuth } from "../auth.jsx";
import Logo from "../components/Logo.jsx";
import Notice from "../components/Notice.jsx";
import DoodleCrewFooter from "../components/ui/doodle-crew-footer";

// Official multicolour Google mark.
function GoogleMark({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" className="google-mark">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

const GOOGLE_CANCELLED_NOTICE = "Google sign-in was cancelled. Try again.";

export default function Login({ initialMode }) {
  const { user, login, register, signInWithToken } = useAuth();
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
  const [googleReady, setGoogleReady] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [notice, setNotice] = useState("");

  // Show the Google button only when the server has an OAuth client configured.
  useEffect(() => {
    let alive = true;
    api
      .get("/health")
      .then((r) => {
        if (alive) setGoogleReady(Boolean(r?.googleAuth));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  // The callback either returns here with an error flag (?google=cancelled) or with the session
  // token in the URL fragment (#google_token=...).
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("google") === "cancelled" || params.get("google") === "unavailable") {
      setNotice(GOOGLE_CANCELLED_NOTICE);
    }
    const hash = location.hash.replace(/^#/, "");
    if (hash) {
      const token = new URLSearchParams(hash).get("google_token");
      window.history.replaceState(null, "", location.pathname + location.search);
      if (token) {
        setGoogleBusy(true);
        signInWithToken(token)
          .then(() => navigate(from, { replace: true }))
          .catch(() => {
            setNotice(GOOGLE_CANCELLED_NOTICE);
            setGoogleBusy(false);
          });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (user) {
    return <Navigate to="/" replace />;
  }

  function handleGoogleSignIn() {
    setError("");
    setNotice("");
    setGoogleBusy(true);
    // Full-page navigation: the browser leaves for Google and comes back to /auth/google/callback.
    window.location.assign("/auth/google");
  }

  const setField = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    if (error) setError("");
  };

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
      if (form.password.length < 8) {
        setError("Password must be at least 8 characters.");
        return;
      }
      if (!/[A-Za-z]/.test(form.password) || !/[0-9]/.test(form.password)) {
        setError("Password must contain at least one letter and one number.");
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
      <div className="login-page-inner" style={{ width: "100%", maxWidth: "620px", display: "flex", flexDirection: "column", alignItems: "center" }}>
        <DoodleCrewFooter
          as="div"
          showTop={false}
          showBar={false}
          height="auto"
          wordmark="EVENTURE"
          tagline={mode === "login" ? "Sign in to access your campus timeline and event threads" : "Create an account to begin tracking campus events"}
          actions={[]}
          palette={{
            background: "var(--bg, #f1f5f9)",
            ink: "var(--ink, #0f172a)",
            accent: "#6366f1",
          }}
          crew={[
            { kind: "yeti", letter: 0, seat: "front", offset: -0.32, name: "Bruno", says: "Ready to sign in?" },
            { kind: "bird", letter: 1, seat: "top", offset: 0.02, name: "Pip", says: "Track all deadlines!" },
            { kind: "kid", letter: 4, seat: "top", offset: -0.05, name: "Juno", says: "Welcome to Eventure!" },
            { kind: "cat", letter: 7, seat: "front", offset: 0.42, flip: true, name: "Patch", says: "Let's get started." },
          ]}
          doodleCount={6}
          style={{ width: "100%", marginBottom: "1rem" }}
        />
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

        {notice && (
          <Notice variant="info" message={notice} className="login-notice" />
        )}

        {googleReady && (
          <>
            <button
              type="button"
              className="btn google-signin-btn"
              onClick={handleGoogleSignIn}
              disabled={googleBusy || busy}
            >
              {googleBusy ? (
                <>
                  <Loader2 size={16} className="btn-spinner" />
                  <span>Connecting to Google...</span>
                </>
              ) : (
                <>
                  <GoogleMark size={18} />
                  <span>Continue with Google</span>
                </>
              )}
            </button>
            <div className="login-or-divider" aria-hidden="true">
              <span className="login-or-line" />
              <span className="login-or-text">or</span>
              <span className="login-or-line" />
            </div>
          </>
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
                placeholder="At least 8 characters"
                minLength={8}
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
                  minLength={8}
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
            disabled={busy}
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

        <div className="login-toggle-row">
          {mode === "login" ? (
            <p className="login-switch-text">
              Don&apos;t have an account?{" "}
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
    </div>
  );
}
