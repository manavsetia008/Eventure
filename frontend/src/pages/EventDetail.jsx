import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Calendar, CalendarPlus, ExternalLink, Languages, PhoneCall, Star, Volume2 } from "lucide-react";
import { api, translateText, textToSpeech } from "../api";
import { cap, fmtDuration, fmtRange, getGoogleCalendarUrl, getMicrosoftCalendarUrl } from "../utils";
import HackathonVault from "../components/HackathonVault.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import Chip from "../components/Chip.jsx";
import Badge from "../components/Badge.jsx";
import ConfirmDialog from "../components/ConfirmDialog.jsx";

const SCALE = [1, 2, 3, 4, 5];

export default function EventDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ organisation: 4, learning: 4, value: 4, comment: "" });
  const [editingUrl, setEditingUrl] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [translatedDesc, setTranslatedDesc] = useState("");
  const [translating, setTranslating] = useState(false);
  const [playingAudio, setPlayingAudio] = useState(false);
  const [confirmDeleteReview, setConfirmDeleteReview] = useState(false);
  const [sarvamReady, setSarvamReady] = useState(false);
  const [topPriority, setTopPriority] = useState(null);
  const [calling, setCalling] = useState(false);
  const [phonePrompt, setPhonePrompt] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");

  useEffect(() => {
    api.get("/health")
      .then((r) => setSarvamReady(Boolean(r?.sarvamAuth)))
      .catch(() => {});
  }, []);

  async function handleTranslate() {
    if (!ev?.description) return;
    if (translatedDesc) {
      setTranslatedDesc(""); // toggle back to original
      return;
    }
    setTranslating(true);
    try {
      const res = await translateText(ev.description, "hi-IN");
      if (res?.translated_text) {
        setTranslatedDesc(res.translated_text);
      }
    } catch (e) {
      setError(e.message || "Translation failed");
    } finally {
      setTranslating(false);
    }
  }

  async function handleTTS() {
    const textToSpeak = translatedDesc || ev?.description || ev?.title;
    if (!textToSpeak) return;
    setPlayingAudio(true);
    try {
      const res = await textToSpeech(textToSpeak, "hi-IN");
      if (res?.audio) {
        const audio = new Audio(`data:audio/wav;base64,${res.audio}`);
        audio.onended = () => setPlayingAudio(false);
        audio.onerror = () => setPlayingAudio(false);
        await audio.play();
      } else {
        setPlayingAudio(false);
      }
    } catch {
      setPlayingAudio(false);
    }
  }

  const load = useCallback(() => {
    api.get(`/events/${id}`).then((res) => {
      setData(res);
      setUrlInput(res.event.url || "");
    }).catch((e) => setError(e.message));
    api.get("/top-priority").then((r) => {
      setTopPriority(r?.top_priority || null);
    }).catch(() => {});
  }, [id]);
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
          {ev.platform && <Chip label={ev.platform} />}
          <Chip label={cap(ev.category)} />
        </div>
      </div>
      {error && <p className="error">{error}</p>}

      <section className="card">
        {ev.description && (
          <div className="event-desc-block">
            <p className="event-desc-text">
              {translatedDesc || ev.description}
            </p>
            {sarvamReady && (
              <div className="event-desc-actions">
                <button
                  type="button"
                  className="btn secondary small event-tool-btn"
                  onClick={handleTranslate}
                  disabled={translating}
                >
                  <Languages size={14} />
                  <span>{translating ? "Translating..." : translatedDesc ? "Show English" : "Translate (Hindi)"}</span>
                </button>
                <button
                  type="button"
                  className="btn secondary small event-tool-btn"
                  onClick={handleTTS}
                  disabled={playingAudio}
                >
                  <Volume2 size={14} />
                  <span>{playingAudio ? "Playing audio..." : "Listen to summary"}</span>
                </button>
              </div>
            )}
          </div>
        )}
        <ul className="facts">
          {ev.club_name && <li><b>Organised by</b> {ev.club_name}</li>}
          {ev.distance_km != null && <li><b>From your college</b> {ev.distance_km} km, about {fmtDuration(ev.travel_minutes)} by road</li>}
          {ev.registration_deadline && <li><b>Register by</b> {fmtRange(ev.registration_deadline)}</li>}
          <li>
            <b>Official portal link: </b>
            {ev.url ? (
              <span>
                <a href={ev.url.startsWith("http") ? ev.url : `https://${ev.url}`} target="_blank" rel="noreferrer">
                  {ev.url} ↗
                </a>
                <button
                  type="button"
                  className="linklike small muted event-change-link"
                  onClick={() => { setUrlInput(ev.url || ""); setEditingUrl(true); }}
                >
                  Change link
                </button>
              </span>
            ) : (
              <span>
                <span className="muted">No link attached yet. </span>
                {!editingUrl && (
                  <button type="button" className="linklike small" onClick={() => setEditingUrl(true)}>
                    + Add official link
                  </button>
                )}
              </span>
            )}
          </li>
        </ul>

        {editingUrl && (
          <div className="row small event-url-edit">
            <input
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="Paste official event URL (https://...)"
              aria-label="Official event URL"
            />
            <button
              type="button"
              className="btn small"
              onClick={() => {
                run(() => api.put(`/events/${ev.id}`, { url: urlInput.trim() }));
                setEditingUrl(false);
              }}
            >
              Save link
            </button>
            <button
              type="button"
              className="btn ghost small"
              onClick={() => setEditingUrl(false)}
            >
              Cancel
            </button>
          </div>
        )}

        {/* Top Priority 24h Voice Call Alert Banner */}
        {topPriority && topPriority.event_id === ev.id && (
          <div className="card" style={{ background: "rgba(99, 102, 241, 0.08)", border: "1px solid var(--accent)", padding: "1rem", margin: "1rem 0" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <Star size={18} color="gold" fill="gold" />
                <strong>Top-Priority Event (Only 1 Allowed)</strong>
              </div>
              <span className="pill ok" style={{ fontSize: "0.75rem" }}>Voice Call Armed</span>
            </div>
            <p className="small muted" style={{ margin: "0.5rem 0" }}>
              📞 An automated Sarvam Indic voice call is scheduled <b>exactly 24 hours</b> before the latest deadline: <b>{topPriority.scheduled_call_at?.replace("T", " ").slice(0, 16)}</b>.
              {topPriority.phone_number ? ` Recipient: ${topPriority.phone_number}` : ""}
            </p>
            <div className="row small" style={{ marginTop: "0.5rem" }}>
              <button
                type="button"
                className="btn secondary small"
                disabled={calling}
                onClick={async () => {
                  setCalling(true);
                  try {
                    const res = await api.post("/top-priority/test-call");
                    alert(`📞 Voice call test executed! Status: ${res.call_result?.status}. ${res.call_result?.message ? `Script: "${res.call_result.message.slice(0, 100)}..."` : ""}`);
                    if (res.call_result?.audio) {
                      const audio = new Audio(`data:audio/wav;base64,${res.call_result.audio}`);
                      audio.play().catch(() => {});
                    }
                  } catch (e) {
                    setError(e.message);
                  } finally {
                    setCalling(false);
                  }
                }}
              >
                <PhoneCall size={13} />
                <span>{calling ? "Calling..." : "Test Sarvam Voice Call Now"}</span>
              </button>
              <button
                type="button"
                className="btn ghost small"
                onClick={async () => {
                  if (window.confirm("Remove this event from top priority?")) {
                    await api.del("/top-priority");
                    setTopPriority(null);
                  }
                }}
              >
                Remove Top Priority
              </button>
            </div>
          </div>
        )}

        {/* Set as Top Priority Prompt Modal / Form */}
        {phonePrompt && (
          <div className="card" style={{ background: "var(--surface)", border: "1px dashed var(--accent)", padding: "1rem", margin: "1rem 0" }}>
            <h4 style={{ margin: "0 0 0.5rem 0" }}>⭐ Set as Your Top-Priority Event</h4>
            <p className="small muted" style={{ margin: "0 0 0.8rem 0" }}>
              Only one event can be top priority at a time (setting this will replace any existing one). You will receive an automated Sarvam Indic voice phone call exactly 24 hours before the latest deadline!
            </p>
            <div className="row small">
              <input
                type="tel"
                placeholder="Enter 10-digit phone number (optional)"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                style={{ maxWidth: "280px" }}
              />
              <button
                type="button"
                className="btn small"
                onClick={async () => {
                  try {
                    const res = await api.post("/top-priority/set", {
                      event_id: ev.id,
                      phone_number: phoneNumber,
                    });
                    setTopPriority(res.top_priority);
                    setPhonePrompt(false);
                    load();
                  } catch (e) {
                    setError(e.message);
                  }
                }}
              >
                Confirm & Schedule 24h Voice Call
              </button>
              <button type="button" className="btn ghost small" onClick={() => setPhonePrompt(false)}>
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="row event-actions-row">
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
          
          {/* Direct 1-Click Calendar Add Redirect Links */}
          <a
            href={getGoogleCalendarUrl(ev)}
            target="_blank"
            rel="noreferrer"
            className="btn-tertiary"
            title="Direct 1-click redirect to add to Google Calendar"
          >
            <Calendar size={13} />
            <span>Add to Google Calendar</span>
          </a>

          <a
            href={getMicrosoftCalendarUrl(ev)}
            target="_blank"
            rel="noreferrer"
            className="btn-tertiary"
            title="Direct 1-click redirect to add to Microsoft Outlook Calendar"
          >
            <CalendarPlus size={13} />
            <span>Add to Outlook</span>
          </a>

          {/* Top Priority Action Button */}
          {(!topPriority || topPriority.event_id !== ev.id) && (
            <button
              type="button"
              className="btn secondary"
              onClick={() => setPhonePrompt(true)}
              title="Designate as your single top priority event with free 24-hour Sarvam voice call"
            >
              <Star size={14} color="gold" />
              <span>{topPriority ? "Replace as Top Priority (24h Call)" : "⭐ Top Priority (Free 24h Call)"}</span>
            </button>
          )}

          {!mine.status && <button className="btn" onClick={() => run(() => api.post(`/events/${ev.id}/join`, { status: "registered" }))}>Add to timeline as registered</button>}
          {!mine.status && <button className="btn ghost" onClick={() => run(() => api.post(`/events/${ev.id}/join`, { status: "interested" }))}>Just interested</button>}
          {mine.status && mine.status !== "attended" && (
            <button className="btn" onClick={() => run(() => api.patch(`/user-events/${mine.user_event_id}`, { status: "attended" }))}>I attended this</button>
          )}
          {mine.status && <Badge variant="info">On timeline: {mine.status}</Badge>}
          {mine.is_owner && <Link className="btn ghost" to={`/events/${ev.id}/edit`}>Edit details</Link>}
        </div>

        {mine.user_event_id && ev.category === "hackathon" && (
          <HackathonVault
            userEventId={mine.user_event_id}
            initialNotes={mine.notes || ""}
            onUpdate={() => load()}
          />
        )}
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
            <p className="review-head">
              <b>{r.author}</b>{r.college ? `, ${r.college}` : ""}{" "}
              <StatusBadge variant="active" label="Verified Attendee" />
              <span className="muted small">{r.overall} / 5</span>
            </p>
            {r.comment && <p>{r.comment}</p>}
            {r.mine && <button className="linklike small" onClick={() => setConfirmDeleteReview(true)}>Delete my review</button>}
          </article>
        ))}

        {mine.can_review ? (
          <form className="card" onSubmit={(e) => { e.preventDefault(); run(() => api.post(`/events/${ev.id}/reviews`, form)); }}>
            <h3>Rate this event</h3>
            <div className="grid3">
              {[["organisation", "Organisation"], ["learning", "Learning"], ["value", "Worth the trip"]].map(([k, label]) => (
                <label key={k}>{label}
                  <select className="clean-select" value={form[k]} onChange={(e) => setForm({ ...form, [k]: Number(e.target.value) })}>{SCALE.map((n) => <option key={n} value={n}>{n}</option>)}</select>
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

      <ConfirmDialog
        open={confirmDeleteReview}
        title="Delete review"
        message="Delete your review? This cannot be undone."
        confirmLabel="Delete"
        onCancel={() => setConfirmDeleteReview(false)}
        onConfirm={() => {
          setConfirmDeleteReview(false);
          run(() => api.del(`/events/${ev.id}/reviews/mine`));
        }}
      />
    </>
  );
}
