import { useCallback, useEffect, useState } from "react";
import { api, calendarFeedUrl } from "../api";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth.jsx";

function urlBase64ToUint8Array(b64) {
  const padded = (b64 + "=".repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

function GoogleCard() {
  const [st, setSt] = useState(null);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const loadStatus = useCallback(() => api.get("/google/status").then(setSt).catch((e) => setErr(e.message)), []);
  useEffect(() => {
    loadStatus();
    const result = new URLSearchParams(window.location.search).get("google");
    if (result === "connected") setMsg("Google Calendar is connected. Press Sync now to send your events.");
    else if (result === "declined") setErr("You did not allow access, so nothing was connected.");
    else if (result) setErr("Google could not connect. Try again.");
  }, [loadStatus]);

  const run = async (fn) => {
    setErr("");
    setMsg("");
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (!st) return null;
  return (
    <section className="card">
      <h2>Google Calendar sync</h2>
      {!st.configured ? (
        <p className="muted">Not switched on for this server. The admin adds a Google client ID and secret (see the README). The calendar feed below works without it.</p>
      ) : (
        <>
          <p className="muted">Sends your events and open deadlines to your Google Calendar, and checks your own calendar so a dentist visit or class clash shows up on your timeline. Only events Eventure created are changed.</p>
          <div className="row">
            {!st.connected ? (
              <button className="btn" disabled={busy} onClick={() => run(async () => { const r = await api.get("/google/connect"); window.location.href = r.url; })}>Connect Google Calendar</button>
            ) : (
              <>
                <button className="btn" disabled={busy} onClick={() => run(async () => {
                  const r = await api.post("/google/sync");
                  const c = r.counts;
                  setMsg(`Sent ${c.created + c.updated} items${c.deleted ? `, removed ${c.deleted}` : ""}${c.failed ? `, ${c.failed} could not be sent` : ""}.`);
                  await loadStatus();
                })}>{busy ? "Syncing..." : "Sync now"}</button>
                <button className="btn ghost" disabled={busy} onClick={() => window.confirm("Disconnect and remove the events Eventure added to your calendar?") && run(async () => { await api.post("/google/disconnect"); await loadStatus(); })}>Disconnect</button>
                {st.last_sync && <span className="muted small">Last sync {st.last_sync.replace("T", " ")}</span>}
              </>
            )}
          </div>
        </>
      )}
      {msg && <p className="notice">{msg}</p>}
      {err && <p className="error">{err}</p>}
    </section>
  );
}

function PushCard() {
  const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  const [key, setKey] = useState(null); // null: loading, "": not set up on the server
  const [enabled, setEnabled] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!supported) return;
    api.get("/push/key").then((r) => setKey(r.public_key || "")).catch(() => setKey(""));
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setEnabled(!!sub))
      .catch(() => {});
  }, [supported]);

  const run = async (fn) => {
    setErr("");
    setMsg("");
    try {
      await fn();
    } catch (e) {
      setErr(e.message || "Something went wrong. Try again.");
    }
  };

  async function enable() {
    if ((await Notification.requestPermission()) !== "granted") throw new Error("Alerts are blocked for this site. Allow notifications in your browser settings, then try again.");
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) });
    await api.post("/push/subscribe", sub.toJSON());
    setEnabled(true);
    setMsg("Alerts are on for this device.");
  }

  async function disable() {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await api.post("/push/unsubscribe", { endpoint: sub.endpoint });
      await sub.unsubscribe();
    }
    setEnabled(false);
  }

  return (
    <section className="card">
      <h2>Phone and browser alerts</h2>
      {!supported ? (
        <p className="muted">This browser cannot receive push alerts. On iPhone, add Eventure to your Home Screen first (Share, then Add to Home Screen), then open it from there.</p>
      ) : key === "" ? (
        <p className="muted">Not switched on for this server. The admin generates alert keys (see the README).</p>
      ) : (
        <>
          <p className="muted">Get a ping when a deadline is about to be missed. We only send alerts when something is at risk.</p>
          <div className="row">
            {enabled ? (
              <>
                <button className="btn ghost" onClick={() => run(async () => { await api.post("/push/test"); setMsg("Test sent."); })}>Send a test</button>
                <button className="btn ghost" onClick={() => run(disable)}>Turn off on this device</button>
              </>
            ) : (
              <button className="btn" disabled={key === null} onClick={() => run(enable)}>Turn on alerts</button>
            )}
          </div>
        </>
      )}
      {msg && <p className="notice">{msg}</p>}
      {err && <p className="error">{err}</p>}
    </section>
  );
}

function DeleteAccountCard() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function remove(e) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      await api.del("/auth/me", { password });
      logout();
      navigate("/login", { replace: true });
    } catch (ex) {
      setErr(ex.message);
      setBusy(false);
    }
  }

  return (
    <section className="card danger">
      <h2>Delete my account</h2>
      <p className="muted">Removes your timeline, reviews, alerts and Google Calendar events that Eventure added. Events you listed publicly stay for the students who joined them. This cannot be undone.</p>
      {!open ? (
        <button className="btn ghost" onClick={() => setOpen(true)}>Delete my account</button>
      ) : (
        <form onSubmit={remove}>
          <label>Type your password to confirm<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
          {err && <p className="error">{err}</p>}
          <div className="row">
            <button className="btn danger-btn" disabled={busy}>{busy ? "Deleting..." : "Delete everything"}</button>
            <button type="button" className="btn ghost" onClick={() => { setOpen(false); setPassword(""); setErr(""); }}>Cancel</button>
          </div>
        </form>
      )}
    </section>
  );
}

export default function Settings() {
  const { user, refresh } = useAuth();
  const [p, setP] = useState({
    name: user.name, college: user.college || "", college_lat: user.college_lat ?? "", college_lng: user.college_lng ?? "",
    goals: user.goals.join(", "),
  });
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [exams, setExams] = useState([]);
  const [exam, setExam] = useState({ label: "", start_date: "", end_date: "" });
  const [copied, setCopied] = useState(false);

  const loadExams = useCallback(() => api.get("/exams").then((r) => setExams(r.exams)).catch((e) => setError(e.message)), []);
  useEffect(() => { loadExams(); }, [loadExams]);

  async function saveProfile(e) {
    e.preventDefault();
    setError("");
    setMsg("");
    try {
      await api.put("/auth/me", { ...p, college_lat: p.college_lat === "" ? null : p.college_lat, college_lng: p.college_lng === "" ? null : p.college_lng });
      await refresh();
      setMsg("Saved.");
    } catch (err) {
      setError(err.message);
    }
  }

  function useMyLocation() {
    if (!navigator.geolocation) return setError("Your browser cannot share its location. Enter the coordinates by hand.");
    navigator.geolocation.getCurrentPosition(
      (pos) => setP((x) => ({ ...x, college_lat: pos.coords.latitude.toFixed(5), college_lng: pos.coords.longitude.toFixed(5) })),
      () => setError("Location was blocked. Enter the coordinates by hand, for example from Google Maps."),
    );
  }

  async function addExam(e) {
    e.preventDefault();
    setError("");
    try {
      await api.post("/exams", exam);
      setExam({ label: "", start_date: "", end_date: "" });
      loadExams();
    } catch (err) {
      setError(err.message);
    }
  }

  const feed = calendarFeedUrl();
  return (
    <>
      <h1>Settings</h1>
      {error && <p className="error">{error}</p>}

      <form className="card" onSubmit={saveProfile}>
        <h2>You and your college</h2>
        <label>Name<input value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} required /></label>
        <label>College<input value={p.college} onChange={(e) => setP({ ...p, college: e.target.value })} /></label>
        <div className="grid2">
          <label>College latitude<input value={p.college_lat} onChange={(e) => setP({ ...p, college_lat: e.target.value })} inputMode="decimal" placeholder="28.5459" /></label>
          <label>College longitude<input value={p.college_lng} onChange={(e) => setP({ ...p, college_lng: e.target.value })} inputMode="decimal" placeholder="77.2732" /></label>
        </div>
        <button type="button" className="linklike small" onClick={useMyLocation}>Use my current location (do this on campus)</button>
        <label>Your goals (used to rank events and suggest what to skip)<input value={p.goals} onChange={(e) => setP({ ...p, goals: e.target.value })} placeholder="hackathon, ai, internships" /></label>
        <div className="row"><button className="btn">Save</button>{msg && <span className="muted">{msg}</span>}</div>
      </form>

      <section className="card">
        <h2>Exam and sessional weeks</h2>
        <p className="muted">Events that land in these dates are flagged, and low-priority ones get a skip suggestion.</p>
        <ul className="plain">
          {exams.map((x) => (
            <li key={x.id}>{x.label}: {x.start_date} to {x.end_date} <button className="linklike small" onClick={() => api.del(`/exams/${x.id}`).then(loadExams)}>Remove</button></li>
          ))}
          {exams.length === 0 && <li className="muted">None added yet.</li>}
        </ul>
        <form className="row" onSubmit={addExam}>
          <input value={exam.label} onChange={(e) => setExam({ ...exam, label: e.target.value })} placeholder="Sessionals" aria-label="Label" required />
          <input type="date" value={exam.start_date} onChange={(e) => setExam({ ...exam, start_date: e.target.value })} aria-label="Start date" required />
          <input type="date" value={exam.end_date} onChange={(e) => setExam({ ...exam, end_date: e.target.value })} aria-label="End date" required />
          <button className="btn">Add</button>
        </form>
      </section>

      <GoogleCard />
      <PushCard />

      <section className="card">
        <h2>Calendar feed</h2>
        <p className="muted">Works with any calendar app, with no Google sign-in. In Google Calendar choose Other calendars, then From URL, and paste this link. Your events and open deadlines appear there and update on their own (Google can take several hours to refresh). Anyone with the link can read your timeline, so keep it private.</p>
        <div className="row">
          <input readOnly value={feed} onFocus={(e) => e.target.select()} aria-label="Calendar feed URL" />
          <button className="btn" onClick={() => navigator.clipboard.writeText(feed).then(() => setCopied(true))}>{copied ? "Copied" : "Copy"}</button>
        </div>
        <p className="muted small">The link works while your sign-in session is valid. Sign in again and copy a fresh link if it stops updating.</p>
      </section>

      <DeleteAccountCard />
    </>
  );
}
