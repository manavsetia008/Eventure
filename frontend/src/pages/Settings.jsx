import { useCallback, useEffect, useState } from "react";
import { api, calendarFeedUrl } from "../api";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import { urlBase64ToUint8Array } from "../utils";

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
      <div className="card-head">
        <h2>Google Calendar sync</h2>
        {st.connected ? <span className="pill ok">Connected</span> : <span className="pill">Not connected</span>}
      </div>
      {!st.configured ? (
        <p className="muted small">
          Not enabled on this server. The calendar feed below works without setup.
        </p>
      ) : (
        <>
          <p className="muted small">
            Sends your events and deadlines to Google Calendar, and detects clashes with your personal schedule.
          </p>
          <div className="row">
            {!st.connected ? (
              <button className="btn small" disabled={busy} onClick={() => run(async () => { const r = await api.get("/google/connect"); window.location.href = r.url; })}>
                Connect Google Calendar
              </button>
            ) : (
              <>
                <button className="btn small" disabled={busy} onClick={() => run(async () => {
                  const r = await api.post("/google/sync");
                  const c = r.counts;
                  setMsg(`Sent ${c.created + c.updated} items${c.deleted ? `, removed ${c.deleted}` : ""}${c.failed ? `, ${c.failed} could not be sent` : ""}.`);
                  await loadStatus();
                })}>{busy ? "Syncing..." : "Sync now"}</button>
                <button className="btn ghost small" disabled={busy} onClick={() => window.confirm("Disconnect and remove the events Eventure added to your calendar?") && run(async () => { await api.post("/google/disconnect"); await loadStatus(); })}>Disconnect</button>
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

const CAMPUS_PRESETS = [
  { label: "-- Select a campus preset to auto-fill --", college: "", lat: "", lng: "" },
  { label: "IIIT Delhi (Okhla Industrial Estate)", college: "IIIT Delhi", lat: "28.5459", lng: "77.2732" },
  { label: "IIT Delhi (Hauz Khas)", college: "IIT Delhi", lat: "28.5450", lng: "77.1926" },
  { label: "DTU / Delhi Tech University (Rohini)", college: "DTU Delhi", lat: "28.7499", lng: "77.1170" },
  { label: "NSUT (Dwarka Campus)", college: "NSUT Delhi", lat: "28.6091", lng: "77.0351" },
  { label: "IGDTUW (Kashmere Gate)", college: "IGDTUW", lat: "28.6653", lng: "77.2324" },
  { label: "Delhi University (North Campus)", college: "DU North Campus", lat: "28.6892", lng: "77.2104" },
  { label: "IIT Bombay (Powai)", college: "IIT Bombay", lat: "19.0760", lng: "72.8777" },
  { label: "BITS Pilani (Pilani Campus)", college: "BITS Pilani", lat: "28.3639", lng: "75.5870" },
];

function PushCard() {
  const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  const [key, setKey] = useState(null);
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
    if ((await Notification.requestPermission()) !== "granted") {
      throw new Error("Alerts are blocked in this browser. Allow notifications in browser settings, then try again.");
    }
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) });
    await api.post("/push/subscribe", sub.toJSON());
    setEnabled(true);
    setMsg("Alerts are turned on for this device.");
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
      <div className="card-head">
        <h2>Phone and browser alerts</h2>
        {enabled ? <span className="pill ok">Active</span> : <span className="pill">Off</span>}
      </div>
      {!supported ? (
        <div className="notice small">
          <strong>Device push compatibility:</strong>
          <p className="muted" style={{ margin: "0.25rem 0 0.4rem" }}>
            This browser does not support background push alerts in its current mode.
          </p>
          <ul style={{ margin: 0, paddingLeft: "1.2rem", color: "var(--muted)" }}>
            <li><strong>Android:</strong> Open in Chrome or Edge, tap menu (⋮) and select <em>"Install App"</em> or <em>"Add to Home screen"</em>.</li>
            <li><strong>iOS:</strong> Open in Safari, tap Share (⎋), then select <em>"Add to Home Screen"</em> to enable Web Push.</li>
            <li><strong>Desktop:</strong> Works directly in Chrome, Edge, and Firefox when notification permissions are granted.</li>
          </ul>
        </div>
      ) : key === "" ? (
        <p className="muted small">Push alerts are not configured on this server.</p>
      ) : (
        <>
          <p className="muted small">Get notifications when a critical deadline is at risk.</p>
          <div className="row">
            {enabled ? (
              <>
                <button className="btn ghost small" onClick={() => run(async () => { await api.post("/push/test"); setMsg("Test alert sent."); })}>Send a test</button>
                <button className="btn ghost small" onClick={() => run(disable)}>Turn off on this device</button>
              </>
            ) : (
              <button className="btn small" disabled={key === null} onClick={() => run(enable)}>Turn on alerts</button>
            )}
          </div>
        </>
      )}
      {msg && <p className="notice">{msg}</p>}
      {err && <p className="error">{err}</p>}
    </section>
  );
}

function PortalsCard() {
  const [portals, setPortals] = useState([]);
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api.get("/portals")
      .then((r) => setPortals(r.portals || []))
      .catch((e) => setErr(e.message));
  }, []);

  useEffect(() => { load(); }, [load]);

  const add = async (e) => {
    e.preventDefault();
    setErr("");
    setMsg("");
    setBusy(true);
    try {
      await api.post("/portals", { name, domain_or_name: domain, registered_email: email });
      setName("");
      setDomain("");
      setEmail("");
      setMsg("Portal added to your tracked watcher list.");
      load();
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (id, current) => {
    try {
      await api.patch(`/portals/${id}`, { auto_sync: !current });
      load();
    } catch (ex) {
      setErr(ex.message);
    }
  };

  const sync = async (id, pName) => {
    setErr("");
    setMsg("");
    setBusy(true);
    try {
      const res = await api.post(`/portals/${id}/sync`);
      setMsg(res.message || `Checked updates for ${pName}`);
      load();
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Remove this portal from your watcher list?")) return;
    try {
      await api.del(`/portals/${id}`);
      load();
    } catch (ex) {
      setErr(ex.message);
    }
  };

  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h2>Tracked Portals & Registration Watcher</h2>
          <p className="muted small">
            Choose which competition websites (e.g. Unstop, Devfolio, xyz.com) you participate on. Eventure monitors your registered email and syncs registration deadlines automatically.
          </p>
        </div>
      </div>

      {err && <p className="error">{err}</p>}
      {msg && <p className="notice">{msg}</p>}

      <div className="portal-grid">
        {portals.map((p) => (
          <div key={p.id} className="portal-card">
            <div className="portal-card-header">
              <strong>{p.name}</strong>
              <span className={`pill ${p.auto_sync ? "ok" : ""}`}>{p.auto_sync ? "Auto-Sync Active" : "Paused"}</span>
            </div>
            <div className="portal-card-body">
              <div><code>{p.domain_or_name}</code></div>
              <div className="small muted">Email: {p.registered_email || "Account default"}</div>
              {p.last_synced_at && <div className="small muted">Checked: {p.last_synced_at.replace("T", " ").slice(0, 16)}</div>}
            </div>
            <div className="portal-card-actions">
              <button type="button" className="linklike small" disabled={busy} onClick={() => sync(p.id, p.name)}>
                Sync deadlines
              </button>
              <button type="button" className="linklike small" onClick={() => toggle(p.id, p.auto_sync)}>
                {p.auto_sync ? "Pause" : "Enable"}
              </button>
              <button type="button" className="linklike small" style={{ color: "var(--alert)" }} onClick={() => remove(p.id)}>
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={add} style={{ marginTop: "1.2rem", paddingTop: "1rem", borderTop: "1px solid var(--line)" }}>
        <h3 style={{ fontSize: "0.95rem", marginBottom: "0.6rem" }}>Add a competition site or custom portal</h3>
        <div className="row">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Portal name (e.g. XYZ Hackathons)"
            required
            aria-label="Portal name"
          />
          <input
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="Domain or URL (e.g. xyz.com)"
            required
            aria-label="Portal domain"
          />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Your registered email (optional)"
            aria-label="Registered email"
          />
          <button className="btn small" disabled={busy}>
            {busy ? "Adding..." : "Add portal"}
          </button>
        </div>
      </form>
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
      <h2>Delete account</h2>
      <p className="muted small">Removes your timeline, reviews, alerts, and calendar integrations. Public events you created remain for other attendees. This cannot be undone.</p>
      {!open ? (
        <button className="btn ghost small" onClick={() => setOpen(true)}>Delete my account</button>
      ) : (
        <form onSubmit={remove}>
          <label>Type your password to confirm<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
          {err && <p className="error">{err}</p>}
          <div className="row">
            <button className="btn danger-btn small" disabled={busy}>{busy ? "Deleting..." : "Delete everything"}</button>
            <button type="button" className="btn ghost small" onClick={() => { setOpen(false); setPassword(""); setErr(""); }}>Cancel</button>
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
    if (!navigator.geolocation) return setError("Your browser cannot share location. Enter coordinates manually.");
    navigator.geolocation.getCurrentPosition(
      (pos) => setP((x) => ({ ...x, college_lat: pos.coords.latitude.toFixed(5), college_lng: pos.coords.longitude.toFixed(5) })),
      () => setError("Location access was denied. Enter coordinates manually."),
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
      <div className="page-head">
        <div>
          <h1>Settings</h1>
          <p className="muted small">Account profile, campus location, and external calendar sync.</p>
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      <form className="card" onSubmit={saveProfile}>
        <h2>Profile & Campus</h2>
        <label>Name<input value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} required /></label>
        
        <label>
          Campus Preset (Auto-detect & transit)
          <select
            onChange={(e) => {
              const selected = CAMPUS_PRESETS.find((c) => c.label === e.target.value);
              if (selected && selected.college) {
                setP((x) => ({ ...x, college: selected.college, college_lat: selected.lat, college_lng: selected.lng }));
              }
            }}
            defaultValue=""
          >
            {CAMPUS_PRESETS.map((c) => (
              <option key={c.label} value={c.label}>{c.label}</option>
            ))}
          </select>
        </label>

        <label>College / Institution Name<input value={p.college} onChange={(e) => setP({ ...p, college: e.target.value })} placeholder="e.g. IIIT Delhi, DTU" /></label>
        
        <div style={{ margin: "0.4rem 0 0.8rem", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
          <div>
            {p.college_lat && p.college_lng ? (
              <span className="small ok">📍 Campus pinned for commute estimates ({p.college_lat}, {p.college_lng})</span>
            ) : (
              <span className="small muted">Campus coordinates not pinned yet.</span>
            )}
          </div>
          <button type="button" className="linklike small" onClick={useMyLocation}>Auto-detect campus via GPS</button>
        </div>

        <details style={{ marginBottom: "1rem" }}>
          <summary className="small muted">Fine-tune GPS coordinates manually (optional)</summary>
          <div className="grid2" style={{ marginTop: "0.4rem" }}>
            <label>Latitude<input value={p.college_lat} onChange={(e) => setP({ ...p, college_lat: e.target.value })} inputMode="decimal" placeholder="28.5459" /></label>
            <label>Longitude<input value={p.college_lng} onChange={(e) => setP({ ...p, college_lng: e.target.value })} inputMode="decimal" placeholder="77.2732" /></label>
          </div>
        </details>

        <label>Goals and interests<input value={p.goals} onChange={(e) => setP({ ...p, goals: e.target.value })} placeholder="hackathon, ai, web" /></label>
        <div className="row">
          <button className="btn small">Save</button>
          {msg && <span className="muted small">{msg}</span>}
        </div>
      </form>

      <section className="card">
        <h2>Exam periods</h2>
        <p className="muted small">Events that overlap with these dates are flagged with skip suggestions.</p>
        <ul className="plain">
          {exams.map((x) => (
            <li key={x.id}>
              {x.label}: {x.start_date} to {x.end_date}{" "}
              <button type="button" className="linklike small" onClick={() => api.del(`/exams/${x.id}`).then(loadExams)}>Remove</button>
            </li>
          ))}
          {exams.length === 0 && <li className="muted small">No exam periods added yet.</li>}
        </ul>
        <form className="row" onSubmit={addExam}>
          <input value={exam.label} onChange={(e) => setExam({ ...exam, label: e.target.value })} placeholder="Label (e.g. Sessionals)" aria-label="Label" required />
          <input type="date" value={exam.start_date} onChange={(e) => setExam({ ...exam, start_date: e.target.value })} aria-label="Start date" required />
          <input type="date" value={exam.end_date} onChange={(e) => setExam({ ...exam, end_date: e.target.value })} aria-label="End date" required />
          <button className="btn small">Add exam period</button>
        </form>
      </section>

      <PortalsCard />
      <GoogleCard />
      <PushCard />

      <section className="card">
        <h2>Calendar feed (.ics)</h2>
        <p className="muted small">Works with Apple Calendar, Outlook, and Google Calendar without sign-in.</p>
        <div className="row">
          <input readOnly value={feed} onFocus={(e) => e.target.select()} aria-label="Calendar feed URL" className="mono" />
          <button className="btn small" onClick={() => navigator.clipboard.writeText(feed).then(() => setCopied(true))}>
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </section>

      <DeleteAccountCard />
    </>
  );
}
