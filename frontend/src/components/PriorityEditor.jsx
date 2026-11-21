import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

function ScoreTooltip({ parts, total }) {
  if (!parts) return null;
  return (
    <div className="score-tooltip">
      <div className="tooltip-title">Priority Breakdown ({total}/100)</div>
      {Object.entries(parts).map(([k, v]) => (
        <div key={k} className="tooltip-row">
          <span>{k}</span>
          <b>{v > 0 ? `+${v}` : v}</b>
        </div>
      ))}
    </div>
  );
}

export default function PriorityEditor({ value, onChange, scoreParts }) {
  const [editing, setEditing] = useState(false);
  const [temp, setTemp] = useState(value ?? "");
  const [showTooltip, setShowTooltip] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const startEdit = (e) => {
    e.stopPropagation();
    setTemp(value ?? "");
    setEditing(true);
  };

  const cancel = (e) => {
    e.stopPropagation();
    setEditing(false);
  };

  const save = (e) => {
    e.stopPropagation();
    const n = Number(temp);
    if (!isNaN(n) && n >= 0 && n <= 100) {
      onChange(n);
    }
    setEditing(false);
  };

  const handleKey = (e) => {
    if (e.key === "Enter") save(e);
    if (e.key === "Escape") cancel(e);
  };

  const keepCutoff = Number(localStorage.getItem("eventure_threshold_keep") || 55);
  const skipCutoff = Number(localStorage.getItem("eventure_threshold_skip") || 40);
  const useMaybe = localStorage.getItem("eventure_use_maybe_range") === "true";

  let labelText = "Skip";
  let numColor = "var(--text-muted)";
  if (value >= keepCutoff) {
    labelText = "Keep";
    numColor = "var(--accent)";
  } else if (useMaybe && value >= skipCutoff) {
    labelText = "Maybe";
    numColor = "var(--text-secondary)";
  }

  if (!editing) {
    return (
      <span
        className="priority-editor-wrap"
        onMouseEnter={() => scoreParts && setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <span
          role="button"
          tabIndex={0}
          className="score-text-clean priority-editor-trigger"
          onClick={startEdit}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              startEdit(e);
            }
          }}
          title={`Priority Fit Score: ${value}/100. Click to edit manually.`}
        >
          <span>{labelText}</span>
          <span className={`priority-editor-num ${numColor === "var(--accent)" ? "is-keep" : numColor === "var(--text-secondary)" ? "is-maybe" : "is-skip"}`}>{value}</span>
        </span>
        {showTooltip && scoreParts && (
          <ScoreTooltip parts={scoreParts} total={value} />
        )}
      </span>
    );
  }

  return (
    <span className="priority-editor-edit">
      <input
        ref={inputRef}
        type="number"
        min="0"
        max="100"
        value={temp}
        onChange={(e) => setTemp(e.target.value)}
        onKeyDown={handleKey}
        className="priority-editor-input"
        aria-label="Edit priority score"
      />
      <button
        type="button"
        className="btn small priority-editor-save"
        onClick={save}
      >
        Save
      </button>
      <button
        type="button"
        className="linklike small muted priority-editor-cancel"
        onClick={cancel}
      >
        <X size={12} strokeWidth={2} />
      </button>
    </span>
  );
}
