import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import { cap, fmtMinutes, fmtRange } from "../utils";

const SCALE = [1, 2, 3, 4, 5];

export default function EventDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ organisation: 4, learning: 4, value: 4, comment: "" });

  const load = useCallback(() => api.get(`/events/${id}`).then(setData).catch((e) => setError(e.message)), [id]);
  useEffect(() => { load(); }, [load]);

  const run = async (fn) => {
    setError("");
    try {
      await fn();
      await load();
    } catch (e) {
      setError(e.message);
    }
  };

  if (!data) return error ? <p className="error">{error}</p> : <p className="muted">Loading...</p>;
  const { event: ev, reviews, mine } = data;

  return (
    <>
      <p><Link to="/discover">Back to discover</Link></p>
      <div className="page-head">
        <div>
          <h1>{ev.title}</h1>
          <p className="muted">{fmtRange(ev.start_at, ev.end_at)}{ev.venue_name ? ` · ${ev.venue_name}` : ""}</p>
        </div>
        <div className="pills">
          {ev.platform && <span className="pill">{ev.platform}</span>}
          <span className="pill alt">{cap(ev.category)}</span>
        </div>
      </div>
      {error && <p className="error">{error}</p>}

      <section className="card">
        {ev.description && <p>{ev.description}</p>}
        <ul className="facts">
          {ev.club_name && <li><b>Organised by</b> {ev.club_name}</li>}
          {ev.distance_km != null && <li><b>From your college</b> {ev.distance_km} km, about {fmtMinutes(ev.travel_minutes)} by road</li>}
          {ev.registration_deadline && <li><b>Register by</b> {fmtRange(ev.registration_deadline)}</li>}
          {ev.url && <li><a href={ev.url} target="_blank" rel="noreferrer">Official page</a></li>}
        </ul>
        <div className="row">
          {!mine.status && <button className="btn" onClick={() => run(() => api.post(`/events/${ev.id}/join`, { status: "registered" }))}>Add to timeline as registered</button>}
          {!mine.status && <button className="btn ghost" onClick={() => run(() => api.post(`/events/${ev.id}/join`, { status: "interested" }))}>Just interested</button>}
          {mine.status && mine.status !== "attended" && (
            <button className="btn" onClick={() => run(() => api.patch(`/user-events/${mine.user_event_id}`, { status: "attended" }))}>I attended this</button>
          )}
          {mine.status && <span className="pill">On your timeline: {mine.status}</span>}
          {mine.is_owner && <Link className="btn ghost" to={`/events/${ev.id}/edit`}>Edit details</Link>}
        </div>
      </section>

      <section>
        <h2>What students who attended say</h2>
        {ev.rating.count > 0 ? (
          <div className="card ratings">
            <div className="big">{ev.rating.avg}<span> / 5</span></div>
            <ul>
              <li>Organisation <b>{ev.rating.organisation}</b></li>
              <li>Learning <b>{ev.rating.learning}</b></li>
              <li>Worth the trip <b>{ev.rating.value}</b></li>
            </ul>
            <p className="muted small">{ev.rating.count} verified review{ev.rating.count > 1 ? "s" : ""}. Only students who had this event on their timeline as attended can review.</p>
          </div>
        ) : (
          <p className="muted">No reviews yet. Reviews come only from students who attended.</p>
        )}
        {reviews.map((r) => (
          <article className="card review" key={r.id}>
            <p><b>{r.author}</b>{r.college ? `, ${r.college}` : ""} <span className="pill ok">Attended</span> <span className="muted small">{r.overall} / 5</span></p>
            {r.comment && <p>{r.comment}</p>}
            {r.mine && <button className="linklike small" onClick={() => window.confirm("Delete your review?") && run(() => api.del(`/events/${ev.id}/reviews/mine`))}>Delete my review</button>}
          </article>
        ))}

        {mine.can_review ? (
          <form className="card" onSubmit={(e) => { e.preventDefault(); run(() => api.post(`/events/${ev.id}/reviews`, form)); }}>
            <h3>Rate this event</h3>
            <div className="grid3">
              {[["organisation", "Organisation"], ["learning", "Learning"], ["value", "Worth the trip"]].map(([k, label]) => (
                <label key={k}>{label}
                  <select value={form[k]} onChange={(e) => setForm({ ...form, [k]: Number(e.target.value) })}>{SCALE.map((n) => <option key={n} value={n}>{n}</option>)}</select>
                </label>
              ))}
            </div>
            <label>Anything others should know?<textarea rows={3} value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} /></label>
            <button className="btn">Post review</button>
          </form>
        ) : (
          mine.review_blocked_reason && <p className="notice">{mine.review_blocked_reason}</p>
        )}
      </section>
    </>
  );
}
