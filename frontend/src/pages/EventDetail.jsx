import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ExternalLink, Languages, Volume2 } from "lucide-react";
import { api, translateText, textToSpeech } from "../api";
import { cap, fmtDuration, fmtRange } from "../utils";
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

  const load = useCallback(() => api.get(`/events/${id}`).then((res) => {
    setData(res);
    setUrlInput(res.event.url || "");
  }).catch((e) => setError(e.message)), [id]);
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
