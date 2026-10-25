import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import MapView from "../components/MapView.jsx";
import { CATEGORIES, cap, fmtMinutes, fmtRange } from "../utils";

function Rating({ r }) {
  if (!r.count) return <span className="muted small">No reviews yet</span>;
  return <span className="small"><b>{r.avg}</b> / 5 from {r.count} student{r.count > 1 ? "s" : ""} who attended</span>;
}

export default function Discover() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState({ q: "", category: "", radius_km: "", sort: "rank" });
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [picked, setPicked] = useState([]);
  const [compare, setCompare] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => v && params.set(k, v));
    const id = setTimeout(() => {
      api.get(`/discover?${params}`).then(setData).catch((e) => setError(e.message));
    }, 250);
    return () => clearTimeout(id);
  }, [filters]);

  const open = useCallback((id) => navigate(`/events/${id}`), [navigate]);
  const set = (k) => (e) => setFilters({ ...filters, [k]: e.target.value });

  async function add(ev) {
    setError("");
    try {
      await api.post(`/events/${ev.id}/join`, { status: "interested" });
      setData({ ...data, events: data.events.map((e) => (e.id === ev.id ? { ...e, in_timeline: true } : e)) });
    } catch (e) {
      setError(e.message);
    }
  }

  function toggle(id) {
    setCompare(null);
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length < 3 ? [...p, id] : p));
  }

  async function runCompare() {
    setError("");
    try {
      const r = await api.get(`/compare?ids=${picked.join(",")}`);
      setCompare(r.events);
    } catch (e) {
      setError(e.message);
    }
  }

  const events = data?.events || [];
  return (
    <>
      <h1>Discover events</h1>
      <div className="filters">
        <input value={filters.q} onChange={set("q")} placeholder="Search events, venues" aria-label="Search" />
        <select value={filters.category} onChange={set("category")} aria-label="Category">
          <option value="">All types</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{cap(c)}</option>)}
        </select>
        <select value={filters.radius_km} onChange={set("radius_km")} aria-label="Distance">
          <option value="">Any distance</option>
          <option value="10">Within 10 km</option>
          <option value="25">Within 25 km</option>
          <option value="50">Within 50 km</option>
        </select>
        <select value={filters.sort} onChange={set("sort")} aria-label="Sort">
          <option value="rank">Best for me</option>
          <option value="date">Soonest</option>
          <option value="distance">Nearest</option>
        </select>
      </div>
      {error && <p className="error">{error}</p>}
      {data && data.college.lat == null && (
        <p className="notice">Set your college location in <Link to="/settings">Settings</Link> to see distances and travel times.</p>
      )}

      <div className="discover">
        <div>
          {!data ? <p className="muted">Finding events...</p> : events.length === 0 ? (
            <div className="card empty"><p>No events match those filters. Try a wider distance or another type.</p></div>
          ) : events.map((ev) => (
            <article className="card event-card" key={ev.id}>
              <div className="card-head">
                <div>
                  <h3><Link to={`/events/${ev.id}`}>{ev.title}</Link></h3>
                  <p className="muted">{fmtRange(ev.start_at, ev.end_at)}</p>
                  <p className="muted">{ev.venue_name}{ev.club_name ? ` · ${ev.club_name}` : ""}</p>
                </div>
                <div className="pills">
                  {ev.platform && <span className="pill">{ev.platform}</span>}
                  <span className="pill alt">{cap(ev.category)}</span>
                </div>
              </div>
              <p className="small">
                {ev.distance_km != null ? `${ev.distance_km} km away, about ${fmtMinutes(ev.travel_minutes)} by road` : "Distance unknown"}
              </p>
              <Rating r={ev.rating} />
              <div className="card-foot">
                <label className="check small">
                  <input type="checkbox" checked={picked.includes(ev.id)} onChange={() => toggle(ev.id)} disabled={!picked.includes(ev.id) && picked.length >= 3} /> Compare
                </label>
                <button className="btn small" disabled={ev.in_timeline} onClick={() => add(ev)}>{ev.in_timeline ? "On your timeline" : "Add to timeline"}</button>
              </div>
            </article>
          ))}
        </div>
        <aside className="map-wrap">
          <MapView college={data?.college} events={events} onOpen={open} />
          <p className="small muted">Dark dot is your college. Click a red dot to open the event.</p>
        </aside>
      </div>

      {picked.length >= 2 && (
        <div className="compare-bar">
          <span>{picked.length} selected</span>
          <button className="btn" onClick={runCompare}>Compare events</button>
          <button className="linklike" onClick={() => { setPicked([]); setCompare(null); }}>Clear</button>
        </div>
      )}

      {compare && (
        <section className="card scroll-x">
          <h2>Side by side</h2>
          <table>
            <thead><tr><th></th>{compare.map((e) => <th key={e.id}><Link to={`/events/${e.id}`}>{e.title}</Link></th>)}</tr></thead>
            <tbody>
              <tr><th>When</th>{compare.map((e) => <td key={e.id}>{fmtRange(e.start_at, e.end_at)}</td>)}</tr>
              <tr><th>Where</th>{compare.map((e) => <td key={e.id}>{e.venue_name || "-"}</td>)}</tr>
              <tr><th>From your college</th>{compare.map((e) => <td key={e.id}>{e.distance_km != null ? `${e.distance_km} km, ${fmtMinutes(e.travel_minutes)}` : "-"}</td>)}</tr>
              <tr><th>Overall</th>{compare.map((e) => <td key={e.id}>{e.rating.count ? `${e.rating.avg} (${e.rating.count})` : "No reviews"}</td>)}</tr>
              <tr><th>Organisation</th>{compare.map((e) => <td key={e.id}>{e.rating.organisation ?? "-"}</td>)}</tr>
              <tr><th>Learning</th>{compare.map((e) => <td key={e.id}>{e.rating.learning ?? "-"}</td>)}</tr>
              <tr><th>Worth the trip</th>{compare.map((e) => <td key={e.id}>{e.rating.value ?? "-"}</td>)}</tr>
              <tr><th>Fit for your goals</th>{compare.map((e) => <td key={e.id}>{e.fit_score} / 100</td>)}</tr>
            </tbody>
          </table>
        </section>
      )}
    </>
  );
}
