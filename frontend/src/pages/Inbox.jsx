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

  if (!data) return error ? <p className="error">{error}</p> : <p className="muted center">Loading your inbox...</p>;
  const address = data.forwarding_address;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Forwarded Inbox</h1>
          <p className="muted small">Forward event announcements or confirmation emails here for automated extraction.</p>
        </div>
      </div>

      <section className="card">
        <h2>Private forwarding address</h2>
        {address ? (
          <>
            <p className="muted small">
              Forward any event email, registration confirmation or organizer newsletter to your private address.
              Details are parsed automatically so you can confirm and add them to your timeline.
            </p>
            <div className="row">
              <input readOnly value={address} onFocus={(e) => e.target.select()} aria-label="Your forwarding address" className="mono" />
              <button
                className="btn small"
                onClick={() => navigator.clipboard.writeText(address).then(() => setCopied(true))}
              >
                {copied ? "Copied" : "Copy address"}
              </button>
            </div>
            <p className="muted small" style={{ marginTop: ".4rem", marginBottom: 0 }}>
              Only emails sent to this private address reach your inbox. Keep it private.
            </p>
          </>
        ) : (
          <p className="muted small">
            Email forwarding is not enabled on this server yet (admin sets <code>INBOX_ADDRESS</code> in .env).
            You can still use <Link to="/add">Add event</Link> to paste text directly.
          </p>
        )}
      </section>

      {error && <p className="error">{error}</p>}

      <h2>Pending items</h2>
      {data.items.length === 0 ? (
        <div className="card empty">
          <p>No pending emails in your inbox.</p>
        </div>
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
                <li><b>When</b>: {p.start_at ? fmtRange(p.start_at, p.end_at) : "Not found in email"}</li>
                {p.venue_name && <li><b>Where</b>: {p.venue_name}</li>}
                {p.registration_deadline && <li><b>Deadline</b>: {fmtRange(p.registration_deadline)}</li>}
              </ul>
              <div className="row">
                <button
                  className="btn small"
                  onClick={() => navigate("/add", { state: { parsed: p, inboxId: item.id } })}
                >
                  Review and add
                </button>
                <button className="btn ghost small" onClick={() => dismiss(item.id)}>Dismiss</button>
              </div>
            </article>
          );
        })
      )}
    </>
  );
}
