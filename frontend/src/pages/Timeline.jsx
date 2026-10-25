import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth.jsx";
import IssueCard from "../components/IssueCard.jsx";
import { cap, fmtDate, fmtMinutes, fmtRange, timeLeft } from "../utils";

const STATUSES = ["interested", "registered", "attended", "skipped"];

function AddStage({ onAdd }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [due, setDue] = useState("");
  if (!open) return <button className="linklike small" onClick={() => setOpen(true)}>+ Add stage</button>;
  return (
    <form
      className="row small"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        onAdd(name.trim(), due || null);
        setName("");
        setDue("");
        setOpen(false);
      }}
    >
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Stage, e.g. Submit" aria-label="Stage name" />
      <input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} aria-label="Stage deadline" />
      <button className="btn small">Add</button>
    </form>
  );
}

function Node({ it, act }) {
  const ev = it.event;
  return (
    <li className={`node risk-${it.risk || "none"} ${it.status === "skipped" ? "is-skipped" : ""}`}>
      <article className="card">
        <div className="card-head">
          <div>
            <h3><Link to={`/events/${ev.id}`}>{ev.title}</Link></h3>
            <p className="muted">
              {fmtRange(ev.start_at, ev.end_at)}
              {ev.venue_name ? ` · ${ev.venue_name}` : ""}
            </p>
          </div>
          <div className="pills">
            {ev.platform && <span className="pill">{ev.platform}</span>}
            {ev.category && <span className="pill alt">{cap(ev.category)}</span>}
            {it.score != null && <span className="pill score" title="How well this fits your goals, deadlines and travel">Priority {it.score}</span>}
          </div>
        </div>
        {it.travel_minutes ? <p className="small muted">About {fmtMinutes(it.travel_minutes)} from your college</p> : null}
        {it.stages.length > 0 && (
          <ul className="stages">
            {it.stages.map((s) => (
              <li key={s.id} className={s.done ? "done" : ""}>
                <label>
                  <input type="checkbox" checked={s.done} onChange={(e) => act(() => api.patch(`/stages/${s.id}`, { done: e.target.checked }))} />
                  <span>{s.name}</span>
                </label>
                <span className="muted small">
                  {s.due_at ? fmtDate(s.due_at) : "No deadline"}
                  {s.due_at && !s.done ? ` · ${timeLeft(s.due_at)}` : ""}
                </span>
                <button className="linklike small" aria-label={`Remove ${s.name}`} onClick={() => act(() => api.del(`/stages/${s.id}`))}>Remove</button>
              </li>
            ))}
          </ul>
        )}
        <div className="card-foot">
          <AddStage onAdd={(name, due) => act(() => api.post(`/user-events/${it.id}/stages`, { name, due_at: due }))} />
          <div className="row">
            <select value={it.status} onChange={(e) => act(() => api.patch(`/user-events/${it.id}`, { status: e.target.value }))} aria-label="Status">
              {STATUSES.map((s) => <option key={s} value={s}>{cap(s)}</option>)}
            </select>
            <button className="linklike small" onClick={() => window.confirm(`Remove ${ev.title} from your timeline?`) && act(() => api.del(`/user-events/${it.id}`))}>Remove</button>
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

  if (!data) return error ? <p className="error">{error}</p> : <p className="muted">Loading your timeline...</p>;

  const key = (i) => `${i.type}:${i.events.join("-")}`;
  const issues = data.issues.filter((i) => !dismissed.includes(key(i)));
  const live = data.items.filter((i) => !i.past && i.status !== "skipped");
  const past = data.items.filter((i) => i.past);
  const skipped = data.items.filter((i) => !i.past && i.status === "skipped");
  const week = live.filter((i) => i.next_deadline && (new Date(i.next_deadline.due_at) - new Date()) / 864e5 <= 7).length;

  return (
    <>
      <div className="page-head">
        <h1>My timeline</h1>
        <Link to="/add" className="btn">Add an event</Link>
      </div>
      {error && <p className="error">{error}</p>}
      {user.college_lat == null && (
        <p className="notice">Set your college location in <Link to="/settings">Settings</Link> to see distances and travel checks.</p>
      )}

      <div className="summary">
        <div><b>{live.length}</b><span>coming up</span></div>
        <div><b>{week}</b><span>deadlines this week</span></div>
        <div className={issues.length ? "hot" : ""}><b>{issues.length}</b><span>need a decision</span></div>
      </div>

      {issues.length > 0 && (
        <section aria-label="Decisions needed">
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

      <section aria-label="Coming up">
        <h2>Coming up</h2>
        {live.length === 0 ? (
          <div className="card empty">
            <p>Nothing on your timeline yet.</p>
            <p><Link to="/add">Add an event from a poster or email</Link> or <Link to="/discover">find one near you</Link>.</p>
          </div>
        ) : (
          <ol className="thread">{live.map((it) => <Node key={it.id} it={it} act={act} />)}</ol>
        )}
      </section>

      {past.length > 0 && (
        <section aria-label="Past events">
          <h2>Past events</h2>
          <ol className="thread muted-thread">{past.map((it) => <Node key={it.id} it={it} act={act} />)}</ol>
        </section>
      )}

      {skipped.length > 0 && (
        <section aria-label="Skipped events">
          <button className="linklike" onClick={() => setShowSkipped(!showSkipped)}>
            {showSkipped ? "Hide" : "Show"} {skipped.length} skipped
          </button>
          {showSkipped && <ol className="thread muted-thread">{skipped.map((it) => <Node key={it.id} it={it} act={act} />)}</ol>}
        </section>
      )}
    </>
  );
}
