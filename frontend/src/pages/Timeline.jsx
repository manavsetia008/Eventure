import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Calendar, CalendarPlus, ChevronDown, ChevronUp, ExternalLink, Plus, Star, Trash2 } from "lucide-react";
import { api } from "../api";
import IssueCard from "../components/IssueCard.jsx";
import HackathonVault from "../components/HackathonVault.jsx";
import PriorityEditor from "../components/PriorityEditor.jsx";
import Chip from "../components/Chip.jsx";
import Badge from "../components/Badge.jsx";
import Checkbox from "../components/Checkbox.jsx";
import ConfirmDialog from "../components/ConfirmDialog.jsx";
import { cap, fmtDate, fmtDuration, fmtRange, getGoogleCalendarUrl, getMicrosoftCalendarUrl, timeLeft } from "../utils";

const STATUSES = ["interested", "registered", "attended", "skipped"];

function AddStage({ onAdd }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [due, setDue] = useState("");

  if (!open) {
    return (
      <button type="button" className="btn-tertiary add-stage-link" onClick={() => setOpen(true)}>
        <Plus size={13} /> Add stage
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
  const [expanded, setExpanded] = useState(false);
  const [editingUrl, setEditingUrl] = useState(false);
  const [urlVal, setUrlVal] = useState(ev.url || "");
  const [confirmRemove, setConfirmRemove] = useState(false);

  const fullUrl = ev.url ? (ev.url.startsWith("http") ? ev.url : `https://${ev.url}`) : "";

  const statusVariant =
    it.status === "registered"
      ? "success"
      : it.status === "attended"
      ? "info"
      : "neutral";

  const doneStages = it.stages.filter((s) => s.done).length;

  return (
    <li className={`timeline-item ${it.status === "skipped" ? "is-skipped" : ""}`}>
      {/* Clickable row header; details stay collapsed by default */}
      <div
        className="timeline-row-head"
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onClick={() => setExpanded(!expanded)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setExpanded(!expanded);
          }
        }}
      >
        <div className="timeline-row-main">
          <h3 className="timeline-row-title">
            <Link
              to={`/events/${ev.id}`}
              className="event-title-link"
              onClick={(e) => e.stopPropagation()}
            >
              {ev.title}
            </Link>
          </h3>
          <p className="timeline-row-meta">
            {fmtRange(ev.start_at, ev.end_at)}
            {ev.venue_name ? ` · ${ev.venue_name}` : ""}
          </p>
        </div>
        <div className="timeline-row-aside">
          {ev.platform && <Chip label={ev.platform} />}
          {ev.category && <Chip label={cap(ev.category)} />}
          <Badge variant={statusVariant} label={cap(it.status)} />
          {it.score >= 99 && (
            <span className="pill ok" style={{ fontSize: "0.7rem", display: "inline-flex", alignItems: "center", gap: "3px" }}>
              <Star size={11} fill="gold" color="gold" /> Top Priority
            </span>
          )}
          {it.score != null && (
            <span role="presentation" onClick={(e) => e.stopPropagation()}>
              <PriorityEditor
                value={it.score}
                scoreParts={it.score_parts}
                onChange={(newScore) =>
                  act(() => api.patch(`/user-events/${it.id}`, { score: newScore }))
                }
              />
            </span>
          )}
          <span className="timeline-row-toggle">
            {it.stages.length > 0 && (
              <span className="small muted">{doneStages}/{it.stages.length}</span>
            )}
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </span>
        </div>
      </div>

      {expanded && (
        <div className="timeline-details">
          {/* Official event link and calendar actions */}
          <div className="timeline-link-row">
            <a
              href={getGoogleCalendarUrl(ev)}
              target="_blank"
              rel="noreferrer"
              className="btn-tertiary"
              title="Add to Google Calendar"
            >
              <Calendar size={12} /> Google Cal
            </a>
            <a
              href={getMicrosoftCalendarUrl(ev)}
              target="_blank"
              rel="noreferrer"
              className="btn-tertiary"
              title="Add to Microsoft Outlook"
            >
              <CalendarPlus size={12} /> Outlook
            </a>
            {fullUrl && !editingUrl ? (
              <>
                <a href={fullUrl} target="_blank" rel="noreferrer" className="btn-tertiary">
                  Open page <ExternalLink size={12} />
                </a>
                <button
                  type="button"
                  className="btn-tertiary"
                  onClick={() => { setUrlVal(ev.url || ""); setEditingUrl(true); }}
                >
                  Edit link
                </button>
              </>
            ) : !editingUrl ? (
              <button
                type="button"
                className="btn-tertiary"
                onClick={() => { setUrlVal(""); setEditingUrl(true); }}
              >
                + Add official link
              </button>
            ) : (
              <div className="row small timeline-url-form">
                <input
                  type="url"
                  value={urlVal}
                  onChange={(e) => setUrlVal(e.target.value)}
                  placeholder="Paste official event URL (https://...)"
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
            <ul className="timeline-stages-list">
              {it.stages.map((s) => (
                <li key={s.id} className={`timeline-stage-item ${s.done ? "done" : ""}`}>
                  <div className="timeline-stage-left">
                    <Checkbox
                      checked={s.done}
                      onChange={(checked) => act(() => api.patch(`/stages/${s.id}`, { done: checked }))}
                      aria-label={`Mark ${s.name} done`}
                    />
                    <span className="timeline-stage-name">{s.name}</span>
                  </div>
                  <div className="timeline-stage-right">
                    <span className="timeline-stage-due">
                      {s.due_at ? fmtDate(s.due_at) : "No deadline"}
                      {s.due_at && !s.done ? ` · ${timeLeft(s.due_at)}` : ""}
                    </span>
                    <button
                      type="button"
                      className="timeline-stage-remove"
                      aria-label={`Remove ${s.name}`}
                      title="Remove stage"
                      onClick={() => act(() => api.del(`/stages/${s.id}`))}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {ev.category === "hackathon" && (
            <HackathonVault
              userEventId={it.id}
              initialNotes={it.notes || ""}
              onUpdate={() => act(async () => {})}
            />
          )}

          <div className="timeline-foot">
            <AddStage onAdd={(name, due) => act(() => api.post(`/user-events/${it.id}/stages`, { name, due_at: due }))} />
            <div className="row status-actions">
              <select
                value={it.status}
                onChange={(e) => act(() => api.patch(`/user-events/${it.id}`, { status: e.target.value }))}
                aria-label="Status"
                className="clean-select"
              >
                {STATUSES.map((s) => <option key={s} value={s}>{cap(s)}</option>)}
              </select>
              <button
                type="button"
                className="btn-tertiary danger"
                onClick={() => setConfirmRemove(true)}
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmRemove}
        title="Remove from timeline"
        message={`Remove ${ev.title} from your timeline?`}
        confirmLabel="Remove"
        onCancel={() => setConfirmRemove(false)}
        onConfirm={() => {
          setConfirmRemove(false);
          act(() => api.del(`/user-events/${it.id}`));
        }}
      />
    </li>
  );
}

export default function Timeline() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [dismissed, setDismissed] = useState([]);
  const [showSkipped, setShowSkipped] = useState(false);
  const [lang, setLang] = useState(() => localStorage.getItem("eventure_lang") || "en");

  useEffect(() => {
    const handler = (e) => setLang(e.detail);
    window.addEventListener("eventure_lang_change", handler);
    return () => window.removeEventListener("eventure_lang_change", handler);
  }, []);

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

  if (!data)
    return error ? (
      <p className="error">{error}</p>
    ) : (
      <div className="timeline-skeleton" aria-hidden="true">
        <div className="skeleton skeleton-stats" />
        <div className="skeleton skeleton-row" />
        <div className="skeleton skeleton-row" />
        <div className="skeleton skeleton-row" />
      </div>
    );

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
          <Link to="/add" className="btn">Add event</Link>
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      {/* Top Stats Row: 3 stats in one line, 24px/600 number, label beneath, 1px divider */}
      <div className="timeline-stats-row">
        <div className="timeline-stat-col">
          <span className="timeline-stat-val">{live.length}</span>
          <span className="timeline-stat-lbl">{lang === "hi" ? "आगामी कार्यक्रम" : "Upcoming events"}</span>
        </div>
        <div className="timeline-stat-div" />
        <div className="timeline-stat-col">
          <span className="timeline-stat-val">{week}</span>
          <span className="timeline-stat-lbl">{lang === "hi" ? "इस सप्ताह की समय-सीमा" : "Deadlines this week"}</span>
        </div>
        <div className="timeline-stat-div" />
        <div className={`timeline-stat-col ${issues.length ? "hot" : ""}`}>
          <span className="timeline-stat-val">{issues.length}</span>
          <span className="timeline-stat-lbl">{lang === "hi" ? "शेड्यूल टकराव" : "Clashes to resolve"}</span>
        </div>
      </div>

      {issues.length > 0 && (
        <section aria-label="Schedule conflicts" className="timeline-section">
          <h2>Clashes to resolve</h2>
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

      <section aria-label="Upcoming" className="timeline-section">
        <h2>Upcoming</h2>
        {live.length === 0 ? (
          <div className="card empty">
            <CalendarPlus size={22} strokeWidth={1.75} />
            <p>No events yet</p>
            <p className="muted small">Add an event from a poster or email, or discover events near your campus.</p>
            <Link to="/add" className="btn small">Add your first event</Link>
          </div>
        ) : (
          <ol className="list-panel timeline-panel">{live.map((it) => <Node key={it.id} it={it} act={act} />)}</ol>
        )}
      </section>

      {past.length > 0 && (
        <section aria-label="Past events" className="timeline-section">
          <h2>Past events</h2>
          <ol className="list-panel timeline-panel muted-thread">{past.map((it) => <Node key={it.id} it={it} act={act} />)}</ol>
        </section>
      )}

      {skipped.length > 0 && (
        <section aria-label="Skipped events" className="timeline-section">
          <button className="linklike small" onClick={() => setShowSkipped(!showSkipped)}>
            {showSkipped ? "Hide" : "Show"} {skipped.length} skipped event{skipped.length > 1 ? "s" : ""}
          </button>
          {showSkipped && (
            <ol className="list-panel timeline-panel muted-thread">{skipped.map((it) => <Node key={it.id} it={it} act={act} />)}</ol>
          )}
        </section>
      )}
    </>
  );
}
