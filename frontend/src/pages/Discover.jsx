import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ExternalLink, Rss, Search, Sparkles, X } from "lucide-react";
import { api } from "../api";
import MapView from "../components/MapView.jsx";
import Status from "../components/Status.jsx";
import Chip from "../components/Chip.jsx";
import Checkbox from "../components/Checkbox.jsx";
import { CATEGORIES, cap, fmtDate, fmtDuration, fmtRange } from "../utils";

const EMPTY_FILTERS = { q: "", category: "", radius_km: "", portals_only: "", sort: "rank" };

function Rating({ r }) {
  if (!r.count) return <span className="muted small">No reviews yet</span>;
  return (
    <span className="small">
      <b>{r.avg}</b> / 5 ({r.count} review{r.count > 1 ? "s" : ""})
    </span>
  );
}

export default function Discover() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [picked, setPicked] = useState([]);
  const [compare, setCompare] = useState(null);
  const [portals, setPortals] = useState([]);
  const [suggestions, setSuggestions] = useState([]);

  useEffect(() => {
    api.get("/discover/suggestions")
      .then((r) => setSuggestions(r.suggestions || []))
      .catch(() => {});
  }, []);

  const loadPortals = useCallback(() => {
    api.get("/portals").then((r) => setPortals(r.portals || [])).catch(() => {});
  }, []);

  useEffect(() => {
    loadPortals();
  }, [loadPortals]);

  const toggleSync = async (p) => {
    try {
      await api.patch(`/portals/${p.id}`, { auto_sync: !p.auto_sync });
      loadPortals();
    } catch {
      /* keep the previous portal state if the toggle fails */
    }
  };

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
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length < 4 ? [...p, id] : p));
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
  const hasMapPins = Boolean(
    (data?.college?.lat != null && data?.college?.lng != null) ||
    events.some((event) => event.lat != null && event.lng != null)
  );
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Discover events</h1>
          <p className="muted small">Browse live public hackathons from Unstop and Devfolio. Dates that organisers do not publish stay marked as unconfirmed.</p>
        </div>
      </div>

      {/* Personalized suggestions from web search and the maintained portal catalogue */}
      {suggestions.length > 0 && (
        <section className="card" style={{ background: "rgba(99, 102, 241, 0.05)", border: "1px solid var(--accent)", padding: "1.2rem", marginBottom: "1.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.8rem", flexWrap: "wrap", gap: "0.5rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Sparkles size={18} color="var(--accent)" />
              <strong style={{ fontSize: "1rem" }}>Hackathon suggestions</strong>
            </div>
            <span className="pill ok" style={{ fontSize: "0.75rem" }}>Live listings + portal directory</span>
          </div>
          <p className="small muted" style={{ margin: "0 0 1rem 0" }}>
            Ranked against your interests and goals. Portal-directory links are not event listings; confirm dates, eligibility and registration on the organiser&apos;s official page.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1rem" }}>
            {suggestions.map((s, idx) => (
              <div key={idx} className="card" style={{ background: "var(--surface)", border: "1px solid var(--line)", padding: "0.9rem", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.4rem" }}>
                    <span className="pill" style={{ fontSize: "0.7rem", background: "var(--accent-subtle)", color: "var(--accent)" }}>{s.platform || "Hackathon"}</span>
                    <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--accent)" }}>{s.match_score} Fit</span>
                  </div>
                  <h4 style={{ margin: "0.5rem 0 0.3rem", fontSize: "0.95rem" }}>{s.title}</h4>
                  <p className="small muted" style={{ margin: "0 0 0.5rem", lineHeight: "1.4" }}>{s.reason || s.description?.slice(0, 100)}</p>
                  {!s.start_at && (
                    <p className="small muted" style={{ margin: "0 0 0.5rem" }}>
                      Dates are not confirmed by this public listing — check the organiser&apos;s page.
                    </p>
                  )}
                  {s.matched_skills && s.matched_skills.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginBottom: "0.6rem" }}>
                      {s.matched_skills.map((sk) => (
                        <span key={sk} style={{ fontSize: "0.65rem", padding: "2px 6px", borderRadius: "999px", background: "var(--card-light)", border: "1px solid var(--line)" }}>
                          #{sk}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.6rem" }}>
                  {s.url && (
                    <a href={s.url} target="_blank" rel="noreferrer" className="btn-tertiary" style={{ fontSize: "0.75rem", padding: "4px 8px" }}>
                      View Link <ExternalLink size={11} />
                    </a>
                  )}
                  {s.id ? (
                    <button
                      type="button"
                      className="btn small"
                      style={{ fontSize: "0.75rem", padding: "4px 10px" }}
                      onClick={() => add({ id: s.id, title: s.title })}
                    >
                      + Add to Timeline
                    </button>
                  ) : (
                    <span className="small muted" title="This is a discovery candidate, not a verified live event">
                      Verify listing before adding
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Tracked portals strip */}
      <div className="portal-tracker-bar">
        <div className="portal-tracker-top">
          <div className="portal-tracker-header">
            <Rss size={16} strokeWidth={1.75} className="discover-portal-icon" />
            <strong className="portal-tracker-title">Tracked portals</strong>
            <span className="portal-tracker-desc">Deadline reminders from the portals you follow</span>
          </div>
          <Link to="/settings" className="btn-tertiary">Manage portals</Link>
        </div>
        <div className="portal-tracker-list">
          {portals.length === 0 ? (
            <span className="portal-tracker-desc">
              Default sources are tracked (Unstop, Devfolio, Hack2skill). <Link to="/settings">Add portals</Link> you follow.
            </span>
          ) : (
            portals.map((p) => (
              <div key={p.id} className="portal-tracker-item">
                <span className="portal-tracker-item-name">{p.name}</span>
                <Status variant={p.auto_sync ? "active" : "neutral"} label={p.auto_sync ? "Synced" : "Paused"} />
                <button
                  type="button"
                  className="btn-tertiary"
                  onClick={() => toggleSync(p)}
                  title={p.auto_sync ? "Click to pause sync" : "Click to enable sync"}
                >
                  {p.auto_sync ? "Pause" : "Sync"}
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="filters">
        <div className="search-field">
          <Search size={16} strokeWidth={1.75} aria-hidden="true" />
          <input value={filters.q} onChange={set("q")} placeholder="Search events, venues" aria-label="Search" />
        </div>
        <select className="clean-select" value={filters.category} onChange={set("category")} aria-label="Category">
          <option value="">All types</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{cap(c)}</option>)}
        </select>
        <select className="clean-select" value={filters.radius_km} onChange={set("radius_km")} aria-label="Distance">
          <option value="">Any distance</option>
          <option value="10">Within 10 km</option>
          <option value="25">Within 25 km</option>
          <option value="50">Within 50 km</option>
        </select>
        <select className="clean-select" value={filters.portals_only} onChange={set("portals_only")} aria-label="Portal Source">
          <option value="">All platforms</option>
          <option value="true">Tracked portals only</option>
        </select>
        <select className="clean-select" value={filters.sort} onChange={set("sort")} aria-label="Sort">
          <option value="rank">Best for me</option>
          <option value="date">Soonest</option>
          <option value="distance">Nearest</option>
        </select>
      </div>

      {error && <p className="error">{error}</p>}

      {data && data.college.lat == null && (
        <p className="notice">
          Set your campus location in <Link to="/settings">Settings</Link> to calculate travel distance and transit times.
        </p>
      )}

      <div className="discover">
        <div>
          {!data ? (
            <div className="discover-grid" aria-hidden="true">
              {[0, 1, 2, 3].map((i) => <div key={i} className="skeleton skeleton-card" />)}
            </div>
          ) : events.length === 0 ? (
            <div className="card empty">
              <Search size={20} strokeWidth={1.75} aria-hidden="true" />
              <p>No events match your filters</p>
              <button type="button" className="btn secondary small" onClick={() => setFilters(EMPTY_FILTERS)}>
                Clear filters
              </button>
            </div>
          ) : (
            <div className="discover-grid">
              {events.map((ev) => (
                <article className="card event-card" key={ev.id}>
                  <div className="event-card-top">
                    <h3>
                      <Link to={`/events/${ev.id}`} className="event-title-link">
                        {ev.title}
                      </Link>
                    </h3>
                    <div className="pills">
                      <Chip label={cap(ev.category)} />
                      {ev.platform && <Chip label={ev.platform} />}
                    </div>
                  </div>
                  <p className="muted small">{fmtRange(ev.start_at, ev.end_at)}</p>
                  <p className="muted small">{ev.venue_name}{ev.club_name ? ` · ${ev.club_name}` : ""}</p>

                  <div className="row discover-row">
                    <p className="small muted discover-flush">
                      {ev.distance_km != null ? `${ev.distance_km} km away, about ${fmtDuration(ev.travel_minutes)} by road` : "Travel time unavailable"}
                    </p>
                    <Rating r={ev.rating} />
                  </div>

                  {ev.fit_score != null && (
                    <p className="event-score small discover-flush">
                      <b className={ev.verdict === "Skip" ? "score-skip" : "score-keep"}>{ev.fit_score}</b>
                      {ev.verdict ? ` · ${ev.verdict}` : ""}
                    </p>
                  )}

                  <div className="card-foot">
                    <Checkbox
                      checked={picked.includes(ev.id)}
                      onChange={() => toggle(ev.id)}
                      disabled={!picked.includes(ev.id) && picked.length >= 4}
                      label="Compare"
                      aria-label={`Compare ${ev.title}`}
                    />
                    <div className="card-foot-actions">
                      {ev.url && (
                        <a
                          href={ev.url.startsWith("http") ? ev.url : `https://${ev.url}`}
                          target="_blank"
                          rel="noreferrer"
                          className="btn-tertiary"
                        >
                          Open page <ExternalLink size={12} />
                        </a>
                      )}
                      <button className="btn secondary small" disabled={ev.in_timeline} onClick={() => add(ev)}>
                        {ev.in_timeline ? "On timeline" : "Add to timeline"}
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        <aside className="map-wrap">
          <MapView college={data?.college} events={events} onOpen={open} />
          <p className="small muted discover-map-note">
            {hasMapPins
              ? "The dark marker is your college; event markers are shown where listings include real coordinates. Select a marker to view details."
              : "The basemap is live, but these public listings do not provide map coordinates yet. Event pins will appear when the organisers publish locations."}
          </p>
        </aside>
      </div>

      {picked.length >= 2 && (
        <div className="compare-bar">
          <span className="compare-bar-count">{picked.length} selected</span>
          <button type="button" className="btn small" onClick={runCompare}>
            Compare
          </button>
          <button type="button" className="btn-tertiary" onClick={() => { setPicked([]); setCompare(null); }}>
            Clear
          </button>
        </div>
      )}

      {compare && (
        <section className="card scroll-x discover-compare-section">
          <div className="discover-compare-head">
            <h2 className="discover-compare-title">Comparison</h2>
            <div className="discover-compare-actions">
              <button
                type="button"
                className="btn-tertiary"
                onClick={() => { setPicked([]); setCompare(null); }}
              >
                Clear selection
              </button>
              <button
                type="button"
                className="btn secondary small"
                onClick={() => setCompare(null)}
              >
                <X size={14} strokeWidth={1.75} /> Close
              </button>
            </div>
          </div>
          <table className="compare-table discover-compare-table">
            <thead>
              <tr className="discover-compare-headrow">
                <th className="discover-compare-th discover-compare-th-metric">Metric</th>
                {compare.map((e) => (
                  <th key={e.id} className="discover-compare-th">
                    <Link to={`/events/${e.id}`} className="discover-compare-link">{e.title}</Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <th className="discover-compare-th discover-compare-th-metric">Date</th>
                {compare.map((e) => <td key={e.id} className="discover-compare-td">{fmtRange(e.start_at, e.end_at)}</td>)}
              </tr>
              <tr>
                <th className="discover-compare-th discover-compare-th-metric">Venue</th>
                {compare.map((e) => <td key={e.id} className="discover-compare-td">{e.venue_name || "-"}</td>)}
              </tr>
              <tr>
                <th className="discover-compare-th discover-compare-th-metric">Travel time</th>
                {compare.map((e) => (
                  <td key={e.id} className="discover-compare-td">
                    {e.travel_minutes != null ? `${fmtDuration(e.travel_minutes)} (${e.distance_km} km)` : "Travel time unavailable"}
                  </td>
                ))}
              </tr>
              <tr>
                <th className="discover-compare-th discover-compare-th-metric">Deadline</th>
                {compare.map((e) => (
                  <td key={e.id} className="discover-compare-td">
                    {e.registration_deadline ? fmtDate(e.registration_deadline) : "None listed"}
                  </td>
                ))}
              </tr>
              <tr>
                <th className="discover-compare-th discover-compare-th-metric">Score</th>
                {compare.map((e) => (
                  <td key={e.id} className="discover-compare-td discover-compare-td-score">
                    {e.fit_score != null ? `${e.fit_score} / 100` : "-"}
                  </td>
                ))}
              </tr>
              <tr>
                <th className="discover-compare-th discover-compare-th-metric">Keep / Skip</th>
                {compare.map((e) => (
                  <td key={e.id} className="discover-compare-td">
                    <span className={`discover-compare-verdict ${e.verdict === "Keep" ? "is-keep" : e.verdict === "Skip" ? "is-skip" : "is-default"}`}>
                      {e.verdict || (e.fit_score >= 55 ? "Keep" : "Skip")}
                    </span>
                  </td>
                ))}
              </tr>
              <tr>
                <th className="discover-compare-th discover-compare-th-metric">Timeline</th>
                {compare.map((e) => (
                  <td key={e.id} className="discover-compare-td">
                    <button
                      type="button"
                      className="btn small"
                      disabled={e.in_timeline}
                      onClick={() => add(e)}
                    >
                      {e.in_timeline ? "On timeline" : "Add to timeline"}
                    </button>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </section>
      )}
    </>
  );
}
