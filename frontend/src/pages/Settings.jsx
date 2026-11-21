import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Bell,
  Calendar,
  Check,
  ChevronDown,
  Layers,
  Loader2,
  Rss,
  Search,
  ShieldAlert,
  Sliders,
  Trash2,
  User,
  X,
} from "lucide-react";
import { api, calendarFeedUrl } from "../api";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import Badge from "../components/Badge.jsx";
import Notice from "../components/Notice.jsx";
import Checkbox from "../components/Checkbox.jsx";
import Radio from "../components/Radio.jsx";
import { fmtExamRange, timeAgo } from "../utils";

const CAMPUS_PRESETS = [
  "Main Campus",
  "North Campus",
  "South Campus",
  "City Campus",
  "Other (enter manually)",
];

/* ============================================================
   Campus Combobox (Searchable Select)
   ============================================================ */
function CampusCombobox({ value, onChange, onManualChange, manualValue }) {
  const [query, setQuery] = useState(value || "");
  const [isOpen, setIsOpen] = useState(false);
  const [isManual, setIsManual] = useState(
    value === "Other (enter manually)" || (!CAMPUS_PRESETS.includes(value) && Boolean(value))
  );
  const ref = useRef(null);

  useEffect(() => {
    if (value && !isManual) {
      setQuery(value);
    }
  }, [value, isManual]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = CAMPUS_PRESETS.filter((p) =>
    p.toLowerCase().includes((query || "").toLowerCase())
  );

  const selectPreset = (p) => {
    if (p === "Other (enter manually)") {
      setIsManual(true);
      onChange("Other (enter manually)");
      setQuery("Other (enter manually)");
    } else {
      setIsManual(false);
      onChange(p);
      setQuery(p);
    }
    setIsOpen(false);
  };

  return (
    <div ref={ref} className="campus-combobox">
      <div className="campus-combobox-input-wrap">
        <Search size={15} className="campus-combobox-icon-left" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder="Search your campus"
          aria-label="Search your campus"
        />
        <button
          type="button"
          className="campus-combobox-icon-right"
          onClick={() => setIsOpen((prev) => !prev)}
          aria-label="Toggle campus options"
        >
          <ChevronDown size={15} />
        </button>
      </div>

      {isOpen && (
        <div className="campus-combobox-dropdown" role="listbox">
          {filtered.map((item) => (
            <div
              key={item}
              role="option"
              tabIndex={0}
              aria-selected={item === value}
              className={`campus-combobox-item ${item === value ? "selected" : ""}`}
              onClick={() => selectPreset(item)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  selectPreset(item);
                }
              }}
            >
              {item}
            </div>
          ))}
          {filtered.length === 0 && (
            <div
              role="option"
              tabIndex={0}
              aria-selected={false}
              className="campus-combobox-item"
              onClick={() => selectPreset("Other (enter manually)")}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  selectPreset("Other (enter manually)");
                }
              }}
            >
              Other (enter manually)
            </div>
          )}
        </div>
      )}

      {isManual && (
        <div className="settings-manual-campus">
          <label className="settings-field-label settings-manual-campus-label" htmlFor="campus-manual-input">
            Campus name or address
          </label>
          <input
            id="campus-manual-input"
            type="text"
            value={manualValue}
            onChange={(e) => onManualChange(e.target.value)}
            placeholder="e.g. Stanford University or 123 University Ave"
            aria-label="Campus name or address"
          />
        </div>
      )}
    </div>
  );
}

/* ============================================================
   Tag Input (Interests Chips)
   ============================================================ */
function TagInput({ tags, onChange }) {
  const [inputVal, setInputVal] = useState("");

  const handleKeyDown = (e) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const clean = inputVal.trim().replace(/^,+|,+$/g, "");
      if (clean && !tags.includes(clean)) {
        onChange([...tags, clean]);
      }
      setInputVal("");
    } else if (e.key === "Backspace" && !inputVal && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  };

  const removeTag = (idx) => {
    onChange(tags.filter((_, i) => i !== idx));
  };

  return (
    <div>
      <div className="tag-input-box">
        {tags.map((t, idx) => (
          <span key={idx} className="tag-chip">
            <span>{t}</span>
            <button
              type="button"
              className="tag-chip-del"
              onClick={() => removeTag(idx)}
              aria-label={`Remove tag ${t}`}
            >
              <X size={12} strokeWidth={2.5} />
            </button>
          </span>
        ))}
        <input
          type="text"
          className="tag-bare-input"
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            const clean = inputVal.trim().replace(/^,+|,+$/g, "");
            if (clean && !tags.includes(clean)) {
              onChange([...tags, clean]);
            }
            setInputVal("");
          }}
          placeholder={tags.length === 0 ? "Type and press Enter (e.g. AI, Design, Robotics)" : "Add more..."}
        />
      </div>
      <p className="muted small settings-hint-top">
        Events matching these rank higher on your timeline.
      </p>
    </div>
  );
}

/* ============================================================
   PART 2: Profile & Campus
   ============================================================ */
function ProfileCard({ user, onRefresh, onDirtyChange }) {
  const [name, setName] = useState(user.name || "");
  const [selectedCampus, setSelectedCampus] = useState(user.college || "");
  const [manualCampus, setManualCampus] = useState(
    CAMPUS_PRESETS.includes(user.college) ? "" : user.college || ""
  );
  const [goals, setGoals] = useState(Array.isArray(user.goals) ? user.goals : []);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const resolvedCollege =
    selectedCampus === "Other (enter manually)" ? manualCampus.trim() : selectedCampus;

  const isPristine =
    name === (user.name || "") &&
    resolvedCollege === (user.college || "") &&
    JSON.stringify(goals) === JSON.stringify(user.goals || []);

  useEffect(() => {
    onDirtyChange?.(!isPristine);
  }, [isPristine, onDirtyChange]);

  // Clear a stale error as soon as the user edits anything.
  useEffect(() => {
    setError("");
  }, [name, selectedCampus, manualCampus, goals]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSaved(false);
    setSaving(true);
    try {
      await api.put("/auth/me", {
        name: name.trim(),
        college: resolvedCollege,
        goals,
      });
      await onRefresh();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err.message || "Something went wrong. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section id="profile" className="card settings-section-card">
      <div className="settings-card-head">
        <div>
          <h2>Profile</h2>
          <p className="muted small">Your details and campus for travel estimates.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="settings-form-body">
        <div className="settings-field">
          <label className="settings-field-label" htmlFor="settings-full-name">Full name</label>
          <input
            id="settings-full-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your full name"
            required
          />
        </div>

        <div className="settings-field">
          <label className="settings-field-label" htmlFor="settings-email">Email</label>
          <input id="settings-email" type="email" value={user.email} disabled className="muted" />
        </div>

        <div className="settings-field">
          <span className="settings-field-label">Campus</span>
          <CampusCombobox
            value={selectedCampus}
            onChange={setSelectedCampus}
            manualValue={manualCampus}
            onManualChange={setManualCampus}
          />
        </div>

        <div className="settings-field">
          <span className="settings-field-label">Interests</span>
          <TagInput tags={goals} onChange={setGoals} />
        </div>

        <div className="settings-action-row">
          <button type="submit" className="btn" disabled={isPristine || saving}>
            {saving ? <Loader2 size={15} className="spinner" /> : "Save changes"}
          </button>
          {saved && (
            <span className="settings-saved-inline">
              <Check size={14} /> Saved
            </span>
          )}
          {error && (
            <span className="settings-error-inline" role="alert">
              <AlertCircle size={14} /> {error}
            </span>
          )}
        </div>
      </form>
    </section>
  );
}

/* ============================================================
   PART 3: Scoring & Keep Threshold
   ============================================================ */
const SCORING_MODES = [
  {
    id: "balanced",
    title: "Balanced",
    desc: "Equal weight to your interests, deadlines, travel time and clashes.",
  },
  {
    id: "interest_first",
    title: "Interest first",
    desc: "Ranks events matching your focus areas at the top.",
  },
  {
    id: "deadline_first",
    title: "Deadline first",
    desc: "Prioritizes events with registrations closing soon.",
  },
  {
    id: "nearby_first",
    title: "Nearby first",
    desc: "Ranks events close to your campus higher to reduce travel.",
  },
];

function PriorityScoringCard({ user, onRefresh }) {
  const [mode, setMode] = useState(user.scoring_mode || "balanced");
  const [keepVal, setKeepVal] = useState(user.threshold_keep ?? 55);
  const [skipVal, setSkipVal] = useState(user.threshold_skip ?? 40);
  const [useMaybe, setUseMaybe] = useState(Boolean(user.use_maybe_range));
  const [events, setEvents] = useState([]);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get("/timeline")
      .then((r) => {
        if (r && Array.isArray(r.items)) setEvents(r.items);
      })
      .catch(() => {});
  }, []);

  const calculateCounts = () => {
    if (!events.length) {
      return { keep: 12, maybe: 4, skip: 8, sample: true };
    }
    let k = 0;
    let m = 0;
    let s = 0;
    events.forEach((ev) => {
      const score = ev.priority_score ?? ev.score ?? 50;
      if (useMaybe) {
        if (score >= keepVal) k++;
        else if (score <= skipVal) s++;
        else m++;
      } else {
        if (score >= keepVal) k++;
        else s++;
      }
    });
    return { keep: k, maybe: m, skip: s, sample: false };
  };

  const preview = calculateCounts();

  const handleSave = async (newMode, newKeep, newSkip, newMaybe) => {
    setError("");
    setSaved(false);
    setSaving(true);
    try {
      await api.put("/auth/me", {
        scoring_mode: newMode,
        threshold_keep: Number(newKeep),
        threshold_skip: Number(newSkip),
        use_maybe_range: Boolean(newMaybe),
      });
      await onRefresh();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err.message || "Failed to save scoring settings.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section id="scoring" className="card settings-section-card">
      <div className="settings-card-head">
        <div>
          <h2>Scoring</h2>
          <p className="muted small">Choose how events are ranked and when they are marked Keep.</p>
        </div>
      </div>

      <div className="settings-form-body">
        {/* Priority Mode Custom Radios */}
        <div className="settings-field">
          <span className="settings-field-label">Priority ranking mode</span>
          <div className="scoring-modes-grid" role="radiogroup" aria-label="Priority ranking mode">
            {SCORING_MODES.map((m) => {
              const selected = mode === m.id;
              return (
                <div
                  key={m.id}
                  className={`scoring-mode-card ${selected ? "selected" : ""}`}
                  onClick={() => {
                    setMode(m.id);
                    handleSave(m.id, keepVal, skipVal, useMaybe);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setMode(m.id);
                      handleSave(m.id, keepVal, skipVal, useMaybe);
                    }
                  }}
                  role="radio"
                  tabIndex={0}
                  aria-checked={selected}
                >
                  <Radio checked={selected} onChange={() => {}} name="scoring_mode" />
                  <div className="settings-flex-fill">
                    <div className="scoring-mode-title">{m.title}</div>
                    <p className="scoring-mode-desc">{m.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Keep Threshold Slider */}
        <div className="settings-field settings-field-mt-8">
          <div className="settings-row-between">
            <label className="settings-field-label" htmlFor="settings-keep-threshold">Keep score threshold</label>
            <button
              type="button"
              className="linklike small"
              onClick={() => {
                setKeepVal(55);
                setSkipVal(40);
                handleSave(mode, 55, 40, useMaybe);
              }}
            >
              Reset to default (55)
            </button>
          </div>

          <div className="scoring-slider-wrap">
            <input
              id="settings-keep-threshold"
              type="range"
              min="0"
              max="100"
              value={keepVal}
              className="custom-range-slider"
              onChange={(e) => setKeepVal(Number(e.target.value))}
              onMouseUp={() => handleSave(mode, keepVal, skipVal, useMaybe)}
              onTouchEnd={() => handleSave(mode, keepVal, skipVal, useMaybe)}
              aria-label="Keep score threshold"
            />
            <input
              type="number"
              min="0"
              max="100"
              value={keepVal}
              className="scoring-number-box"
              onChange={(e) => {
                const v = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                setKeepVal(v);
              }}
              onBlur={() => handleSave(mode, keepVal, skipVal, useMaybe)}
              aria-label="Keep threshold value"
            />
          </div>
        </div>

        {/* Use a Maybe Range Toggle */}
        <div className="settings-field settings-field-mt-4">
          <Checkbox
            id="toggle-maybe-range"
            checked={useMaybe}
            onChange={(val) => {
              setUseMaybe(val);
              handleSave(mode, keepVal, skipVal, val);
            }}
            label="Use a Maybe range for mid-priority events"
          />

          {useMaybe && (
            <div className="settings-maybe-range">
              <div className="settings-row-between-mb">
                <span className="muted small">Skip cutoff (Scores below this are marked Skip):</span>
                <span className="small settings-strong">{skipVal}</span>
              </div>
              <div className="scoring-slider-wrap">
                <input
                  type="range"
                  min="0"
                  max={Math.max(0, keepVal - 5)}
                  value={skipVal}
                  className="custom-range-slider"
                  onChange={(e) => setSkipVal(Number(e.target.value))}
                  onMouseUp={() => handleSave(mode, keepVal, skipVal, useMaybe)}
                  onTouchEnd={() => handleSave(mode, keepVal, skipVal, useMaybe)}
                  aria-label="Skip cutoff threshold"
                />
                <input
                  type="number"
                  min="0"
                  max={keepVal}
                  value={skipVal}
                  className="scoring-number-box"
                  onChange={(e) => {
                    const v = Math.max(0, Math.min(keepVal, Number(e.target.value) || 0));
                    setSkipVal(v);
                  }}
                  onBlur={() => handleSave(mode, keepVal, skipVal, useMaybe)}
                  aria-label="Skip cutoff value"
                />
              </div>
            </div>
          )}
        </div>

        {/* Live Preview Text */}
        <div className="scoring-preview-bar">
          <span>
            With this setting:{" "}
            <strong>{preview.keep} Keep</strong>
            {useMaybe && (
              <>
                , <strong>{preview.maybe} Maybe</strong>
              </>
            )}
            , <strong>{preview.skip} Skip</strong>
            {preview.sample && " (sample preview)"}
          </span>
        </div>

        <div className="settings-action-row">
          <button
            type="button"
            className="btn small"
            onClick={() => handleSave(mode, keepVal, skipVal, useMaybe)}
            disabled={saving}
          >
            {saving ? <Loader2 size={14} className="spinner" /> : "Save scoring"}
          </button>
          {saved && (
            <span className="settings-saved-inline">
              <Check size={14} /> Saved
            </span>
          )}
          {error && (
            <span className="settings-error-inline" role="alert">
              <AlertCircle size={14} /> {error}
            </span>
          )}
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   PART 4: Tracked Portals
   ============================================================ */
const DOMAIN_RE = /^([a-z0-9](-?[a-z0-9])*\.)+[a-z]{2,}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeDomain(raw) {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split(/[/?#]/)[0]
    .replace(/\s+/g, "");
}

function PortalsCard({ userEmail }) {
  const [portals, setPortals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncingId, setSyncingId] = useState(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newPortal, setNewPortal] = useState({ name: "", domain: "", email: userEmail || "" });
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    api
      .get("/portals")
      .then((r) => setPortals(r.portals || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const flashSaved = (text) => {
    setSaved(text);
    setTimeout(() => setSaved(""), 2500);
  };

  const openAddForm = () => {
    setError("");
    setNewPortal({ name: "", domain: "", email: userEmail || "" });
    setShowAdd(true);
  };

  const handleSync = async (p) => {
    setSyncingId(p.id);
    setError("");
    try {
      const res = await api.post(`/portals/${p.id}/sync`);
      flashSaved(res.message || `Synced with ${p.name}.`);
      load();
    } catch (e) {
      setError(e.message || "Failed to sync.");
    } finally {
      setSyncingId(null);
    }
  };

  const handleTogglePause = async (p) => {
    setError("");
    try {
      await api.patch(`/portals/${p.id}`, { auto_sync: !p.auto_sync });
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  const handleRemove = async (id) => {
    setError("");
    try {
      await api.del(`/portals/${id}`);
      setConfirmRemoveId(null);
      flashSaved("Portal removed.");
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    setError("");
    setSaved("");
    const name = newPortal.name.trim();
    const domain = normalizeDomain(newPortal.domain);
    const email = (newPortal.email.trim() || userEmail || "").trim();
    if (!name) return setError("Enter the portal name.");
    if (!domain) return setError("Enter the website domain (for example unstop.com).");
    if (!DOMAIN_RE.test(domain)) return setError("Enter a valid domain like unstop.com — no https:// needed.");
    if (email && !EMAIL_RE.test(email)) return setError("Enter a valid email address.");
    try {
      await api.post("/portals", { name, domain_or_name: domain, registered_email: email });
      setNewPortal({ name: "", domain: "", email: userEmail || "" });
      setShowAdd(false);
      flashSaved("Saved");
      load();
    } catch (err) {
      setError(err.message || "Failed to add portal.");
    }
  };

  return (
    <section id="portals" className="card settings-section-card">
      <div
        className="settings-card-head settings-card-head-split"
      >
        <div>
          <h2>Tracked portals</h2>
          <p className="muted small">Reads registration emails to track your event status.</p>
        </div>
        {!showAdd && (
          <button type="button" className="btn small" onClick={openAddForm}>
            Add portal
          </button>
        )}
      </div>

      {saved && (
        <div className="field-success-msg">
          <Check size={14} /> {saved}
        </div>
      )}
      {error && (
        <Notice
          variant="danger"
          title="Could not update portals"
          message={error}
          className="settings-inline-notice"
        />
      )}

      {showAdd && (
        <form onSubmit={handleAdd} className="settings-inline-form">
          <div className="grid2">
            <div>
              <label className="settings-field-label" htmlFor="settings-portal-name">Portal name</label>
              <input
                id="settings-portal-name"
                type="text"
                value={newPortal.name}
                onChange={(e) => setNewPortal({ ...newPortal, name: e.target.value })}
                placeholder="e.g. Unstop"
                required
              />
            </div>
            <div>
              <label className="settings-field-label" htmlFor="settings-portal-domain">Website domain</label>
              <input
                id="settings-portal-domain"
                type="text"
                value={newPortal.domain}
                onChange={(e) => setNewPortal({ ...newPortal, domain: e.target.value })}
                placeholder="e.g. unstop.com"
                required
              />
            </div>
          </div>
          <div>
            <label className="settings-field-label" htmlFor="settings-portal-email">Registered email</label>
            <input
              id="settings-portal-email"
              type="email"
              value={newPortal.email}
              onChange={(e) => setNewPortal({ ...newPortal, email: e.target.value })}
              placeholder={userEmail || "you@example.com"}
            />
          </div>
          <div className="settings-action-row">
            <button type="submit" className="btn small">
              Add portal
            </button>
            <button type="button" className="btn small tertiary" onClick={() => setShowAdd(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="muted small">Loading portals...</p>
      ) : portals.length === 0 ? (
        <div className="empty-state settings-empty-state">
          <Rss size={28} className="muted settings-empty-icon" />
          <p className="muted small">No portals yet</p>
          <button type="button" className="btn small settings-empty-btn" onClick={openAddForm}>
            Add portal
          </button>
        </div>
      ) : (
        <div className="portals-card-container">
          {portals.map((p) => {
            const isSyncing = syncingId === p.id;
            const isConfirming = confirmRemoveId === p.id;
            return (
              <div key={p.id} className="portal-row">
                <div className="portal-left">
                  <div className="portal-title-row">
                    <span className="portal-name">{p.name}</span>
                    <Badge variant={p.auto_sync ? "success" : "neutral"}>
                      {p.auto_sync ? "Active" : "Paused"}
                    </Badge>
                  </div>
                  <p className="portal-meta">
                    {[
                      p.domain_or_name,
                      p.registered_email,
                      p.last_synced_at ? `Last checked ${timeAgo(p.last_synced_at)}` : "Never checked",
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>

                <div className="portal-right">
                  {isConfirming ? (
                    <div className="settings-inline-row">
                      <span className="small muted">Remove?</span>
                      <button type="button" className="btn small danger" onClick={() => handleRemove(p.id)}>
                        Remove
                      </button>
                      <button
                        type="button"
                        className="btn small tertiary"
                        onClick={() => setConfirmRemoveId(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="btn small secondary"
                        disabled={isSyncing}
                        onClick={() => handleSync(p)}
                      >
                        {isSyncing ? <Loader2 size={13} className="spinner" /> : "Sync now"}
                      </button>
                      <button
                        type="button"
                        className="btn small tertiary"
                        onClick={() => handleTogglePause(p)}
                      >
                        {p.auto_sync ? "Pause" : "Resume"}
                      </button>
                      <button
                        type="button"
                        className="btn-icon-danger"
                        title="Remove portal"
                        onClick={() => setConfirmRemoveId(p.id)}
                        aria-label="Remove portal"
                      >
                        <Trash2 size={15} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

/* ============================================================
   PART 5: Exam Dates
   ============================================================ */
function ExamsCard() {
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [exam, setExam] = useState({ label: "", start_date: "", end_date: "" });
  const [confirmRemoveId, setConfirmRemoveId] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    api
      .get("/exams")
      .then((r) => setExams(r.exams || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const add = async (e) => {
    e.preventDefault();
    setError("");
    if (exam.start_date && exam.end_date && exam.end_date < exam.start_date) {
      setError("End date cannot be before the start date.");
      return;
    }
    try {
      await api.post("/exams", exam);
      setExam({ label: "", start_date: "", end_date: "" });
      setShowAdd(false);
      load();
    } catch (err) {
      setError(err.message || "Failed to add exam period.");
    }
  };

  const remove = async (id) => {
    try {
      await api.del(`/exams/${id}`);
      setConfirmRemoveId(null);
      load();
    } catch (err) {
      setError(err.message || "Failed to remove exam.");
    }
  };

  return (
    <section id="exams" className="card settings-section-card">
      <div className="settings-card-head">
        <div>
          <h2>Exam dates</h2>
          <p className="muted small">
            Events that overlap with your exams get a lower score and a clash warning.
          </p>
        </div>
        <button
          type="button"
          className="btn small tertiary"
          onClick={() => setShowAdd((s) => !s)}
        >
          {showAdd ? "Cancel" : "+ Add exam dates"}
        </button>
      </div>

      {error && (
        <div className="field-error-msg" role="alert">
          <AlertCircle size={15} />
          <span>{error}</span>
        </div>
      )}

      {showAdd && (
        <form
          onSubmit={add}
          className="settings-form-body settings-exam-form"
        >
          <div>
            <label className="settings-field-label" htmlFor="settings-exam-name">Exam name</label>
            <input
              id="settings-exam-name"
              type="text"
              value={exam.label}
              onChange={(e) => setExam({ ...exam, label: e.target.value })}
              placeholder="e.g. Mid-term exams"
              required
            />
          </div>
          <div className="grid2">
            <div>
              <label className="settings-field-label" htmlFor="settings-exam-start">Start date</label>
              <input
                id="settings-exam-start"
                type="date"
                value={exam.start_date}
                onChange={(e) => setExam({ ...exam, start_date: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="settings-field-label" htmlFor="settings-exam-end">End date</label>
              <input
                id="settings-exam-end"
                type="date"
                value={exam.end_date}
                onChange={(e) => setExam({ ...exam, end_date: e.target.value })}
                required
              />
            </div>
          </div>
          <div className="settings-action-row">
            <button type="submit" className="btn small">
              Add exam
            </button>
            <button type="button" className="btn small tertiary" onClick={() => setShowAdd(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="muted small">Loading exams...</p>
      ) : exams.length === 0 ? (
        <div className="empty-state settings-exams-empty">
          <Layers size={28} className="muted settings-empty-icon" />
          <p className="muted small">No exam dates added yet</p>
          <button type="button" className="btn small settings-empty-btn" onClick={() => setShowAdd(true)}>
            Add exam dates
          </button>
        </div>
      ) : (
        <div className="exams-card-container">
          {exams.map((x) => {
            const isConfirming = confirmRemoveId === x.id;
            return (
              <div key={x.id} className="exam-row">
                <div className="settings-flex-fill">
                  <div className="exam-label">{x.label}</div>
                  <div className="exam-dates">{fmtExamRange(x.start_date, x.end_date)}</div>
                </div>

                <div>
                  {isConfirming ? (
                    <div className="settings-inline-row-sm">
                      <span className="small muted">Remove?</span>
                      <button
                        type="button"
                        className="btn small settings-confirm-danger-btn"
                        onClick={() => remove(x.id)}
                      >
                        Yes
                      </button>
                      <button
                        type="button"
                        className="btn small tertiary settings-confirm-btn"
                        onClick={() => setConfirmRemoveId(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="btn-icon-danger"
                      title="Remove exam dates"
                      onClick={() => setConfirmRemoveId(x.id)}
                      aria-label="Remove exam dates"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

/* ============================================================
   PART 6: Calendar
   ============================================================ */
function CalendarCards() {
  const [copied, setCopied] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  const feed = calendarFeedUrl();

  const copyFeed = () => {
    navigator.clipboard.writeText(feed).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleResetLink = async () => {
    setResetting(true);
    setError("");
    try {
      await api.post("/calendar/reset");
      setConfirmReset(false);
      setMsg("Calendar link reset. Update your external calendar app with the new link.");
      setTimeout(() => setMsg(""), 4000);
    } catch (err) {
      setError(err.message || "Failed to reset link.");
    } finally {
      setResetting(false);
    }
  };

  return (
    <section id="calendar" className="card settings-section-card">
      <div className="settings-card-head">
        <div>
          <h2>Calendar</h2>
          <p className="muted small">Subscribe to your deadlines from your phone or desktop calendar app.</p>
        </div>
      </div>

      {msg && <div className="field-success-msg">{msg}</div>}
      {error && (
        <div className="field-error-msg" role="alert">
          <AlertCircle size={15} />
          <span>{error}</span>
        </div>
      )}

      <div className="settings-form-body">
        <div className="settings-field">
          <label className="settings-field-label" htmlFor="settings-calendar-link">Calendar link</label>
          <div className="settings-inline-row">
            <input
              id="settings-calendar-link"
              readOnly
              value={feed}
              onFocus={(e) => e.target.select()}
              aria-label="Calendar link"
              className="mono settings-calendar-link-input"
            />
            <button type="button" className="btn small" onClick={copyFeed}>
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <p className="muted small settings-hint-top">
            Anyone with this link can view your events. Do not share publicly.
          </p>
        </div>

        <div className="settings-reset-wrap">
          {confirmReset ? (
            <div className="settings-reset-confirm">
              <span className="small muted">Resetting will break existing subscriptions. Continue?</span>
              <button
                type="button"
                className="btn small danger"
                disabled={resetting}
                onClick={handleResetLink}
              >
                {resetting ? <Loader2 size={13} className="spinner" /> : "Reset now"}
              </button>
              <button type="button" className="btn small tertiary" onClick={() => setConfirmReset(false)}>
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="btn-tertiary"
              onClick={() => setConfirmReset(true)}
            >
              Reset link
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   PART 7: Preferences (Language, Reminders)
   ============================================================ */
const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "hi", label: "हिन्दी (Hindi)" },
  { value: "hinglish", label: "Hinglish" },
  { value: "bn", label: "বাংলা (Bengali)" },
  { value: "ta", label: "தமிழ் (Tamil)" },
  { value: "te", label: "తెలుగు (Telugu)" },
  { value: "mr", label: "मराठी (Marathi)" },
];

function PreferencesCard() {
  const [lang, setLang] = useState(() => localStorage.getItem("eventure_lang") || "en");
  const [reminders, setReminders] = useState(() => localStorage.getItem("eventure_reminders") !== "false");

  const changeLang = (l) => {
    setLang(l);
    localStorage.setItem("eventure_lang", l);
    window.dispatchEvent(new CustomEvent("eventure_lang_change", { detail: l }));
  };

  const toggleReminders = (checked) => {
    setReminders(checked);
    localStorage.setItem("eventure_reminders", String(checked));
  };

  return (
    <section id="preferences" className="card settings-section-card">
      <div className="settings-card-head">
        <div>
          <h2>Preferences</h2>
          <p className="muted small">Language and reminders.</p>
        </div>
      </div>

      <div className="settings-form-body preferences-grid">
        <div className="settings-field">
          <label className="settings-field-label" htmlFor="pref-language">
            Language
          </label>
          <div className="styled-select">
            <select
              id="pref-language"
              value={lang}
              onChange={(e) => changeLang(e.target.value)}
              aria-label="Language"
            >
              {LANGUAGES.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
            <ChevronDown size={15} className="styled-select-chevron" />
          </div>
        </div>

        <div className="settings-field">
          <span className="settings-field-label">Reminders</span>
          <Checkbox
            id="reminders-toggle"
            checked={reminders}
            onChange={(checked) => toggleReminders(checked)}
            label="Remind me 48, 24 and 6 hours before deadlines"
          />
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   PART 7: Account & Delete Account Modal
   ============================================================ */
function AccountCard() {
  const { user } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [password, setPassword] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const modalRef = useRef(null);

  // Google-only accounts have no password, so the typed confirmation is enough.
  const needsPassword = user?.has_password !== false;
  const canDelete = confirmText.trim() === "DELETE" && (!needsPassword || password.trim().length > 0);

  useEffect(() => {
    if (!showModal) return;
    modalRef.current?.querySelector("input")?.focus();
    const onKey = (e) => {
      if (e.key === "Escape") {
        if (!deleting) setShowModal(false);
        return;
      }
      if (e.key !== "Tab") return;
      const nodes = modalRef.current?.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (!nodes || nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showModal, deleting]);

  const handleDelete = async (e) => {
    e.preventDefault();
    if (!canDelete) return;
    setError("");
    setDeleting(true);
    try {
      await api.del("/auth/me", needsPassword ? { password: password.trim() } : {});
      window.dispatchEvent(new Event("eventure:logout"));
      navigate("/login");
    } catch (err) {
      setError(err.message || "Could not delete account. Check your password.");
      setDeleting(false);
    }
  };

  return (
    <section id="account" className="card settings-section-card">
      <div className="settings-card-head">
        <div>
          <h2>Account</h2>
          <p className="muted small">Manage your account and data.</p>
        </div>
      </div>

      <div className="settings-form-body">
        <div>
          <button
            type="button"
            className="btn-danger-outline"
            onClick={() => {
              setShowModal(true);
              setConfirmText("");
              setPassword("");
              setError("");
            }}
          >
            Delete account
          </button>
          <p className="muted small settings-hint-top">
            Permanently remove your account, saved events, and preferences.
          </p>
        </div>
      </div>

      {showModal && (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget && !deleting) setShowModal(false);
          }}
        >
          <div
            ref={modalRef}
            className="modal-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
          >
            <div className="modal-header">
              <h3 id="modal-title" className="settings-danger-title">Delete account</h3>
            </div>
            <div className="modal-body">
              <p>
                All your saved events, portal connections, and settings will be permanently removed.
                This cannot be undone.
              </p>
              {error && (
                <div className="field-error-msg settings-modal-error" role="alert">
                  <AlertCircle size={15} />
                  <span>{error}</span>
                </div>
              )}
              <form onSubmit={handleDelete} className="settings-delete-form">
                <div>
                  <label className="settings-field-label" htmlFor="settings-delete-confirm">Type DELETE to confirm</label>
                  <input
                    id="settings-delete-confirm"
                    type="text"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder="DELETE"
                  />
                </div>
                {needsPassword && (
                  <div>
                    <label className="settings-field-label" htmlFor="settings-delete-password">Account password</label>
                    <input
                      id="settings-delete-password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                    />
                  </div>
                )}
                <div className="modal-actions">
                  <button
                    type="button"
                    className="btn small tertiary"
                    disabled={deleting}
                    onClick={() => setShowModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn small settings-danger-btn"
                    disabled={!canDelete || deleting}
                  >
                    {deleting ? <Loader2 size={13} className="spinner" /> : "Delete permanently"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

/* ============================================================
   MAIN SETTINGS PAGE
   ============================================================ */
export default function Settings() {
  const { user, refresh } = useAuth();
  const [activeTab, setActiveTab] = useState("profile");
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    function handleBeforeUnload(e) {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  const navItems = [
    { id: "profile", label: "Profile", icon: User },
    { id: "scoring", label: "Scoring", icon: Sliders },
    { id: "portals", label: "Portals", icon: Rss },
    { id: "exams", label: "Exam dates", icon: Layers },
    { id: "calendar", label: "Calendar", icon: Calendar },
    { id: "preferences", label: "Preferences", icon: Bell },
    { id: "account", label: "Account", icon: ShieldAlert },
  ];

  const scrollToSection = (id) => {
    setActiveTab(id);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  // Highlight the sidebar item for the section currently in view.
  useEffect(() => {
    const sections = navItems.map((i) => document.getElementById(i.id)).filter(Boolean);
    if (!sections.length) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveTab(visible[0].target.id);
      },
      { rootMargin: "-25% 0px -65% 0px", threshold: 0 }
    );
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!user) return null;

  return (
    <div className="settings-page">
      <div className="page-header settings-page-header">
        <h1>Settings</h1>
        <p className="muted">Manage your profile, campus preferences, and event ranking.</p>
      </div>

      <div className="settings-two-column-layout">
        {/* Left Sticky Sidebar Nav (200-220px) */}
        <aside className="settings-sidebar-nav">
          <nav className="settings-nav-list" aria-label="Settings Navigation">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`settings-nav-item ${isActive ? "active" : ""}`}
                  onClick={() => scrollToSection(item.id)}
                >
                  <Icon size={16} strokeWidth={1.75} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Right Content Column (max-w-3xl, centered, 24px gap between cards) */}
        <div className="settings-content-column">
          <ProfileCard user={user} onRefresh={refresh} onDirtyChange={setIsDirty} />
          <PriorityScoringCard user={user} onRefresh={refresh} />
          <PortalsCard userEmail={user.email} />
          <ExamsCard />
          <CalendarCards />
          <PreferencesCard />
          <AccountCard />
        </div>
      </div>
    </div>
  );
}
