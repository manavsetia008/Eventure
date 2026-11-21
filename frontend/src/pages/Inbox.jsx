import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ExternalLink, Inbox as InboxIcon, Mail } from "lucide-react";
import { api } from "../api";
import Chip from "../components/Chip.jsx";
import { cap, fmtRange, timeAgo } from "../utils";

export default function Inbox() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [filter, setFilter] = useState("all");
  const [readIds, setReadIds] = useState(() => new Set());
  const [selectedId, setSelectedId] = useState(null);

  const load = useCallback(() => api.get("/inbox").then(setData).catch((e) => setError(e.message)), []);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (copied) {
      const id = setTimeout(() => setCopied(false), 2000);
      return () => clearTimeout(id);
    }
  }, [copied]);

  async function dismiss(id) {
    setError("");
    try {
      await api.post(`/inbox/${id}/dismiss`);
      await load();
    } catch (e) {
      setError(e.message);
    }
  }

  if (!data) {
    return error ? (
      <p className="error">{error}</p>
    ) : (
      <div className="page-loading-state">Loading your inbox...</div>
    );
  }

  const address = data.forwarding_address;
  const items = data.items || [];
  const visible = filter === "unread" ? items.filter((i) => !readIds.has(i.id)) : items;
  const selected = items.find((i) => i.id === selectedId) || null;

  function selectItem(item) {
    setSelectedId(item.id);
    setReadIds((prev) => {
      const next = new Set(prev);
      next.add(item.id);
      return next;
    });
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Inbox</h1>
          <p className="muted small">Forwarded event emails and announcements land here for review.</p>
        </div>
      </div>

      {address && (
        <div className="forward-row">
          <div className="forward-row-text">
            <span className="forward-row-label">Forwarding address</span>
            <span className="forward-row-hint muted small">
              Forward event emails to this address and they appear here.
            </span>
          </div>
          <div className="forward-row-actions">
            <input
              readOnly
              value={address}
              onFocus={(e) => e.target.select()}
              aria-label="Your forwarding address"
              className="mono"
            />
            <button
              className="btn secondary small"
              onClick={() => navigator.clipboard.writeText(address).then(() => setCopied(true))}
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      )}

      {error && <p className="error">{error}</p>}

      {items.length === 0 ? (
        <div className="card empty">
          <InboxIcon size={22} strokeWidth={1.75} />
          <p>You&apos;re all caught up</p>
        </div>
      ) : (
        <>
          <div className="row tabs inbox-filters">
            <button
              type="button"
              className={"tab" + (filter === "all" ? " on" : "")}
              onClick={() => setFilter("all")}
            >
              All
            </button>
            <button
              type="button"
              className={"tab" + (filter === "unread" ? " on" : "")}
              onClick={() => setFilter("unread")}
            >
              Unread
            </button>
          </div>

          <div className="inbox-layout">
            <div className="inbox-list">
              {visible.length === 0 ? (
                <p className="muted small inbox-list-empty">No unread items.</p>
              ) : (
                visible.map((item) => {
                  const p = item.parsed || {};
                  const unread = !readIds.has(item.id);
                  return (
                    <button
                      type="button"
                      key={item.id}
                      className={"inbox-row" + (item.id === selectedId ? " active" : "")}
                      onClick={() => selectItem(item)}
                    >
                      <span className="inbox-row-icon" aria-hidden="true">
                        <Mail size={16} strokeWidth={1.75} />
                      </span>
                      <span className="inbox-row-body">
                        <span className="inbox-row-title">{p.title || item.subject || "Untitled event"}</span>
                        <span className="inbox-row-preview">{item.sender || "Unknown sender"}</span>
                      </span>
                      <span className="inbox-row-meta">
                        <span className="inbox-row-time">{timeAgo(item.created_at)}</span>
                        {unread && <span className="inbox-unread-dot" aria-label="Unread" />}
                      </span>
                    </button>
                  );
                })
              )}
            </div>

            <div className="inbox-detail">
              {!selected ? (
                <div className="card empty">
                  <p className="muted">Select an email to review its details.</p>
                </div>
              ) : (
                <article className="card">
                  <div className="card-head">
                    <div>
                      <h3>{selected.parsed?.title || selected.subject || "Untitled event"}</h3>
                      <p className="muted small">From {selected.sender || "unknown sender"}</p>
                    </div>
                    <div className="pills">
                      {selected.parsed?.platform && <Chip label={selected.parsed.platform} />}
                      {selected.parsed?.category && <Chip label={cap(selected.parsed.category)} />}
                    </div>
                  </div>
                  <ul className="facts">
                    <li>
                      <b>When</b>: {selected.parsed?.start_at ? fmtRange(selected.parsed.start_at, selected.parsed.end_at) : "Not found in email"}
                    </li>
                    {selected.parsed?.venue_name && <li><b>Where</b>: {selected.parsed.venue_name}</li>}
                    {selected.parsed?.registration_deadline && (
                      <li><b>Deadline</b>: {fmtRange(selected.parsed.registration_deadline)}</li>
                    )}
                    {selected.parsed?.url && (
                      <li>
                        <b>Official link</b>:{" "}
                        <a
                          href={selected.parsed.url.startsWith("http") ? selected.parsed.url : `https://${selected.parsed.url}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {selected.parsed.url} ↗
                        </a>
                      </li>
                    )}
                  </ul>
                  <div className="row inbox-detail-actions">
                    {selected.parsed?.url && (
                      <a
                        href={selected.parsed.url.startsWith("http") ? selected.parsed.url : `https://${selected.parsed.url}`}
                        target="_blank"
                        rel="noreferrer"
                        className="btn tertiary small"
                      >
                        Open page <ExternalLink size={12} />
                      </a>
                    )}
                    <button
                      className="btn small"
                      onClick={() =>
                        navigate("/add", { state: { parsed: selected.parsed, inboxId: selected.id } })
                      }
                    >
                      Review and add
                    </button>
                    <button className="btn ghost small" onClick={() => dismiss(selected.id)}>Dismiss</button>
                  </div>
                </article>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
