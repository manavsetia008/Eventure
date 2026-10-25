import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import { cap, fmtRange } from "../utils";

export default function Inbox() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const load = useCallback(() => api.get("/inbox").then(setData).catch((e) => setError(e.message)), []);
  useEffect(() => { load(); }, [load]);

  async function dismiss(id) {
    setError("");
    try {
      await api.post(`/inbox/${id}/dismiss`);
      await load();
    } catch (e) {
      setError(e.message);
    }
  }

  if (!data) return error ? <p className="error">{error}</p> : <p className="muted">Loading your inbox...</p>;
  const address = data.forwarding_address;

  return (
    <>
      <h1>Inbox</h1>
      <section className="card">
        <h2>Forward event emails here</h2>
        {address ? (
          <>
            <p className="muted">Forward any event email, registration confirmation or organiser mail to your private address. It shows up below with the details already read. You check it before it joins your timeline.</p>
            <div className="row">
              <input readOnly value={address} onFocus={(e) => e.target.select()} aria-label="Your forwarding address" />
              <button className="btn" onClick={() => navigator.clipboard.writeText(address).then(() => setCopied(true))}>{copied ? "Copied" : "Copy"}</button>
            </div>
            <p className="muted small">Only mail sent to this exact address reaches your inbox. Anyone who knows it can add items here, so do not post it publicly.</p>
          </>
        ) : (
          <p className="muted">Email forwarding is not switched on for this server yet (the admin sets <code>INBOX_ADDRESS</code> and mailbox access, see the README). Until then, use <Link to="/add">Add event</Link> and paste the email text.</p>
        )}
      </section>

      {error && <p className="error">{error}</p>}
      <h2>Waiting for you</h2>
      {data.items.length === 0 ? (
        <div className="card empty"><p>Nothing waiting. Forwarded emails appear here.</p></div>
      ) : (
        data.items.map((item) => {
          const p = item.parsed || {};
          return (
            <article className="card" key={item.id}>
              <div className="card-head">
                <div>
                  <h3>{p.title || item.subject || "Untitled event"}</h3>
                  <p className="muted small">From {item.sender || "unknown sender"}</p>
                </div>
                <div className="pills">
                  {p.platform && <span className="pill">{p.platform}</span>}
                  {p.category && <span className="pill alt">{cap(p.category)}</span>}
                </div>
              </div>
              <ul className="facts">
                <li><b>When</b> {p.start_at ? fmtRange(p.start_at, p.end_at) : "Not found in the email"}</li>
                {p.venue_name && <li><b>Where</b> {p.venue_name}</li>}
                {p.registration_deadline && <li><b>Register by</b> {fmtRange(p.registration_deadline)}</li>}
              </ul>
              <div className="row">
                <button className="btn" onClick={() => navigate("/add", { state: { parsed: p, inboxId: item.id } })}>Review and add</button>
                <button className="btn ghost" onClick={() => dismiss(item.id)}>Dismiss</button>
              </div>
            </article>
          );
        })
      )}
    </>
  );
}
