import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { fmtRange } from "../utils";

function ShareBox({ id }) {
  const link = `${window.location.origin}/events/${id}`;
  const snippet = `<a href="${link}" target="_blank" rel="noopener">Add to Eventure</a>`;
  const [copied, setCopied] = useState("");
  const copy = (text, which) => navigator.clipboard.writeText(text).then(() => setCopied(which));

  return (
    <div className="share-box">
      <label className="small">Direct link</label>
      <div className="row">
        <input readOnly value={link} onFocus={(e) => e.target.select()} aria-label="Event link" />
        <button className="btn ghost small" onClick={() => copy(link, "link")}>
          {copied === "link" ? "Copied" : "Copy link"}
        </button>
      </div>
      <label className="small" style={{ marginTop: ".4rem" }}>Embed button code</label>
      <div className="row">
        <input readOnly className="mono" value={snippet} onFocus={(e) => e.target.select()} aria-label="Add to Eventure button code" />
        <button className="btn ghost small" onClick={() => copy(snippet, "html")}>
          {copied === "html" ? "Copied" : "Copy code"}
        </button>
      </div>
      <p className="muted small" style={{ marginTop: ".4rem", marginBottom: 0 }}>
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
          <h1>Organizer</h1>
          <p className="muted small">
            Events you listed, with turnout metrics, ratings, and timeline tracking.
          </p>
        </div>
        <Link to="/add" className="btn">+ List a new event</Link>
      </div>

      {error && <p className="error">{error}</p>}

      {!events ? (
        <p className="muted center">Loading your listed events...</p>
      ) : events.length === 0 ? (
        <div className="card empty">
          <p>You have not listed any events yet.</p>
          <p><Link to="/add">List an event</Link> so peers can discover and track it.</p>
        </div>
      ) : (
        <div className="events-list">
          {events.map((ev) => (
            <article className="card" key={ev.id}>
              <div className="card-head">
                <div>
                  <h3>
                    <Link to={`/events/${ev.id}`}>{ev.title}</Link>
                  </h3>
                  <p className="muted small">
                    {fmtRange(ev.start_at, ev.end_at)}
                    {ev.venue_name ? ` · ${ev.venue_name}` : ""}
                  </p>
                </div>
                <div className="pills">
                  <span className={`pill ${ev.is_public ? "ok" : ""}`}>{ev.is_public ? "Public" : "Private"}</span>
                  {!ev.upcoming && <span className="pill">Past</span>}
                </div>
              </div>

              <div className="summary compact">
                <div>
                  <b>{ev.counts.interested}</b>
                  <span>interested</span>
                </div>
                <div>
                  <b>{ev.counts.registered}</b>
                  <span>registered</span>
                </div>
                <div>
                  <b>{ev.counts.attended}</b>
                  <span>attended</span>
                </div>
                <div>
                  <b>{ev.rating.avg ?? "-"}</b>
                  <span>{ev.rating.count ? `rating (${ev.rating.count})` : "no reviews"}</span>
                </div>
              </div>

              <div className="card-foot">
                <div className="row">
                  <button className="btn ghost small" onClick={() => toggle(ev)}>
                    {ev.is_public ? "Make private" : "Make public"}
                  </button>
                  {ev.is_public && (
                    <button className="btn ghost small" onClick={() => setOpenShare(openShare === ev.id ? null : ev.id)}>
                      {openShare === ev.id ? "Hide share" : "Share"}
                    </button>
                  )}
                </div>
                <Link to={`/events/${ev.id}/edit`} className="linklike small">
                  Edit details
                </Link>
              </div>

              {openShare === ev.id && <ShareBox id={ev.id} />}
            </article>
          ))}
        </div>
      )}
    </>
  );
}
