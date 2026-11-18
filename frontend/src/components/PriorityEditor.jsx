import { useState } from "react";
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
        style={{ position: "relative", display: "inline-block" }}
        onMouseEnter={() => scoreParts && setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <span
          className="score-text-clean"
          onClick={startEdit}
          title={`Priority Fit Score: ${value}/100. Click to edit manually.`}
          style={{
            cursor: "pointer",
            fontSize: "13px",
            fontWeight: 500,
            color: "var(--text-secondary)",
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
            userSelect: "none",
          }}
        >
          <span>{labelText}</span>
          <span style={{ color: numColor, fontWeight: 600 }}>{value}</span>
        </span>
        {showTooltip && scoreParts && (
          <ScoreTooltip parts={scoreParts} total={value} />
        )}
      </span>
    );
  }

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
      <input
        type="number"
        min="0"
        max="100"
        value={temp}
        onChange={(e) => setTemp(e.target.value)}
        onKeyDown={handleKey}
        autoFocus
        style={{
          width: "3rem",
          height: "24px",
          padding: "0 0.25rem",
          fontSize: "12px",
          borderRadius: "4px",
          border: "1px solid var(--border-strong)",
          background: "var(--bg)",
          color: "var(--text)",
          textAlign: "center",
        }}
        aria-label="Edit priority score"
      />
      <button
        type="button"
        className="btn small"
        onClick={save}
        style={{ padding: "0.1rem 0.4rem", fontSize: "11px", height: "24px" }}
      >
        Save
      </button>
      <button
        type="button"
        className="linklike small muted"
        onClick={cancel}
        style={{ padding: "0.1rem 0.3rem", display: "inline-flex", alignItems: "center" }}
      >
        <X size={12} strokeWidth={2} />
      </button>
    </span>
  );
}
