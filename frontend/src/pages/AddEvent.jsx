import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { AlertCircle, FileText, MessageSquare, Upload } from "lucide-react";
import { api } from "../api";
import EventForm, { BLANK } from "../components/EventForm.jsx";
import Badge from "../components/Badge.jsx";
import DoodleHeading from "../components/ui/DoodleHeading.jsx";
import { toInput } from "../utils";

function fromParsed(parsed) {
  return {
    ...BLANK,
    title: parsed.title || "",
    platform: parsed.platform || "",
    category: parsed.category || "other",
    venue_name: parsed.venue_name || "",
    start_at: toInput(parsed.start_at),
    end_at: toInput(parsed.end_at),
    registration_deadline: toInput(parsed.registration_deadline),
    url: parsed.url || "",
    description: parsed.description || "",
    stages: (parsed.stages || [])
      .filter((s) => s.name !== "Register")
      .map((s) => ({ name: s.name, due_at: toInput(s.due_at) })),
  };
}

export default function AddEvent() {
  const location = useLocation();
  const fromInbox = location.state?.parsed || null;
  const inboxId = location.state?.inboxId || null;

  const [text, setText] = useState("");
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [initial, setInitial] = useState(fromInbox ? fromParsed(fromInbox) : null);
  const [source, setSource] = useState(fromInbox ? fromInbox.source || "" : "");
  const [portals, setPortals] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const [extracted, setExtracted] = useState(null);

  const fileInputRef = useRef(null);

  useEffect(() => {
    api
      .get("/portals")
      .then((r) => setPortals(r.portals || []))
      .catch(() => {});
  }, []);

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f && f.type.startsWith("image/")) setFile(f);
  }

  async function read() {
    setError("");
    setBusy(true);
    setExtracted(null);
    try {
      const fd = new FormData();
      if (text.trim()) fd.append("text", text);
      if (file) fd.append("image", file);
      const { parsed } = await api.upload("/extract", fd);
      setSource(parsed.source);
      setExtracted(parsed);
      setInitial(fromParsed(parsed));
    } catch (e) {
      setError(e.message || "Failed to extract event details");
    } finally {
      setBusy(false);
    }
  }

  async function save(payload) {
    setError("");
    setSaving(true);
    try {
      await api.post("/events", { ...payload, inbox_item_id: inboxId });
      setSaving(false);
      setSaved(true);
    } catch (err) {
      setError(err.message || "Could not save. Check your connection and try again.");
      setSaving(false);
    }
  }

  function loadHinglishSample() {
    setText(
      "Campus Tech Challenge 2026:\n" +
        "Venue: Main Campus, Audi 2\n" +
        "Starts: 21 Nov 2026, 12:00 PM | Ends: 22 Nov 2026, 02:00 PM\n" +
        "Abstract submission deadline: 18 Nov 11:59 PM\n" +
        "Official website: https://unstop.com/hackathons/campus-tech-challenge-2026\n" +
        "Final round shortlisted teams must present live demo on Sunday 10:00 AM."
    );
  }

  function loadWhatsAppNotice() {
    setText(
      "Forwarded message:\n" +
        "Kal 2 baje Audi 2 me hackathon kickoff aur stage 1 abstract review hai. PPT le aana aur team checklist verify kar lena.\n" +
        "Registrations deadline tonight 11:59 PM.\n" +
        "Registration link: https://unstop.com/hackathons/campus-hackathon-2026"
    );
  }

  const detailFields = [
    "title",
    "platform",
    "category",
    "venue_name",
    "start_at",
    "end_at",
    "registration_deadline",
    "url",
    "description",
    "stages",
  ];
  const extractedCount = extracted
    ? detailFields.filter((k) => {
        const v = extracted[k];
        return Array.isArray(v) ? v.length > 0 : Boolean(v);
      }).length
    : 0;

  const notice = saved ? (
    <div className="notice mb-4">
      <strong>Saved</strong>
      <p className="add-event-notice-line">
        This event is now on your timeline.
      </p>
    </div>
  ) : source ? (
    <div className="notice mb-4">
      <strong>{extractedCount > 0 ? `${extractedCount} details found` : "Details extracted"}</strong>
      <p className="add-event-notice-line">
        Review title, dates, venue, and deadlines below. You can edit any field before confirming.
      </p>
    </div>
  ) : null;

  if (initial) {
    return (
      <div className="add-event-container">
        <div className="page-head">
          <div>
            <h1>{saved ? "Event saved" : "Review extracted details"}</h1>
            <p className="muted small">
              {saved ? "You can view it on your timeline." : "Check everything below, then confirm to add to your timeline."}
            </p>
          </div>
        </div>
        <EventForm
          initial={initial}
          mode="add"
          notice={notice}
          saving={saving}
          saved={saved}
          error={error}
          submitLabel="Confirm and add"
          onSubmit={save}
          onBack={() => {
            setInitial(null);
            setExtracted(null);
            setSaved(false);
            setError("");
          }}
        />
        {saved && (
          <div className="add-event-saved-row">
            <Link to="/" className="btn small">View on timeline</Link>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="add-event-container">
      <div className="page-head">
        <div>
          <DoodleHeading text="Add an event" mascot="mushroom" />
          <p className="muted small">Paste event text, upload a poster, or enter details by hand.</p>
        </div>
      </div>

      <div className="add-event-grid">
        {/* ── LEFT COLUMN: Input ── */}
        <div className="add-event-left">
          <div className="card add-event-input-card">
            <div className="add-event-card-header">
              <div>
                <h2>Import from announcement or poster</h2>
                <p className="muted small">Title, dates, venue, deadlines and the registration link are filled in for you.</p>
              </div>
            </div>

            {/* Sample chips */}
            <div className="sample-chips-row">
              <button type="button" className="sample-chip-btn" onClick={loadHinglishSample}>
                <FileText size={14} strokeWidth={1.75} />
                <span>Paste formal notice</span>
              </button>
              <button type="button" className="sample-chip-btn" onClick={loadWhatsAppNotice}>
                <MessageSquare size={14} strokeWidth={1.75} />
                <span>Paste Hinglish WhatsApp forward</span>
              </button>
            </div>

            <label className="field-label">
              <span>Event text or forwarded circular</span>
              <textarea
                rows={6}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={"Tech Fest 2026\nVenue: Main Campus Audi\n21 Nov 2026, 10:00 AM to 6:00 PM\nRegistrations close 18 Nov\nLink: https://unstop.com/..."}
                className="clean-textarea"
              />
            </label>

            {/* Drag-drop zone (no default file button) */}
            <div
              className={`clean-dropzone${dragOver ? " drag-over" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              role="button"
              tabIndex={0}
              aria-label="Upload poster or flyer screenshot"
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click();
              }}
            >
              <div className="dropzone-icon-box">
                <Upload size={22} strokeWidth={1.75} />
              </div>
              {file ? (
                <div className="dropzone-file-selected">
                  <span className="dropzone-filename">{file.name}</span>
                  <button
                    type="button"
                    className="dropzone-remove-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFile(null);
                    }}
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <>
                  <div className="dropzone-main-text">Drop poster or screenshot here</div>
                  <div className="dropzone-sub-text">or click to browse from device (PNG, JPG, WEBP)</div>
                </>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="file-input-hidden"
              onChange={(e) => setFile(e.target.files[0] || null)}
            />

            {error && (
              <div className="field-error-msg" role="alert">
                <AlertCircle size={15} strokeWidth={2} className="field-error-icon" />
                <span>{error}</span>
              </div>
            )}

            <div className="add-event-btn-row">
              <button
                type="button"
                className="btn"
                onClick={read}
                disabled={busy || (!text.trim() && !file)}
              >
                <FileText size={15} strokeWidth={1.75} />
                <span>{busy ? "Reading details..." : "Read details"}</span>
              </button>
              <button
                type="button"
                className="btn secondary"
                onClick={() => {
                  setInitial({ ...BLANK });
                  setSource("manual");
                }}
              >
                Fill in manually
              </button>
            </div>
          </div>

          {/* Portal chips card */}
          {portals.length > 0 && (
            <div className="card add-event-portals-card">
              <div className="portals-card-label">Or create directly for your tracked platforms:</div>
              <div className="portal-chips-list">
                {portals.map((p) => {
                  const mono = (p.name || "EV").slice(0, 2).toUpperCase();
                  return (
                    <button
                      key={p.id}
                      type="button"
                      className="portal-chip-item"
                      onClick={() => {
                        setInitial({ ...BLANK, platform: p.name });
                        setSource("portal");
                      }}
                    >
                      <span className="portal-monogram-sq">{mono}</span>
                      <span>{p.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT COLUMN: Extracted Preview ── */}
        <div className="add-event-right">
          <div className="clean-preview-panel">
            <div className="preview-panel-head">
              <span className="preview-panel-title">Preview</span>
              {extracted && <Badge variant="success">Ready</Badge>}
            </div>

            {busy ? (
              <div className="preview-panel-empty">
                <div className="preview-spinner" />
                <p>Reading circular text & poster details...</p>
              </div>
            ) : extracted ? (
              <div className="preview-panel-body">
                {extracted.title && (
                  <div className="preview-meta-row">
                    <span className="preview-meta-label">Title</span>
                    <span className="preview-meta-val">{extracted.title}</span>
                  </div>
                )}
                {extracted.venue_name && (
                  <div className="preview-meta-row">
                    <span className="preview-meta-label">Venue</span>
                    <span className="preview-meta-val">{extracted.venue_name}</span>
                  </div>
                )}
                {extracted.start_at && (
                  <div className="preview-meta-row">
                    <span className="preview-meta-label">Start time</span>
                    <span className="preview-meta-val">
                      {new Date(extracted.start_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
                    </span>
                  </div>
                )}
                {extracted.registration_deadline && (
                  <div className="preview-meta-row">
                    <span className="preview-meta-label">Deadline</span>
                    <span className="preview-meta-val">
                      {new Date(extracted.registration_deadline).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
                    </span>
                  </div>
                )}
                {extracted.url && (
                  <div className="preview-meta-row">
                    <span className="preview-meta-label">Link</span>
                    <a href={extracted.url} target="_blank" rel="noreferrer" className="preview-meta-link">
                      {extracted.url.length > 36 ? extracted.url.slice(0, 36) + "..." : extracted.url}
                    </a>
                  </div>
                )}
                {extracted.stages?.length > 0 && (
                  <div className="preview-meta-row add-event-preview-stages">
                    <span className="preview-meta-label">Milestone Stages ({extracted.stages.length})</span>
                    <div className="preview-stages-box">
                      {extracted.stages.map((stg, i) => (
                        <div key={i} className="preview-stage-row">
                          <span className="preview-stage-name">{stg.name}</span>
                          {stg.due_at && (
                            <span className="preview-stage-date">
                              {new Date(stg.due_at).toLocaleDateString([], { month: "short", day: "numeric" })}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="preview-hint-strip">
                  Details successfully extracted. Click <b>Confirm and add</b> to finalize.
                </div>
              </div>
            ) : (
              <div className="preview-panel-empty">
                <div className="preview-empty-icon">
                  <FileText size={32} strokeWidth={1.75} />
                </div>
                <div className="preview-empty-title">Details will appear here</div>
                <p className="preview-empty-sub">
                  Paste notice text or drop a flyer image on the left, then click &ldquo;Read details&rdquo;.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
