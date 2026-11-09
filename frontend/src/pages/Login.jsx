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

  function fillDemo() {
    setForm((f) => ({ ...f, email: "demo@eventure.app", password: "demo1234" }));
    setError("");
  }

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

  async function quickDemoLogin() {
    setError("");
    setBusy(true);
    try {
      await login("demo@eventure.app", "demo1234");
      navigate("/", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="landing-layout">
      {/* 1. Header Navbar */}
      <header className="landing-nav">
        <div className="landing-nav-inner">
          <div className="landing-brand">
            <span className="brand-text">Eventure</span>
          </div>

          <nav className="landing-menu">
            <a href="#preview">Timeline</a>
            <a href="#features">Features</a>
            <a href="#how-it-works">How it works</a>
          </nav>

          <div className="landing-nav-actions">
            <button className="btn ghost small" onClick={quickDemoLogin} disabled={busy}>
              Demo login
            </button>
            <a href="#auth-card" className="btn small">
              Sign in
            </a>
          </div>
        </div>
      </header>

      {/* 2. Hero Section */}
      <section className="landing-hero">
        <div className="landing-hero-content">
          <div className="hero-pill-badge">
            <span>Campus Event Intelligence</span>
          </div>

          <h1 className="hero-heading">
            Every campus event.<br />One clear thread.
          </h1>

          <p className="hero-subtext">
            The unified calendar for college students. Track hackathon deadlines stage-by-stage,
            calculate real transit gaps between campus and venues, and keep exams conflict-free.
          </p>

          <div className="hero-highlights-list">
            <div className="highlight-item">
              <span className="check-icon">✓</span>
              <span>Automatic travel time & schedule clash detection</span>
            </div>
            <div className="highlight-item">
              <span className="check-icon">✓</span>
              <span>Milestone checklist for submissions & shortlists</span>
            </div>
            <div className="highlight-item">
              <span className="check-icon">✓</span>
              <span>Exam period shield & verified attendee reviews</span>
            </div>
          </div>

          <div className="hero-cta-group">
            <button className="btn hero-primary-btn" onClick={quickDemoLogin} disabled={busy}>
              {busy ? "Signing in..." : "Open demo timeline →"}
            </button>
            <a href="#preview" className="btn ghost hero-secondary-btn">
              View preview sample
            </a>
          </div>
        </div>

        {/* Auth Form Card */}
        <div className="landing-auth-card-wrap" id="auth-card">
          <div className="card landing-auth-card">
            <div className="auth-card-top">
              <h3>{mode === "login" ? "Sign in to Eventure" : "Create your account"}</h3>
              <p className="auth-subtext">
                {mode === "login" ? "Enter your credentials to access your personal timeline" : "Register with your campus email to start tracking"}
              </p>
            </div>

            <form onSubmit={submit}>
              {mode === "register" && (
                <label>
                  Full name
                  <input value={form.name} onChange={set("name")} placeholder="Your name" required />
                </label>
              )}

              <label>
                Email address
                <input type="email" value={form.email} onChange={set("email")} placeholder="name@college.edu" required />
              </label>

              <label>
                Password
                <input type="password" value={form.password} onChange={set("password")} minLength={6} placeholder="Enter password (min 6 characters)" required />
              </label>

              {mode === "register" && (
                <>
                  <label>
                    College
                    <input value={form.college} onChange={set("college")} placeholder="e.g. IIIT Delhi, DTU, NSUT" />
                  </label>
                  <label>
                    Goals / Interests
                    <input value={form.goals} onChange={set("goals")} placeholder="e.g. hackathons, web, ai" />
                  </label>
                </>
              )}

              {error && <div className="error">{error}</div>}

              <button className="btn auth-action-btn" disabled={busy}>
                {busy ? "Please wait..." : mode === "login" ? "Sign in" : "Create account"}
              </button>
            </form>

            <div className="auth-toggle-row">
              <button
                type="button"
                className="linklike small"
                onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}
              >
                {mode === "login" ? "New student? Create an account" : "Already registered? Sign in"}
              </button>
            </div>

            <div className="landing-demo-box">
              <div className="demo-box-head">
                <span className="demo-tag">Quick Demo</span>
                <button type="button" className="linklike small" onClick={fillDemo}>
                  Auto-fill demo credentials
                </button>
              </div>
              <div className="demo-creds-row">
                <span><code>demo@eventure.app</code></span>
                <span className="creds-divider">·</span>
                <span><code>demo1234</code></span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Timeline Sample Preview */}
      <section className="landing-section" id="preview">
        <div className="section-header">
          <h2>Student timeline preview</h2>
          <p className="section-desc">Unified tracker showing registered rounds, transit times, and conflict warnings.</p>
        </div>

        <div className="timeline-preview-card">
          {/* Summary counters */}
          <div className="preview-metrics">
            <div className="metric-box">
              <b>3</b>
              <span>Upcoming</span>
            </div>
            <div className="metric-box">
              <b>2</b>
              <span>Due this week</span>
            </div>
            <div className="metric-box alert-box">
              <b>1</b>
              <span>Schedule clash</span>
            </div>
          </div>

          {/* Conflict card */}
          <div className="preview-issue">
            <div className="issue-title-row">
              <strong>Schedule clash: Hackathon X vs Cloud Workshop Y</strong>
              <span className="pill alert-pill">Clash</span>
            </div>
            <p className="preview-issue-text">
              Events overlap on Saturday between 14:00 and 17:00.
            </p>
            <div className="preview-recommendation">
              Recommendation: Prioritize Hackathon X. Your team submission is due in 2 days.
            </div>
          </div>

          {/* Sample event card */}
          <div className="preview-event-card">
            <div className="event-head-row">
              <div>
                <h4 className="preview-event-title">Hackathon X</h4>
                <p className="preview-event-subtitle">Sat, 10:00 - 18:00 · IIIT Delhi Campus</p>
              </div>
              <div className="pills">
                <span className="pill">Unstop</span>
                <span className="pill">Hackathon</span>
                <span className="pill score">Priority 82</span>
              </div>
            </div>

            <div className="preview-stages-list">
              <div className="stage-row done">
                <span className="stage-name">Registration</span>
                <span className="stage-status done">Completed</span>
              </div>
              <div className="stage-row due">
                <span className="stage-name">Project Submission</span>
                <span className="stage-status due">Due in 2 days</span>
              </div>
              <div className="stage-row">
                <span className="stage-name">Final Presentation</span>
                <span className="stage-status">Saturday 10:00</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Core Features */}
      <section className="landing-section" id="features">
        <div className="section-header">
          <h2>Core capabilities</h2>
          <p className="section-desc">Built to organize college hackathons, competitions, and campus schedules.</p>
        </div>

        <div className="compact-features-grid">
          <div className="feature-item-card">
            <h3>Travel & Transit Buffer</h3>
            <p>Calculates real travel times from your college. Flags events when the gap between back-to-back sessions is too tight.</p>
          </div>

          <div className="feature-item-card">
            <h3>Stage-by-Stage Tracking</h3>
            <p>Keep abstract submissions, prototype deadlines, and shortlist announcements organized in one continuous checklist.</p>
          </div>

          <div className="feature-item-card">
            <h3>Exam Period Protection</h3>
            <p>Configure semester exam dates. Eventure automatically flags low-priority events that collide with your study schedule.</p>
          </div>

          <div className="feature-item-card">
            <h3>Verified Reviews</h3>
            <p>Feedback and ratings contributed exclusively by students who attended previous editions of the event.</p>
          </div>

          <div className="feature-item-card">
            <h3>Notice & Flyer Extraction</h3>
            <p>Paste circular text or upload event posters to extract dates, venue coordinates, and registration links automatically.</p>
          </div>

          <div className="feature-item-card">
            <h3>Calendar Feed (.ics)</h3>
            <p>Sync your timeline directly into Google Calendar, Apple Calendar, or Outlook with automated updates.</p>
          </div>
        </div>
      </section>

      {/* 5. How It Works */}
      <section className="landing-section bg-alt" id="how-it-works">
        <div className="section-header">
          <h2>How it works</h2>
          <p className="section-desc">Three simple steps to stay ahead of every deadline.</p>
        </div>

        <div className="simple-steps-row">
          <div className="simple-step">
            <span className="step-tag">1</span>
            <h4>Capture</h4>
            <p>Paste event details, forward notices, or discover hackathons on the campus map.</p>
          </div>

          <div className="simple-step">
            <span className="step-tag">2</span>
            <h4>Track</h4>
            <p>Eventure organizes milestones, estimates commute time, and checks for exam clashes.</p>
          </div>

          <div className="simple-step">
            <span className="step-tag">3</span>
            <h4>Deliver</h4>
            <p>Stay on track with timely deadline alerts and keep your college record verified.</p>
          </div>
        </div>
      </section>

      {/* 6. Footer */}
      <footer className="landing-footer">
        <div className="footer-content">
          <div className="footer-brand">
            <div className="landing-brand">
              <span className="brand-text">Eventure</span>
            </div>
            <p className="footer-tagline">Every campus event, one thread.</p>
            <p className="footer-credits">Team Quanta: Manav Setia, Mayank Sharma, Milan Sharma.</p>
          </div>

          <div className="footer-links">
            <a href="#preview">Timeline</a>
            <a href="#features">Features</a>
            <a href="#how-it-works">How it works</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
