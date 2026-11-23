import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  CalendarDays,
  ChevronDown,
  ClipboardPaste,
  Moon,
  ScanSearch,
  Sun,
} from "lucide-react";
import Logo from "../components/Logo.jsx";
import Status from "../components/Status.jsx";
import Badge from "../components/Badge.jsx";
import DoodleCrewFooter from "@/components/ui/doodle-crew-footer";

const HOW_STEPS = [
  {
    icon: <ClipboardPaste size={20} strokeWidth={1.75} />,
    title: "Paste notice or image",
    desc: "Drop a poster image or paste the raw message text from your student group.",
  },
  {
    icon: <ScanSearch size={20} strokeWidth={1.75} />,
    title: "Extract dates & venues",
    desc: "Review dates, location, deadlines, and registration links extracted in seconds.",
  },
  {
    icon: <CalendarDays size={20} strokeWidth={1.75} />,
    title: "Track on clear timeline",
    desc: "See deadlines, commute travel times, and exam clashes all in one chronological thread.",
  },
];

const FAQS = [
  {
    q: "Is Eventure free for students?",
    a: "Yes, completely free. Eventure is built for students managing busy college event seasons with zero paywalls.",
  },
  {
    q: "How does notice extraction work?",
    a: "Eventure reads plain text, announcement notices, or forwards to extract event titles, venues, dates, and registration links automatically.",
  },
  {
    q: "Can I connect external portals like Unstop or Devfolio?",
    a: "Yes. Configure tracked platforms in Settings to monitor event updates and pull deadlines directly into your timeline.",
  },
  {
    q: "How does travel time calculate departure times?",
    a: "It estimates transit duration from your saved campus location to the venue, adding a 15-minute buffer so you leave on time.",
  },
];

export default function Landing({ theme, toggleTheme }) {
  const navigate = useNavigate();
  const [openFaq, setOpenFaq] = useState(null);

  const howRef = useRef(null);
  const featuresRef = useRef(null);
  const faqRef = useRef(null);

  const scrollTo = (ref) => {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="landing-page-wrap">
      {/* ── 1. Sticky Navbar ── */}
      <header className="landing-navbar">
        <div className="landing-container landing-nav-inner">
          <Link to="/" className="landing-brand-link" aria-label="Eventure home">
            <Logo size={24} />
          </Link>

          <nav className="landing-nav-center" aria-label="Landing Navigation">
            <button type="button" onClick={() => scrollTo(howRef)}>
              How it works
            </button>
            <button type="button" onClick={() => scrollTo(featuresRef)}>
              Features
            </button>
            <button type="button" onClick={() => scrollTo(faqRef)}>
              FAQ
            </button>
          </nav>

          <div className="landing-nav-right">
            <button
              type="button"
              className="theme-toggle-btn"
              onClick={toggleTheme}
              aria-label="Toggle light or dark theme"
            >
              {theme === "dark" ? <Sun size={15} strokeWidth={1.75} /> : <Moon size={15} strokeWidth={1.75} />}
            </button>
            <Link to="/login" className="btn ghost small">
              Sign in
            </Link>
            <Link to="/signup" className="btn small">
              Get started
            </Link>
          </div>
        </div>
      </header>

      {/* ── 2. Top Hero Section with Doodle Crew EVENTURE ── */}
      <section className="landing-hero-section landing-hero-doodle-wrap" style={{ paddingTop: "1.5rem" }}>
        <DoodleCrewFooter
          as="div"
          showTop={false}
          showBar={false}
          height="auto"
          wordmark="EVENTURE"
          tagline="Never miss a campus event, hackathon, or registration deadline again."
          palette={{
            background: theme === "dark" ? "#0c1322" : "#f8fafc",
            ink: theme === "dark" ? "#f8fafc" : "#0f172a",
            accent: "#6366f1",
          }}
          crew={[
            { kind: "yeti", letter: 0, seat: "front", offset: -0.32, name: "Bruno", says: "Any free pizza at the hackathon?" },
            { kind: "bird", letter: 1, seat: "top", offset: 0.02, name: "Pip", says: "Don't miss the registration deadline!" },
            { kind: "mushroom", letter: 2, seat: "front", offset: 0.12, scale: 0.95, name: "Morel", says: "Workshop starts in 10 mins." },
            { kind: "kid", letter: 4, seat: "top", offset: -0.05, name: "Juno", says: "Best campus events right here!" },
            { kind: "ghost", letter: 6, seat: "behind", offset: 0, name: "Boo", says: "Boo! No clash detected." },
            { kind: "cat", letter: 7, seat: "front", offset: 0.42, flip: true, name: "Patch", says: "Ready for Tech Fest finale?" },
          ]}
          actions={[
            { label: "Get started", icon: "bolt", variant: "solid", onClick: () => navigate("/signup") },
            { label: "Sign in", icon: "sandwich", variant: "outline", onClick: () => navigate("/login") },
          ]}
          style={{ width: "100%", maxWidth: "1280px", margin: "0 auto" }}
        />

        <div className="landing-container landing-hero-grid" style={{ marginTop: "2rem" }}>
          <div className="landing-hero-text">
            <h1 className="hero-title">
              Every campus event. <span className="brand-accent">One clear thread.</span>
            </h1>

            <p className="hero-desc">
              Eventure helps you track hackathons, workshops, fests, contests and exams in one
              clear timeline — with deadlines, travel times and clash warnings.
            </p>

            <div className="hero-actions">
              <Link to="/signup" className="btn hero-cta-primary">
                <span>Get started</span>
                <ArrowRight size={15} strokeWidth={1.75} />
              </Link>
              <button
                type="button"
                className="btn ghost hero-cta-secondary"
                onClick={() => scrollTo(howRef)}
              >
                See how it works
              </button>
            </div>
          </div>

          {/* Simple "Add event" preview card: Paste box + 4 extracted rows */}
          <div className="landing-hero-preview">
            <div className="clean-hero-card">
              <div className="card-mock-title">Add event from notice</div>
              
              {/* Paste preview mockup */}
              <div className="hero-mock-pastebox">
                <span className="mock-paste-text">
                  Campus Tech Fest 2026: Venue Central Campus Audi 2. Starts 21 Nov 10:00 AM, Abstract due 18 Nov...
                </span>
                <span className="mock-paste-badge">Extracted</span>
              </div>

              {/* 4 extracted rows */}
              <div className="hero-extracted-list">
                <div className="hero-extracted-row">
                  <span className="row-key">Title</span>
                  <span className="row-val">Tech Fest Finale</span>
                </div>
                <div className="hero-extracted-row">
                  <span className="row-key">Date</span>
                  <span className="row-val">21–22 Nov 2026</span>
                </div>
                <div className="hero-extracted-row">
                  <span className="row-key">Venue</span>
                  <span className="row-val">Central Campus, Hall A</span>
                </div>
                <div className="hero-extracted-row">
                  <span className="row-key">Deadline</span>
                  <div className="row-val-status">
                    <span>18 Nov 11:59 PM</span>
                    <Status variant="neutral" label="Due soon" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 3. How It Works (3 Columns with dividers, clean icons) ── */}
      <section className="landing-section subtle-bg" ref={howRef}>
        <div className="landing-container">
          <div className="section-head-simple">
            <h2 className="section-title">How it works</h2>
            <p className="section-subtitle">
              From announcement message to organized timeline in three steps.
            </p>
          </div>

          <div className="how-columns-row">
            {HOW_STEPS.map((step, idx) => (
              <div key={idx} className="how-column-item">
                <div className="how-icon-wrap">{step.icon}</div>
                <h3 className="how-col-title">{step.title}</h3>
                <p className="how-col-desc">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 4. Features (2 Alternating text+visual rows, then small items) ── */}
      <section className="landing-section" ref={featuresRef}>
        <div className="landing-container">
          <div className="section-head-simple">
            <h2 className="section-title">Features</h2>
            <p className="section-subtitle">
              Built to manage the clash and scramble of college event seasons.
            </p>
          </div>

          {/* Row 1: Text Left, Visual Right */}
          <div className="feature-alt-row">
            <div className="feature-alt-text">
              <h3 className="feature-alt-title">Catch schedule and exam clashes early</h3>
              <p className="feature-alt-desc">
                When two events overlap or an event falls right inside your semester exam datesheet,
                Eventure flags the collision immediately with concrete resolution options.
              </p>
            </div>
            <div className="feature-alt-visual">
              <div className="visual-mock-box">
                <div className="visual-clash-header">
                  <Badge variant="neutral">Overlap</Badge>
                </div>
                <div className="visual-clash-names">
                  <span>Tech Fest Finale</span>
                  <span className="clash-vs">vs</span>
                  <span>Cloud Workshop</span>
                </div>
                <p className="visual-clash-sub">Events share overlapping hours on Saturday</p>
              </div>
            </div>
          </div>

          {/* Row 2: Visual Left, Text Right */}
          <div className="feature-alt-row reverse">
            <div className="feature-alt-text">
              <h3 className="feature-alt-title">Know your commute transit time</h3>
              <p className="feature-alt-desc">
                Set your campus location once. Eventure calculates estimated road travel time and
                adds a realistic safety buffer so you leave on time.
              </p>
            </div>
            <div className="feature-alt-visual">
              <div className="visual-mock-box">
                <div className="visual-transit-route">
                  <span className="route-stop">Central Campus</span>
                  <span className="route-arrow">→</span>
                  <span className="route-stop">Venue A</span>
                </div>
                <div className="visual-transit-meta">
                  <span className="meta-time">42 min travel</span>
                  <span className="meta-buffer">+15 min buffer</span>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom 3 simple text items */}
          <div className="features-mini-row">
            <div className="feature-mini-col">
              <h4>Milestone Stages</h4>
              <p>Break any event into registration, submission, shortlist and final checkpoints.</p>
            </div>
            <div className="feature-mini-col">
              <h4>Event Vault</h4>
              <p>Keep links, notes and checklists for each event in one spot.</p>
            </div>
            <div className="feature-mini-col">
              <h4>Verified Reviews</h4>
              <p>Read honest reviews written strictly by students who attended past editions.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 5. FAQ (4 Questions) ── */}
      <section className="landing-section subtle-bg" ref={faqRef}>
        <div className="landing-container max-w-narrow">
          <div className="section-head-simple">
            <h2 className="section-title">Frequently asked questions</h2>
          </div>

          <div className="faq-clean-wrap">
            {FAQS.map((faq, idx) => (
              <div key={idx} className={`faq-row-item${openFaq === idx ? " open" : ""}`}>
                <button
                  type="button"
                  className="faq-clean-btn"
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                  aria-expanded={openFaq === idx}
                >
                  <span>{faq.q}</span>
                  <ChevronDown size={16} strokeWidth={1.75} className="faq-chevron" />
                </button>
                {openFaq === idx && <div className="faq-clean-answer">{faq.a}</div>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 6. CTA Section (Clean distinct block on page bg, 80px spacing) ── */}
      <section className="landing-cta-section">
        <div className="landing-container">
          <div className="landing-cta-box">
            <h2 className="cta-band-title">Ready to streamline your event schedule?</h2>
            <p className="cta-band-desc">
              Track deadlines, avoid clashes, and keep all your campus events in one clear thread.
            </p>
            <div className="cta-clean-btn-row">
              <Link to="/signup" className="btn">
                <span>Get started</span>
                <ArrowRight size={15} strokeWidth={1.75} />
              </Link>
              <Link to="/login" className="btn ghost">
                Sign in
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── 7. Separate Footer Block ── */}
      <footer className="landing-main-footer">
        <div className="landing-container footer-simple-wrap">
          <div className="footer-col-brand">
            <Logo size={22} />
            <p className="footer-tagline">
              Every campus event, one clear thread.
            </p>
          </div>

          <div className="footer-col-nav">
            <div className="footer-col">
              <span className="footer-col-heading">Product</span>
              <Link to="/login" className="footer-nav-link">Timeline</Link>
              <Link to="/discover" className="footer-nav-link">Discover</Link>
              <Link to="/add" className="footer-nav-link">Add event</Link>
            </div>

            <div className="footer-col">
              <span className="footer-col-heading">Account</span>
              <Link to="/login" className="footer-nav-link">Sign in</Link>
              <Link to="/signup" className="footer-nav-link">Create account</Link>
            </div>

            <div className="footer-col">
              <span className="footer-col-heading">Help</span>
              <button
                type="button"
                className="footer-nav-link"
                onClick={() => faqRef.current?.scrollIntoView({ behavior: "smooth" })}
              >
                FAQ
              </button>
              <button
                type="button"
                className="footer-nav-link"
                onClick={() => howRef.current?.scrollIntoView({ behavior: "smooth" })}
              >
                How it works
              </button>
              <Link to="/privacy" className="footer-nav-link">Privacy</Link>
              <Link to="/terms" className="footer-nav-link">Terms</Link>
              <a href="mailto:support@eventure.app" className="footer-nav-link">Contact</a>
            </div>
          </div>
        </div>

        <div className="landing-container footer-bottom-divider">
          <span>© 2026 Eventure</span>
        </div>
      </footer>
    </div>
  );
}
