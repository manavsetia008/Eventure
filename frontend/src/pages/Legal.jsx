import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import Logo from "../components/Logo.jsx";

function LegalShell({ title, children }) {
  return (
    <div className="legal-page">
      <header className="legal-header">
        <Link to="/" className="landing-brand-link" aria-label="Eventure home">
          <Logo size={24} />
        </Link>
        <Link to="/" className="btn ghost small">
          <ArrowLeft size={15} strokeWidth={1.75} />
          Back to home
        </Link>
      </header>
      <main className="legal-body">
        <h1>{title}</h1>
        {children}
      </main>
      <footer className="legal-footer">
        <span>© 2026 Eventure</span>
        <span>
          Questions? <a href="mailto:support@eventure.app">support@eventure.app</a>
        </span>
      </footer>
    </div>
  );
}

export function Privacy() {
  return (
    <LegalShell title="Privacy Policy">
      <p className="muted">Last updated: November 2026</p>
      <h2>What we collect</h2>
      <p>
        Eventure stores the information you give us: your name, email address, campus, interests,
        the events you add or save, exam dates, portal connections, and preferences such as your
        scoring settings. If you sign in with Google, we receive your name, email address and
        profile photo from Google.
      </p>
      <h2>How we use it</h2>
      <p>
        We use this data to run the product: building your timeline, detecting clashes, ranking
        events for you, sending deadline reminders you asked for, and syncing the portals you
        choose to track. We do not sell your data or show it to advertisers.
      </p>
      <h2>What we do not do</h2>
      <p>
        Eventure does not read your messages or email beyond the event forwards and portal
        notifications you set up, and we do not track you across other websites.
      </p>
      <h2>Your controls</h2>
      <p>
        You can edit your profile, scoring settings and portals at any time in Settings. To delete
        your account and all associated data permanently, open Settings and choose Delete account.
      </p>
      <h2>Contact</h2>
      <p>
        Questions about this policy or your data:{" "}
        <a href="mailto:support@eventure.app">support@eventure.app</a>.
      </p>
    </LegalShell>
  );
}

export function Terms() {
  return (
    <LegalShell title="Terms of Service">
      <p className="muted">Last updated: November 2026</p>
      <h2>The service</h2>
      <p>
        Eventure helps students track campus events, deadlines and schedules. It is provided
        &ldquo;as is&rdquo; for personal, non-commercial use.
      </p>
      <h2>Your account</h2>
      <p>
        You are responsible for keeping your sign-in details safe and for the activity on your
        account. You can delete your account at any time from Settings.
      </p>
      <h2>Event information</h2>
      <p>
        Event details come from notices you paste, portals you track, and community listings.
        Always confirm dates, venues and deadlines with the official organiser before you commit —
        Eventure summarises information and may not always be complete or current.
      </p>
      <h2>Acceptable use</h2>
      <p>
        Do not misuse the service, scrape it at scale, or upload content you do not have the right
        to share. We may suspend accounts that abuse the service.
      </p>
      <h2>Changes</h2>
      <p>
        We may update these terms as the product evolves. Continued use after changes means you
        accept the updated terms.
      </p>
      <h2>Contact</h2>
      <p>
        Questions:{" "}
        <a href="mailto:support@eventure.app">support@eventure.app</a>.
      </p>
    </LegalShell>
  );
}
