import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { fmtDate } from "../utils";

export default function Notifications() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

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

  return (
    <>
      <div className="page-head">
        <h1>Alerts</h1>
        <div className="row">
          <button className="btn ghost" onClick={() => run(async () => { const r = await api.post("/notifications/check"); setNote(r.created ? `${r.created} new alert${r.created > 1 ? "s" : ""}.` : "Nothing at risk right now."); })}>Check my deadlines now</button>
          <button className="btn" onClick={() => run(() => api.post("/notifications/read-all"))}>Mark all read</button>
        </div>
      </div>
      {note && <p className="notice">{note}</p>}
      {error && <p className="error">{error}</p>}
      {!data ? <p className="muted">Loading...</p> : data.notifications.length === 0 ? (
        <div className="card empty"><p>No alerts. We only message you when a deadline is actually at risk.</p></div>
      ) : (
        <ul className="plain alerts">
          {data.notifications.map((n) => (
            <li key={n.id} className={`alert lvl-${n.level} ${n.read ? "read" : ""}`}>
              <span>{n.message}</span>
              <span className="muted small">{fmtDate(n.created_at)}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
