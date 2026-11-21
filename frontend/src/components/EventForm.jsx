import { useState } from "react";
import { AlertCircle } from "lucide-react";
import Checkbox from "./Checkbox.jsx";
import { CATEGORIES, blank, cap } from "../utils";

export const BLANK = {
  title: "",
  platform: "",
  category: "other",
  venue_name: "",
  start_at: "",
  end_at: "",
  registration_deadline: "",
  url: "",
  description: "",
  stages: [],
  status: "registered",
  is_public: false,
};

export default function EventForm({ initial, mode, notice, saving, saved, error, submitLabel, onSubmit, onBack }) {
  const [form, setForm] = useState(initial || BLANK);
  const [localError, setLocalError] = useState("");

  const set = (k) => (e) =>
    setForm({ ...form, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  const setStage = (i, k, v) =>
    setForm({ ...form, stages: form.stages.map((s, j) => (j === i ? { ...s, [k]: v } : s)) });

  function submit(e) {
    e.preventDefault();
    setLocalError("");

    if (!form.title || !form.title.trim()) {
      return setLocalError("Please enter an event title.");
    }

    if (form.start_at && form.end_at && form.end_at < form.start_at) {
      return setLocalError("Event end time cannot be before start time.");
    }

    const payload = {
      title: form.title.trim(),
      platform: blank(form.platform),
      category: form.category || "other",
      description: form.description || "",
      venue_name: blank(form.venue_name),
      start_at: blank(form.start_at),
      end_at: blank(form.end_at),
      registration_deadline: blank(form.registration_deadline),
      url: blank(form.url),
      is_public: Boolean(form.is_public),
    };

    if (mode === "add") {
      payload.status = form.status || "registered";
      payload.stages = (form.stages || [])
        .filter((s) => s.name && s.name.trim())
        .map((s) => ({ name: s.name.trim(), due_at: blank(s.due_at) }));
    }

    onSubmit(payload);
  }

  return (
    <form className="card eventform-card" onSubmit={submit}>
      {notice}

      <label className="eventform-field">
        <span className="eventform-label-text">
          Event Title <span className="eventform-required">*</span>
        </span>
        <input
          value={form.title}
          onChange={set("title")}
          placeholder="e.g. Campus Hack Sprint"
          required
          className="clean-input"
        />
      </label>

      <div className="grid2 eventform-grid-mb">
        <label>
          <span className="eventform-label-text">
            Platform or Source
          </span>
          <input
            value={form.platform}
            onChange={set("platform")}
            placeholder="Unstop, Devfolio, MLH, WhatsApp, Direct..."
            className="clean-input"
          />
        </label>
        <label>
          <span className="eventform-label-text">
            Category
          </span>
          <select value={form.category} onChange={set("category")} className="clean-select">
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {cap(c)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="eventform-field">
        <span className="eventform-label-text">
          Venue
        </span>
        <input
          value={form.venue_name || ""}
          onChange={(e) => setForm({ ...form, venue_name: e.target.value })}
          placeholder="e.g. Main Auditorium, Block C (or 'Online')"
          className="clean-input"
        />
        <span className="small muted eventform-hint">
          Travel time is estimated from this venue when it can be resolved.
        </span>
      </label>

      <div className="grid2 eventform-grid-mb">
        <label>
          <span className="eventform-label-text">
            Starts At
          </span>
          <input
            type="datetime-local"
            value={form.start_at || ""}
            onChange={set("start_at")}
            className="clean-input"
          />
        </label>
        <label>
          <span className="eventform-label-text">
            Ends At
          </span>
          <input
            type="datetime-local"
            value={form.end_at || ""}
            onChange={set("end_at")}
            className="clean-input"
          />
        </label>
      </div>

      <div className="grid2 eventform-grid-mb">
        <label>
          <span className="eventform-label-text">
            Registration Deadline
          </span>
          <input
            type="datetime-local"
            value={form.registration_deadline || ""}
            onChange={set("registration_deadline")}
            className="clean-input"
          />
        </label>
        <label>
          <span className="eventform-label-text">
            Official Event Link
          </span>
          <input
            type="url"
            value={form.url || ""}
            onChange={set("url")}
            placeholder="https://..."
            className="clean-input"
          />
        </label>
      </div>

      <label className="eventform-field-last">
        <span className="eventform-label-text">
          Description & Rules
        </span>
        <textarea
          rows={3}
          value={form.description || ""}
          onChange={set("description")}
          placeholder="Key rules, team size, eligibility, prize details..."
          className="clean-textarea"
        />
      </label>

      {mode === "add" && (
        <fieldset className="eventform-stages-fieldset">
          <legend className="eventform-stages-legend">
            Stages & Milestones (Rounds)
          </legend>
          {form.stages.map((s, i) => (
            <div
              className="row eventform-stage-row"
              key={i}
            >
              <input
                value={s.name}
                onChange={(e) => setStage(i, "name", e.target.value)}
                placeholder="Stage name (e.g. Abstract Submission)"
                aria-label="Stage name"
                className="clean-input eventform-stage-name-input"
              />
              <input
                type="datetime-local"
                value={s.due_at || ""}
                onChange={(e) => setStage(i, "due_at", e.target.value)}
                aria-label="Stage deadline"
                className="clean-input eventform-stage-date-input"
              />
              <button
                type="button"
                className="btn-tertiary danger eventform-stage-remove-btn"
                onClick={() => setForm({ ...form, stages: form.stages.filter((_, j) => j !== i) })}
              >
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            className="btn-tertiary eventform-add-stage-btn"
            onClick={() => setForm({ ...form, stages: [...form.stages, { name: "", due_at: "" }] })}
          >
            + Add stage
          </button>
        </fieldset>
      )}

      <div className="grid2 eventform-grid-center">
        {mode === "add" && (
          <label>
            <span className="eventform-label-text">
              Initial Status on Timeline
            </span>
            <select value={form.status} onChange={set("status")} className="clean-select">
              <option value="registered">Registered (Committed)</option>
              <option value="interested">Interested (Evaluating)</option>
            </select>
          </label>
        )}
        <div className={mode === "add" ? "eventform-checkbox-wrap" : undefined}>
          <Checkbox
            checked={Boolean(form.is_public)}
            onChange={(checked) => setForm({ ...form, is_public: checked })}
            label="List publicly so campus peers can discover and review this event"
          />
        </div>
      </div>

      {(localError || error) && (
        <div className="field-error-msg eventform-error" role="alert">
          <AlertCircle size={15} strokeWidth={2} className="field-error-icon" />
          <span>{localError || error}</span>
        </div>
      )}

      <div className="row eventform-actions">
        <button type="submit" className="btn small" disabled={saving || saved}>
          {saved ? "Saved" : saving ? "Saving..." : submitLabel || "Save"}
        </button>
        {onBack && (
          <button type="button" className="btn secondary small" onClick={onBack} disabled={saving}>
            Back
          </button>
        )}
      </div>
    </form>
  );
}
