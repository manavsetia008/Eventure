import { useCallback, useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { api, calendarFeedUrl } from "../api";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import Status from "../components/Status.jsx";
import { urlBase64ToUint8Array } from "../utils";

function AIProvidersCard() {
  const [providers, setProviders] = useState([]);
  const [message, setMessage] = useState({});
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    try {
      const result = await api.get("/integrations/status");
      setProviders((result.integrations || []).filter((item) => ["gemini", "sarvam"].includes(item.id)));
    } catch (error) {
      setMessage({ load: { ok: false, message: error.message || "Could not load provider status." } });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function testProvider(id) {
    setBusy(id);
    setMessage((previous) => ({ ...previous, [id]: null }));
    try {
      const result = await api.post(`/integrations/test/${id}`);
      setMessage((previous) => ({ ...previous, [id]: result }));
      await load();
    } catch (error) {
      setMessage((previous) => ({
        ...previous,
        [id]: { ok: false, message: error.message || "Connection test failed." },
      }));
    } finally {
      setBusy("");
    }
  }

  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h2>AI providers</h2>
          <p className="muted small">Keys stay on the backend. Add or rotate them in Render, never in browser code.</p>
        </div>
        <a
          className="btn-tertiary"
          href="https://dashboard.render.com/web/srv-dc125ud9fdbs739hk1sg"
          target="_blank"
          rel="noreferrer"
        >
          Open Render environment
        </a>
      </div>

      {providers.length === 0 ? (
        <p className="muted small">Loading AI provider configuration…</p>
      ) : (
        <div className="settings-provider-list">
          {providers.map((provider) => {
            const result = message[provider.id];
            return (
              <div className="settings-provider-row" key={provider.id}>
                <div className="settings-provider-copy">
                  <div className="row" style={{ gap: "0.5rem", alignItems: "center" }}>
                    <strong>{provider.name}</strong>
                    <Status
                      variant={provider.connected ? "active" : "neutral"}
                      label={provider.connected ? "Key configured" : "Key missing"}
                    />
                  </div>
                  <p className="muted small">{provider.purpose}</p>
                  <p className="muted small mono">{provider.env_var}</p>
                  {result && (
                    <p className={result.ok ? "notice small" : "error small"} role="status">
                      {result.message}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  className="btn small"
                  disabled={!provider.connected || busy === provider.id}
                  onClick={() => testProvider(provider.id)}
                >
                  {busy === provider.id ? "Testing…" : `Test ${provider.id === "gemini" ? "Gemini" : "Sarvam"}`}
                </button>
              </div>
            );
          })}
        </div>
      )}
      {message.load && <p className="error small">{message.load.message}</p>}
      <p className="muted small">After saving environment variables in Render, the service redeploys. Reload this page to refresh the status.</p>
    </section>
  );
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
      <div className="card-head">
        <h2>Google Calendar sync</h2>
        <Status variant={st.connected ? "active" : "neutral"} label={st.connected ? "Connected" : "Not connected"} />
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
  { label: "State Tech University (Main Campus)", college: "State Tech University", lat: "28.5459", lng: "77.2732" },
  { label: "City Engineering College (Central Campus)", college: "City Engineering College", lat: "28.5450", lng: "77.1926" },
  { label: "North Campus University", college: "North Campus University", lat: "28.7499", lng: "77.1170" },
  { label: "West Institute of Technology", college: "West Institute of Technology", lat: "28.6091", lng: "77.0351" },
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
        <Status variant={enabled ? "active" : "neutral"} label={enabled ? "Active" : "Off"} />
      </div>
      {!supported ? (
        <div className="notice small">
          <strong>Device push compatibility:</strong>
          <p className="muted" style={{ margin: "0.25rem 0 0.4rem" }}>
            This browser does not support background push alerts in its current mode.
          </p>
          <ul style={{ margin: 0, paddingLeft: "1.2rem", color: "var(--muted)" }}>
            <li><strong>Android:</strong> Open in Chrome or Edge, tap menu (⋮) and select <em>&quot;Install App&quot;</em> or <em>&quot;Add to Home screen&quot;</em>.</li>
            <li><strong>iOS:</strong> Open in Safari, tap Share (⎋), then select <em>&quot;Add to Home Screen&quot;</em> to enable Web Push.</li>
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

function PriorityTuningCard({ user, onSaved }) {
  const [mode, setMode] = useState(user.scoring_mode || "balanced");
  const [keepVal, setKeepVal] = useState(() => {
    if (user?.threshold_keep != null) return user.threshold_keep;
    const stored = localStorage.getItem("eventure_threshold_keep");
    return stored ? Number(stored) : 55;
  });
  const [skipVal, setSkipVal] = useState(() => {
    if (user?.threshold_skip != null) return user.threshold_skip;
    const stored = localStorage.getItem("eventure_threshold_skip");
    return stored ? Number(stored) : 40;
  });
  const [useMaybe, setUseMaybe] = useState(() => {
    if (user?.use_maybe_range != null) return Boolean(user.use_maybe_range);
    return localStorage.getItem("eventure_use_maybe_range") === "true";
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const thresholdSaveTimer = useRef(null);
  const pendingThresholds = useRef(null);

  useEffect(() => () => {
    if (thresholdSaveTimer.current) window.clearTimeout(thresholdSaveTimer.current);
  }, []);

  const presets = [
    {
      id: "balanced",
      title: "Balanced (Default)",
      desc: "Equalized student weighting across interests, deadlines, and travel ease.",
      weights: { "Interest Match": 40, "Deadline Urgency": 20, "Travel Proximity": 20, "Registered Status": 10, "Goal Match": 10 },
    },
    {
      id: "interest_first",
      title: "Interest-first",
      desc: "Deep focus on career alignment, AI/web tracks, and specific hackathon categories.",
      weights: { "Interest Match": 60, "Deadline Urgency": 15, "Travel Proximity": 10, "Registered Status": 10, "Goal Match": 5 },
    },
    {
      id: "deadline_first",
      title: "Deadline-first",
      desc: "Prioritizes immediate submission rounds, abstract deadlines, and urgent PPTs.",
      weights: { "Interest Match": 25, "Deadline Urgency": 40, "Travel Proximity": 15, "Registered Status": 10, "Goal Match": 10 },
    },
    {
      id: "nearby_first",
      title: "Nearby-first",
      desc: "Minimizes road travel time and maximizes local campus opportunities.",
      weights: { "Interest Match": 25, "Deadline Urgency": 15, "Travel Proximity": 40, "Registered Status": 10, "Goal Match": 10 },
    },
  ];

  const saveMode = async (m) => {
    if (saving) return;
    setMode(m);
    setSaving(true);
    setMsg("");
    setErr("");
    try {
      const res = await api.patch("/auth/me", { scoring_mode: m });
      if (onSaved) onSaved(res.user);
      setMsg(`Scoring profile updated to "${presets.find((p) => p.id === m)?.title}".`);
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  const persistThresholds = (newKeep, newSkip, newMaybe) => {
    // Apply locally immediately so the controls remain responsive, then sync
    // once the user pauses dragging instead of sending a request for every pixel.
    localStorage.setItem("eventure_threshold_keep", String(newKeep));
    localStorage.setItem("eventure_threshold_skip", String(newSkip));
    localStorage.setItem("eventure_use_maybe_range", newMaybe ? "true" : "false");
    window.dispatchEvent(new Event("eventure_threshold_change"));

    pendingThresholds.current = {
      threshold_keep: newKeep,
      threshold_skip: newSkip,
      use_maybe_range: newMaybe,
    };
    if (thresholdSaveTimer.current) window.clearTimeout(thresholdSaveTimer.current);

    setErr("");
    setSaving(true);
    setMsg("Saving your preferences…");
    thresholdSaveTimer.current = window.setTimeout(async () => {
      const payload = pendingThresholds.current;
      pendingThresholds.current = null;
      try {
        const result = await api.patch("/auth/me", payload);
        if (onSaved) onSaved(result.user);
        setMsg("Preferences saved to your account.");
      } catch (error) {
        setErr(
          `The selected value is active in this session, but could not be saved to your account: ${error.message}`
        );
        setMsg("");
      } finally {
        setSaving(false);
        thresholdSaveTimer.current = null;
      }
    }, 500);
  };

  const handleKeepChange = (val) => {
    const v = Math.max(0, Math.min(100, Number(val) || 0));
    setKeepVal(v);
    const effectiveSkip = useMaybe && v < skipVal ? v : skipVal;
    if (useMaybe && v < skipVal) setSkipVal(v);
    persistThresholds(v, effectiveSkip, useMaybe);
  };

  const handleSkipChange = (val) => {
    const v = Math.max(0, Math.min(100, Number(val) || 0));
    setSkipVal(v);
    const effectiveKeep = v > keepVal ? v : keepVal;
    if (v > keepVal) setKeepVal(v);
    persistThresholds(effectiveKeep, v, useMaybe);
  };

  const toggleMaybe = (e) => {
    const checked = e.target.checked;
    setUseMaybe(checked);
    persistThresholds(keepVal, skipVal, checked);
  };

  const resetDefault = () => {
    setKeepVal(55);
    setSkipVal(40);
    setUseMaybe(false);
    persistThresholds(55, 40, false);
  };

  // Dynamic preview evaluation against sample event scores
  const sampleScores = [88, 82, 75, 68, 62, 55, 48, 42, 35, 20];
  const keepCount = sampleScores.filter((s) => s >= keepVal).length;
  const skipCount = useMaybe
    ? sampleScores.filter((s) => s < skipVal).length
    : sampleScores.filter((s) => s < keepVal).length;
  const maybeCount = useMaybe
    ? sampleScores.filter((s) => s >= skipVal && s < keepVal).length
    : 0;

  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h2>Scoring Profiles</h2>
          <p className="muted small">Customize how Eventure ranks and scores hackathons on your timeline (0–100).</p>
        </div>
        <Status variant="active" label={`Active: ${presets.find((p) => p.id === mode)?.title || "Balanced"}`} />
      </div>

      <div className="profile-scoring-grid">
        {presets.map((p) => {
          const isSelected = mode === p.id;
          return (
            <div
              key={p.id}
              className={`profile-scoring-card ${isSelected ? "selected" : ""}`}
              role="button"
              tabIndex={0}
              aria-pressed={isSelected}
              aria-disabled={saving}
              onClick={() => saveMode(p.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  saveMode(p.id);
                }
              }}
            >
              <div className="profile-card-header">
                <span className="custom-radio">
                  {isSelected && <span className="custom-radio-dot" />}
                </span>
                <span className="profile-card-title">{p.title}</span>
              </div>
              <p className="profile-card-desc">{p.desc}</p>
              <div className="profile-points-list">
                {Object.entries(p.weights).map(([k, w]) => (
                  <div key={k} className="profile-point-row">
                    <span className="profile-point-label">{k}</span>
                    <span className="profile-point-value">{w} pts</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Part E: Keep / Skip Decision Threshold Feature */}
      <div className="threshold-container">
        <div className="threshold-header-row">
          <div>
            <h3 className="threshold-title">Keep / Skip Decision Threshold</h3>
            <p className="threshold-subtext">
              Events scoring at or above this are marked <b>Keep</b>, below are marked <b>Skip</b>.
            </p>
          </div>
          <button type="button" className="btn-tertiary" onClick={resetDefault}>
            Reset to default (55)
          </button>
        </div>

        <div className="threshold-slider-group">
          <input
            type="range"
            min="0"
            max="100"
            step="1"
            value={keepVal}
            onChange={(e) => handleKeepChange(e.target.value)}
            className="threshold-slider"
            aria-label="Keep threshold score"
          />
          <input
            type="number"
            min="0"
            max="100"
            value={keepVal}
            onChange={(e) => handleKeepChange(e.target.value)}
            className="threshold-number-input"
            aria-label="Keep threshold value"
          />
        </div>

        <div className="threshold-presets-row">
          <span className="small muted">Quick presets:</span>
          {[
            { label: "Relaxed 45", val: 45 },
            { label: "Default 55", val: 55 },
            { label: "Strict 65", val: 65 },
          ].map((pr) => (
            <button
              key={pr.val}
              type="button"
              className={`threshold-preset-btn ${keepVal === pr.val ? "active" : ""}`}
              onClick={() => handleKeepChange(pr.val)}
            >
              {pr.label}
            </button>
          ))}
        </div>

        {/* Optional Advanced "Use a Maybe range" Toggle */}
        <div style={{ marginTop: "1rem", paddingTop: "0.85rem", borderTop: "1px solid var(--border)" }}>
          <label style={{ display: "inline-flex", flexDirection: "row", alignItems: "center", gap: "0.5rem", cursor: "pointer", marginBottom: "0.5rem" }}>
            <input
              type="checkbox"
              checked={useMaybe}
              onChange={toggleMaybe}
              style={{ width: "16px", height: "16px", cursor: "pointer", margin: 0 }}
            />
            <span style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--text)" }}>
              Use a Maybe range
            </span>
          </label>

          {useMaybe && (
            <div style={{ marginTop: "0.5rem", padding: "0.75rem", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)" }}>
              <p className="muted small" style={{ marginBottom: "0.6rem" }}>
                Skip below <b>{skipVal}</b>, Keep at or above <b>{keepVal}</b>, Maybe in between ({skipVal}–{keepVal - 1}).
              </p>
              <div className="threshold-slider-group">
                <span className="small muted" style={{ minWidth: "80px" }}>Skip below:</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={skipVal}
                  onChange={(e) => handleSkipChange(e.target.value)}
                  className="threshold-slider"
                  aria-label="Skip threshold score"
                />
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={skipVal}
                  onChange={(e) => handleSkipChange(e.target.value)}
                  className="threshold-number-input"
                  aria-label="Skip threshold value"
                />
              </div>
            </div>
          )}

          <div className="threshold-preview-line">
            <span>With this setting:</span>
            <span style={{ color: "var(--accent)", fontWeight: 600 }}>{keepCount} Keep</span>
            {useMaybe && <span style={{ color: "var(--text-secondary)", fontWeight: 500 }}>{maybeCount} Maybe</span>}
            <span style={{ color: "var(--text-muted)", fontWeight: 500 }}>{skipCount} Skip</span>
            {msg && <span style={{ color: "var(--accent)", marginLeft: "auto", fontSize: "0.8125rem" }}>{msg}</span>}
          </div>
        </div>
      </div>

      {err && <p className="error small" style={{ marginTop: "1rem" }}>{err}</p>}
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
              <Status variant={p.auto_sync ? "active" : "neutral"} label={p.auto_sync ? "Auto-Sync Active" : "Paused"} />
            </div>
            <div className="portal-card-body">
              <div><code>{p.domain_or_name}</code></div>
              <div className="small muted">Email: {p.registered_email || "Account default"}</div>
              {p.last_synced_at && <div className="small muted">Checked: {p.last_synced_at.replace("T", " ").slice(0, 16)}</div>}
            </div>
            <div className="portal-card-actions">
              <button type="button" className="btn-tertiary" disabled={busy} onClick={() => sync(p.id, p.name)}>
                Sync deadlines
              </button>
              <button type="button" className="btn-tertiary" onClick={() => toggle(p.id, p.auto_sync)}>
                {p.auto_sync ? "Pause" : "Enable"}
              </button>
              <button type="button" className="btn-tertiary danger" onClick={() => remove(p.id)}>
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

const INDIC_LANGUAGES = [
  { code: "en", label: "English" },
  { code: "hi-IN", label: "Hindi (हिन्दी)" },
  { code: "bn-IN", label: "Bengali (বাংলা)" },
  { code: "ta-IN", label: "Tamil (தமிழ்)" },
  { code: "te-IN", label: "Telugu (తెలుగు)" },
  { code: "mr-IN", label: "Marathi (मराठी)" },
  { code: "gu-IN", label: "Gujarati (ગુજરાતી)" },
  { code: "kn-IN", label: "Kannada (ಕನ್ನಡ)" },
  { code: "ml-IN", label: "Malayalam (മലയാളം)" },
  { code: "pa-IN", label: "Punjabi (ਪੰਜਾਬੀ)" },
  { code: "od-IN", label: "Odia (ଓଡ଼ିଆ)" },
];

export default function Settings() {
  const { user, refresh } = useAuth();
  const [p, setP] = useState({
    name: user.name,
    college: user.college || "",
    college_lat: user.college_lat ?? "",
    college_lng: user.college_lng ?? "",
    goals: user.goals.join(", "),
    primary_language: user.primary_language || "en",
    role: user.role || "student",
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
      await api.put("/auth/me", {
        ...p,
        college_lat: p.college_lat === "" ? null : p.college_lat,
        college_lng: p.college_lng === "" ? null : p.college_lng,
      });
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

        <label>College / Institution Name<input value={p.college} onChange={(e) => setP({ ...p, college: e.target.value })} placeholder="e.g. State Tech University, City College" /></label>
        
        <div style={{ margin: "0.4rem 0 0.8rem", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
          <div>
            {p.college_lat && p.college_lng ? (
              <span className="small ok" style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
                <MapPin size={13} strokeWidth={1.75} /> Campus pinned for commute estimates ({p.college_lat}, {p.college_lng})
              </span>
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

        <label>
          Base Primary Language (Auto-Translates Posters, Portal Matches & Event Details)
          <select
            value={p.primary_language}
            onChange={(e) => setP({ ...p, primary_language: e.target.value })}
          >
            {INDIC_LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>{l.label}</option>
            ))}
          </select>
        </label>

        <label>
          Account Role
          <select
            value={p.role}
            onChange={(e) => setP({ ...p, role: e.target.value })}
          >
            <option value="student">Student (Track milestones & hackathons)</option>
            <option value="organizer">Organizer (Host & manage club events)</option>
          </select>
        </label>

        <div className="row">
          <button className="btn small">Save</button>
          {msg && <span className="muted small">{msg}</span>}
        </div>
      </form>

      <PriorityTuningCard user={user} onSaved={refresh} />

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
      <AIProvidersCard />
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
