import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { fmtDate, timeAgo } from "../utils";

export default function Notifications() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [checking, setChecking] = useState(false);

  const load = useCallback(() => api.get("/notifications").then(setData).catch((e) => setError(e.message)), []);
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

  const handleCheckDeadlines = async () => {
    setChecking(true);
    setNote("");
    try {
      const r = await api.post("/notifications/check");
      setNote(r.created ? `Checked: ${r.created} deadline reminder${r.created > 1 ? "s" : ""} generated.` : "Checked: no upcoming deadlines are currently at risk.");
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setChecking(false);
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Alerts & Reminders</h1>
          <p className="muted small">Notifications for critical deadlines, stages, and clashes.</p>
        </div>
        <div className="row">
          <button className="btn ghost small" disabled={checking} onClick={handleCheckDeadlines}>
            {checking ? "Checking..." : "Check deadlines now"}
          </button>
          <button className="btn small" onClick={() => run(() => api.post("/notifications/read-all"))}>
            Mark all read
          </button>
        </div>
      </div>

      {note && <p className="notice">{note}</p>}
      {error && <p className="error">{error}</p>}

      {!data ? (
        <p className="muted center">Loading alerts...</p>
      ) : data.notifications.length === 0 ? (
        <div className="card empty">
          <p>No active alerts. Reminders appear only when an actionable deadline approaches.</p>
        </div>
      ) : (
        <ul className="plain alerts">
          {data.notifications.map((n) => (
            <li key={n.id} className={`alert lvl-${n.level} ${n.read ? "read" : ""}`}>
              <div className="alert-content">
                <span className="alert-message">{n.message}</span>
                <span className="muted small" title={fmtDate(n.created_at)}>{timeAgo(n.created_at)}</span>
              </div>
              <span className={`pill level-pill ${n.level}`}>{n.level}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
