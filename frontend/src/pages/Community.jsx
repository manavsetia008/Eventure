import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Check, Users } from "lucide-react";
import { api } from "../api";
import Badge from "../components/Badge.jsx";
import { cap, fmtDate, fmtRange, timeLeft } from "../utils";

function Clubs() {
  const [clubs, setClubs] = useState(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", description: "" });
  const [open, setOpen] = useState(null);

  const load = useCallback(() => api.get("/clubs").then((r) => setClubs(r.clubs)).catch((e) => setError(e.message)), []);
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

  async function toggleOpen(id) {
    if (open?.club.id === id) return setOpen(null);
    try {
      setOpen(await api.get(`/clubs/${id}`));
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <>
      {error && <p className="error">{error}</p>}
      {!clubs ? (
        <div className="page-loading-state">Loading clubs...</div>
      ) : clubs.length === 0 ? (
        <div className="card empty">
          <Users size={22} strokeWidth={1.75} />
          <p>No clubs yet</p>
          <p className="muted small">Be the first to start one below.</p>
        </div>
      ) : (
        <div className="list-panel">
          {clubs.map((c) => (
            <div className="list-row" key={c.id}>
              <div className="list-row-main">
                <div className="list-row-title">{c.name}</div>
                <div className="list-row-sub muted small">
                  {c.college || "Open community"} · {c.followers} follower{c.followers === 1 ? "" : "s"}
                </div>
                {c.description && <p className="list-row-desc">{c.description}</p>}
              </div>
              <div className="list-row-actions">
                <button className="btn tertiary small" onClick={() => toggleOpen(c.id)}>
                  {open?.club.id === c.id ? "Hide events" : "Events"}
                </button>
                <button
                  className={"btn small" + (c.following ? " secondary" : "")}
                  onClick={() => run(() => api.post(`/clubs/${c.id}/follow`))}
                >
                  {c.following ? (
                    <>
                      <Check size={14} strokeWidth={1.75} /> Following
                    </>
                  ) : (
                    "Follow"
                  )}
                </button>
              </div>
              {open?.club.id === c.id && (
                <div className="list-row-events">
                  {open.events.length === 0 ? (
                    <p className="muted small community-flush">No upcoming events from this club.</p>
                  ) : (
                    <ul className="plain">
                      {open.events.map((e) => (
                        <li key={e.id}>
                          <Link to={`/events/${e.id}`}>{e.title}</Link>{" "}
                          <span className="muted small">{fmtRange(e.start_at, e.end_at)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <form
        className="card"
        onSubmit={(e) => {
          e.preventDefault();
          run(async () => {
            await api.post("/clubs", form);
            setForm({ name: "", description: "" });
          });
        }}
      >
        <h3>Start a club or community page</h3>
        <label>Name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label>
        <label>What it does<input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
        <button className="btn">Create</button>
      </form>
    </>
  );
}

function Teams() {
  const [teams, setTeams] = useState(null);
  const [current, setCurrent] = useState(null);
  const [view, setView] = useState(null);
  const [mine, setMine] = useState([]);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [share, setShare] = useState("");
  const [copiedCode, setCopiedCode] = useState(false);

  const loadTeams = useCallback(() => api.get("/teams").then((r) => setTeams(r.teams)).catch((e) => setError(e.message)), []);
  useEffect(() => { loadTeams(); }, [loadTeams]);
  useEffect(() => {
    api.get("/timeline").then((r) => setMine(r.items.filter((i) => !i.past && i.status !== "skipped"))).catch(() => {});
  }, []);
  const loadView = useCallback((id) => api.get(`/teams/${id}`).then(setView).catch((e) => setError(e.message)), []);
  useEffect(() => { if (current) loadView(current); else setView(null); }, [current, loadView]);

  const run = async (fn) => {
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <>
      {error && <p className="error">{error}</p>}
      <div className="grid2">
        <form
          className="card"
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              const r = await api.post("/teams", { name });
              setName("");
              await loadTeams();
              setCurrent(r.team.id);
            });
          }}
        >
          <h3 className="community-card-title">Create a team</h3>
          <p className="muted small community-card-sub">Start a squad for hackathons, case comps, or any event.</p>
          <label>Team name<input value={name} onChange={(e) => setName(e.target.value)} required /></label>
          <button className="btn small">Create team</button>
        </form>
        <form
          className="card"
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              const r = await api.post("/teams/join", { code });
              setCode("");
              await loadTeams();
              setCurrent(r.team.id);
            });
          }}
        >
          <h3 className="community-card-title">Join with a code</h3>
          <p className="muted small community-card-sub">Someone sent you a team code? Enter it below.</p>
          <label>Team code<input value={code} onChange={(e) => setCode(e.target.value)} required /></label>
          <button className="btn">Join team</button>
        </form>
      </div>

      {teams && teams.length > 0 && (
        <div className="row tabs">
          {teams.map((t) => (
            <button key={t.id} className={`tab ${current === t.id ? "on" : ""}`} onClick={() => setCurrent(t.id)}>
              {t.name}
            </button>
          ))}
        </div>
      )}
      {teams && teams.length === 0 && (
        <p className="muted">You are not in a team yet. Create one and share the code with your teammates.</p>
      )}

      {view && (
        <section>
          <h2>{view.team.name}</h2>
          <div className="community-share-row">
            <span className="muted small">Share this code to invite teammates:</span>
            <div className="team-code-box">
              <code>{view.team.code}</code>
              <button
                className="btn ghost small community-copy-btn"
                onClick={() => navigator.clipboard.writeText(view.team.code).then(() => setCopiedCode(true))}
              >
                {copiedCode ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
          <p className="muted small">Members: {view.members.map((m) => m.name).join(", ")}</p>
          {view.events.length === 0 && (
            <p className="muted">No shared events yet. Share one from your timeline below.</p>
          )}
          {view.events.map((e) => (
            <article className="card" key={e.event.id}>
              <h3><Link to={`/events/${e.event.id}`}>{e.event.title}</Link></h3>
              <p className="muted">{fmtRange(e.event.start_at, e.event.end_at)}</p>
              {e.next_deadline && (
                <p className="small">
                  Next team deadline: <b>{e.next_deadline.name}</b>,{" "}
                  {fmtDate(e.next_deadline.due_at)} ({timeLeft(e.next_deadline.due_at)})
                </p>
              )}
              <ul className="plain">
                {e.members.map((m) => (
                  <li key={m.user_id} className="community-member-row">
                    {m.name} <Badge variant="neutral">{cap(m.status)}</Badge>
                  </li>
                ))}
              </ul>
            </article>
          ))}
          <form
            className="card row"
            onSubmit={(ev) => {
              ev.preventDefault();
              run(async () => {
                await api.post(`/teams/${view.team.id}/events`, { event_id: Number(share) });
                setShare("");
                await loadView(view.team.id);
              });
            }}
          >
            <select className="clean-select" value={share} onChange={(e) => setShare(e.target.value)} aria-label="Event to share" required>
              <option value="">Share an event from your timeline…</option>
              {mine.map((i) => <option key={i.id} value={i.event.id}>{i.event.title}</option>)}
            </select>
            <button className="btn">Share with team</button>
          </form>
        </section>
      )}
    </>
  );
}

export default function Community() {
  const [tab, setTab] = useState("clubs");
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Community</h1>
          <p className="muted small">Clubs across campuses and the teams you build with.</p>
        </div>
      </div>
      <div className="row tabs">
        <button className={`tab ${tab === "clubs" ? "on" : ""}`} onClick={() => setTab("clubs")}>
          Clubs across campuses
        </button>
        <button className={`tab ${tab === "teams" ? "on" : ""}`} onClick={() => setTab("teams")}>
          My teams
        </button>
      </div>
      {tab === "clubs" ? <Clubs /> : <Teams />}
    </>
  );
}
