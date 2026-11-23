import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ClipboardList, MoreHorizontal } from "lucide-react";
import { api } from "../api";
import Badge from "../components/Badge.jsx";
import DoodleHeading from "../components/ui/DoodleHeading.jsx";
import { fmtRange } from "../utils";

function ShareBox({ id }) {
  const link = `${window.location.origin}/events/${id}`;
  const snippet = `<a href="${link}" target="_blank" rel="noopener">Add to Eventure</a>`;
  const [copied, setCopied] = useState("");
  const copy = (text, which) => navigator.clipboard.writeText(text).then(() => setCopied(which));

  return (
    <div className="share-box">
      <label className="small" htmlFor={`share-link-${id}`}>Direct link</label>
      <div className="row">
        <input id={`share-link-${id}`} readOnly value={link} onFocus={(e) => e.target.select()} aria-label="Event link" />
        <button className="btn ghost small" onClick={() => copy(link, "link")}>
          {copied === "link" ? "Copied" : "Copy link"}
        </button>
      </div>
      <label className="small organizer-share-label" htmlFor={`share-embed-${id}`}>Embed button code</label>
      <div className="row">
        <input id={`share-embed-${id}`} readOnly className="mono" value={snippet} onFocus={(e) => e.target.select()} aria-label="Add to Eventure button code" />
        <button className="btn ghost small" onClick={() => copy(snippet, "html")}>
          {copied === "html" ? "Copied" : "Copy code"}
        </button>
      </div>
      <p className="muted small organizer-share-hint">
        Embed this button on your registration page so students can add your event to their timeline in one click.
      </p>
    </div>
  );
}

export default function Organizer() {
  const [events, setEvents] = useState(null);
  const [error, setError] = useState("");
  const [openShare, setOpenShare] = useState(null);

  const load = useCallback(() => api.get("/organizer/events").then((r) => setEvents(r.events)).catch((e) => setError(e.message)), []);
  useEffect(() => { load(); }, [load]);

  async function toggle(ev) {
    setError("");
    try {
      await api.post(`/organizer/events/${ev.id}/visibility`, { is_public: !ev.is_public });
      await load();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <DoodleHeading text="Organizer" mascot="bird" />
          <p className="muted small">
            Events you listed, with turnout metrics, ratings, and timeline tracking.
          </p>
        </div>
        <Link to="/add" className="btn">Create event</Link>
      </div>

      {error && <p className="error">{error}</p>}

      {!events ? (
        <div className="page-loading-state">Loading your listed events...</div>
      ) : events.length === 0 ? (
        <div className="card empty">
          <ClipboardList size={22} strokeWidth={1.75} />
          <p>You have not listed any events yet.</p>
          <p className="muted small">List an event so peers can discover and track it.</p>
        </div>
      ) : (
        <div className="list-panel">
          {events.map((ev) => (
            <div className="list-row organizer-row" key={ev.id}>
              <div className="list-row-main">
                <div className="list-row-title">
                  <Link to={`/events/${ev.id}`}>{ev.title}</Link>
                </div>
                <div className="list-row-sub muted small">
                  {fmtRange(ev.start_at, ev.end_at)}
                  {ev.venue_name ? ` · ${ev.venue_name}` : ""}
                </div>
                <div className="organizer-metrics">
                  <span><b>{ev.counts.interested}</b> interested</span>
                  <span><b>{ev.counts.registered}</b> registered</span>
                  <span><b>{ev.counts.attended}</b> attended</span>
                  <span>
                    <b>{ev.rating.avg ?? "-"}</b> {ev.rating.count ? `rating (${ev.rating.count})` : "no reviews"}
                  </span>
                </div>
              </div>
              <div className="list-row-actions">
                <Badge variant={ev.is_public ? "success" : "neutral"}>{ev.is_public ? "Public" : "Private"}</Badge>
                {!ev.upcoming && <Badge variant="neutral">Past</Badge>}
                <Link to={`/events/${ev.id}/edit`} className="btn tertiary small">
                  Edit details
                </Link>
                <details className="menu">
                  <summary className="menu-trigger" aria-label="More actions">
                    <MoreHorizontal size={18} strokeWidth={1.75} />
                  </summary>
                  <div className="menu-list">
                    <button className="dropdown-menu-item" onClick={() => toggle(ev)}>
                      {ev.is_public ? "Make private" : "Make public"}
                    </button>
                    {ev.is_public && (
                      <button
                        className="dropdown-menu-item"
                        onClick={() => setOpenShare(openShare === ev.id ? null : ev.id)}
                      >
                        {openShare === ev.id ? "Hide share link" : "Share"}
                      </button>
                    )}
                  </div>
                </details>
              </div>
              {openShare === ev.id && <ShareBox id={ev.id} />}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
