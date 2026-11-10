import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth.jsx";
import IssueCard from "../components/IssueCard.jsx";
import HackathonVault from "../components/HackathonVault.jsx";
import { cap, fmtDate, fmtDuration, fmtRange, timeLeft } from "../utils";

const STATUSES = ["interested", "registered", "attended", "skipped"];

function AddStage({ onAdd }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [due, setDue] = useState("");

  if (!open) {
    return (
      <button type="button" className="linklike small add-stage-link" onClick={() => setOpen(true)}>
        + Add stage
      </button>
    );
  }

  return (
    <form
      className="row small add-stage-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        onAdd(name.trim(), due || null);
        setName("");
        setDue("");
        setOpen(false);
      }}
    >
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Stage (e.g. Submit PPT)" aria-label="Stage name" />
      <input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} aria-label="Stage deadline" />
      <button className="btn small">Add</button>
      <button type="button" className="btn ghost small" onClick={() => setOpen(false)}>Cancel</button>
    </form>
  );
}

function Node({ it, act }) {
  const ev = it.event;
  const [editingUrl, setEditingUrl] = useState(false);
  const [urlVal, setUrlVal] = useState(ev.url || "");

  const fullUrl = ev.url ? (ev.url.startsWith("http") ? ev.url : `https://${ev.url}`) : "";

  return (
    <li className={`node risk-${it.risk || "none"} ${it.status === "skipped" ? "is-skipped" : ""}`}>
      <article className="card">
        <div className="card-head">
          <div>
            <h3><Link to={`/events/${ev.id}`}>{ev.title}</Link></h3>
            <p className="muted small">
              {fmtRange(ev.start_at, ev.end_at)}
              {ev.venue_name ? ` · ${ev.venue_name}` : ""}
            </p>
          </div>
          <div className="pills">
            {ev.platform && <span className="pill">{ev.platform}</span>}
            {ev.category && <span className="pill alt">{cap(ev.category)}</span>}
            {it.score != null && (
              <span className="pill score" title="Goal fit, deadline urgency and ease of travel">
                Priority {it.score}
              </span>
            )}
          </div>
        </div>

        {/* Direct official link to hackathon / event */}
        <div style={{ margin: "0.4rem 0 0.6rem", display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
          {fullUrl && !editingUrl ? (
            <>
              <a
                href={fullUrl}
                target="_blank"
                rel="noreferrer"
                className="btn small"
                style={{ padding: "0.22rem 0.65rem", fontSize: "0.8rem", textDecoration: "none" }}
              >
                Go to Hackathon Page ↗
              </a>
              <button
                type="button"
                className="linklike small muted"
                onClick={() => { setUrlVal(ev.url || ""); setEditingUrl(true); }}
              >
                Edit link
              </button>
            </>
          ) : !editingUrl ? (
            <button
              type="button"
              className="linklike small"
              onClick={() => { setUrlVal(""); setEditingUrl(true); }}
            >
              + Add official hackathon link
            </button>
          ) : (
            <div className="row small" style={{ width: "100%", margin: "0.2rem 0" }}>
              <input
                type="url"
                value={urlVal}
                onChange={(e) => setUrlVal(e.target.value)}
                placeholder="Paste official event URL (https://...)"
                style={{ maxWidth: "320px", padding: "0.3rem 0.5rem" }}
                aria-label="Official event URL"
              />
              <button
                type="button"
                className="btn small"
                onClick={() => {
                  act(() => api.put(`/events/${ev.id}`, { url: urlVal.trim() }));
                  setEditingUrl(false);
                }}
              >
                Save
              </button>
              <button
                type="button"
                className="btn ghost small"
                onClick={() => setEditingUrl(false)}
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        {it.travel_minutes ? (
          <p className="small muted travel-note">About {fmtDuration(it.travel_minutes)} from your campus</p>
        ) : null}

        {it.stages.length > 0 && (
          <ul className="stages">
            {it.stages.map((s) => (
              <li key={s.id} className={s.done ? "done" : ""}>
                <label className="stage-label">
                  <input
                    type="checkbox"
                    checked={s.done}
                    onChange={(e) => act(() => api.patch(`/stages/${s.id}`, { done: e.target.checked }))}
                  />
                  <span>{s.name}</span>
                </label>
                <span className="muted small stage-due">
                  {s.due_at ? fmtDate(s.due_at) : "No deadline"}
                  {s.due_at && !s.done ? ` · ${timeLeft(s.due_at)}` : ""}
                </span>
                <button
                  className="linklike small remove-stage"
                  aria-label={`Remove ${s.name}`}
                  onClick={() => act(() => api.del(`/stages/${s.id}`))}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}

        <HackathonVault
          userEventId={it.id}
          initialNotes={it.notes || ""}
          onUpdate={() => load()}
        />

        <div className="card-foot">
          <AddStage onAdd={(name, due) => act(() => api.post(`/user-events/${it.id}/stages`, { name, due_at: due }))} />
          <div className="row status-actions">
            <select
              value={it.status}
              onChange={(e) => act(() => api.patch(`/user-events/${it.id}`, { status: e.target.value }))}
              aria-label="Status"
              className="status-select"
            >
              {STATUSES.map((s) => <option key={s} value={s}>{cap(s)}</option>)}
            </select>
            <button
              className="linklike small"
              onClick={() =>
                window.confirm(`Remove ${ev.title} from your timeline?`) &&
                act(() => api.del(`/user-events/${it.id}`))
              }
            >
              Remove
            </button>
          </div>
        </div>
      </article>
    </li>
  );
}

export default function Timeline() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [dismissed, setDismissed] = useState([]);
  const [showSkipped, setShowSkipped] = useState(false);
  const [lang, setLang] = useState("en");

  const load = useCallback(() => api.get("/timeline").then(setData).catch((e) => setError(e.message)), []);
  useEffect(() => { load(); }, [load]);

  const act = async (fn) => {
    setError("");
    try {
      await fn();
      await load();
    } catch (e) {
      setError(e.message);
    }
  };

  if (!data) return error ? <p className="error">{error}</p> : <p className="muted center">Loading your timeline...</p>;

  const key = (i) => `${i.type}:${i.events.join("-")}`;
  const issues = data.issues.filter((i) => !dismissed.includes(key(i)));
  const live = data.items.filter((i) => !i.past && i.status !== "skipped");
  const past = data.items.filter((i) => i.past);
  const skipped = data.items.filter((i) => !i.past && i.status === "skipped");
  const week = live.filter(
    (i) => i.next_deadline && (new Date(i.next_deadline.due_at) - new Date()) / 864e5 <= 7
  ).length;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{lang === "hi" ? "मेरी टाइमलाइन (Timeline)" : "My timeline"}</h1>
          <p className="muted small">
            {lang === "hi"
              ? "सभी चरण, समय-सीमा और शेड्यूल टकराव एक जगह ट्रैक करें।"
              : "Track stages, deadlines, and schedule conflicts in one place."}
          </p>
        </div>
        <div className="row">
          <div className="lang-picker">
            <span className="small muted">Language:</span>
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value)}
              className="lang-select"
              aria-label="Language selection"
            >
              <option value="en">English</option>
              <option value="hi">हिन्दी (Hindi)</option>
              <option value="bn">বাংলা (Bengali)</option>
              <option value="ta">தமிழ் (Tamil)</option>
            </select>
          </div>
          <Link to="/add" className="btn">Add event</Link>
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      {user.college_lat == null && (
        <p className="notice">
          Set your campus location in <Link to="/settings">Settings</Link> to calculate travel gaps and transit checks.
        </p>
      )}

      <div className="summary">
        <div>
          <b>{live.length}</b>
          <span>{lang === "hi" ? "आगामी कार्यक्रम" : "upcoming events"}</span>
        </div>
        <div>
          <b>{week}</b>
          <span>{lang === "hi" ? "इस सप्ताह की समय-सीमा" : "deadlines this week"}</span>
        </div>
        <div className={issues.length ? "hot" : ""}>
          <b>{issues.length}</b>
          <span>{lang === "hi" ? "निर्णय आवश्यक" : "decisions needed"}</span>
        </div>
      </div>

      {issues.length > 0 && (
        <section aria-label="Decisions needed" className="timeline-section">
          <h2>Needs a decision</h2>
          {issues.map((issue) => (
            <IssueCard
              key={key(issue)}
              issue={issue}
              onSkip={(ueId) => act(() => api.patch(`/user-events/${ueId}`, { status: "skipped" }))}
              onDismiss={() => setDismissed([...dismissed, key(issue)])}
            />
          ))}
        </section>
      )}

      <section aria-label="Coming up" className="timeline-section">
        <h2>Coming up</h2>
        {live.length === 0 ? (
          <div className="card empty">
            <p>Nothing on your timeline yet.</p>
            <p><Link to="/add">Add an event from a poster or email</Link> or <Link to="/discover">discover events near your campus</Link>.</p>
          </div>
        ) : (
          <ol className="thread">{live.map((it) => <Node key={it.id} it={it} act={act} />)}</ol>
        )}
      </section>

      {past.length > 0 && (
        <section aria-label="Past events" className="timeline-section">
          <h2>Past events</h2>
          <ol className="thread muted-thread">{past.map((it) => <Node key={it.id} it={it} act={act} />)}</ol>
        </section>
      )}

      {skipped.length > 0 && (
        <section aria-label="Skipped events" className="timeline-section">
          <button className="linklike small" onClick={() => setShowSkipped(!showSkipped)}>
            {showSkipped ? "Hide" : "Show"} {skipped.length} skipped event{skipped.length > 1 ? "s" : ""}
          </button>
          {showSkipped && (
            <ol className="thread muted-thread">{skipped.map((it) => <Node key={it.id} it={it} act={act} />)}</ol>
          )}
        </section>
      )}
    </>
  );
}
