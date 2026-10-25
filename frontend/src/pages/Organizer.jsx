import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { fmtRange } from "../utils";

function ShareBox({ id }) {
  const link = `${window.location.origin}/events/${id}`;
  const snippet = `<a href="${link}">Add to Eventure</a>`;
  const [copied, setCopied] = useState("");
  const copy = (text, which) => navigator.clipboard.writeText(text).then(() => setCopied(which));
  return (
    <div className="share-box">
      <div className="row">
        <input readOnly value={link} onFocus={(e) => e.target.select()} aria-label="Event link" />
        <button className="btn ghost small" onClick={() => copy(link, "link")}>{copied === "link" ? "Copied" : "Copy link"}</button>
      </div>
      <div className="row">
        <input readOnly className="mono" value={snippet} onFocus={(e) => e.target.select()} aria-label="Add to Eventure button code" />
        <button className="btn ghost small" onClick={() => copy(snippet, "html")}>{copied === "html" ? "Copied" : "Copy button code"}</button>
      </div>
      <p className="muted small">Put the button on your registration page or poster link. Students who open it can add the event to their timeline in one tap.</p>
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
        <h1>Organizer</h1>
        <Link to="/add" className="btn">List a new event</Link>
      </div>
      <p className="muted">Events you listed, and how many students are interested, registered or attended. Tick "list it publicly" when adding an event so students can discover and review it.</p>
      {error && <p className="error">{error}</p>}
      {!events ? <p className="muted">Loading...</p> : events.length === 0 ? (
        <div className="card empty"><p>You have not listed any events yet.</p></div>
      ) : events.map((ev) => (
        <article className="card" key={ev.id}>
          <div className="card-head">
            <div>
              <h3><Link to={`/events/${ev.id}`}>{ev.title}</Link></h3>
              <p className="muted">{fmtRange(ev.start_at, ev.end_at)}{ev.venue_name ? ` · ${ev.venue_name}` : ""}</p>
            </div>
            <div className="pills">
              <span className={`pill ${ev.is_public ? "ok" : ""}`}>{ev.is_public ? "Public" : "Private"}</span>
              {!ev.upcoming && <span className="pill">Past</span>}
            </div>
          </div>
          <div className="summary compact">
            <div><b>{ev.counts.interested}</b><span>interested</span></div>
            <div><b>{ev.counts.registered}</b><span>registered</span></div>
            <div><b>{ev.counts.attended}</b><span>attended</span></div>
            <div><b>{ev.rating.avg ?? "-"}</b><span>{ev.rating.count ? `rating (${ev.rating.count})` : "no reviews"}</span></div>
          </div>
          <div className="row">
            <button className="btn ghost small" onClick={() => toggle(ev)}>{ev.is_public ? "Make private" : "Make public"}</button>
            {ev.is_public && <button className="btn ghost small" onClick={() => setOpenShare(openShare === ev.id ? null : ev.id)}>{openShare === ev.id ? "Hide share options" : "Share"}</button>}
          </div>
          {openShare === ev.id && <ShareBox id={ev.id} />}
        </article>
      ))}
    </>
  );
}
