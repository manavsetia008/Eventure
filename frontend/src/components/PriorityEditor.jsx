import { useState } from "react";

/**
 * Editable priority score pill.
 * Click the score to edit it inline. Saves via onChange callback.
 * Optional scoreParts prop to show breakdown tooltip on hover.
 */
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

  const isHighFit = value >= 55;
  const scoreBadgeClass = isHighFit ? "pill score score-keep" : "pill score score-skip";

  if (!editing) {
    return (
      <span
        style={{ position: "relative", display: "inline-block" }}
        onMouseEnter={() => scoreParts && setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <span
          className={scoreBadgeClass}
          onClick={startEdit}
          title="Click to manually edit priority score"
          style={{
            borderColor: isHighFit ? "var(--teal)" : "var(--line-strong)",
            color: isHighFit ? "var(--teal)" : "var(--muted)",
            background: isHighFit ? "rgba(46, 204, 113, 0.08)" : "var(--surface)",
            cursor: "pointer",
            fontWeight: 700,
          }}
        >
          {isHighFit ? "★ Priority" : "Priority"} {value}
        </span>
        {showTooltip && scoreParts && (
          <ScoreTooltip parts={scoreParts} total={value} />
        )}
      </span>
    );
  }

  return (
    <span className="pill score" style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem", padding: "0.15rem 0.45rem" }}>
      <input
        type="number"
        min="0"
        max="100"
        value={temp}
        onChange={(e) => setTemp(e.target.value)}
        onKeyDown={handleKey}
        autoFocus
        style={{
          width: "3.2rem",
          padding: "0.18rem 0.3rem",
          fontSize: "0.8rem",
          borderRadius: "6px",
          border: "1px solid var(--line-strong)",
          background: "var(--card)",
          color: "var(--ink)",
          textAlign: "center",
        }}
        aria-label="Edit priority score"
      />
      <button className="btn small" onClick={save} style={{ padding: "0.15rem 0.5rem", fontSize: "0.75rem" }}>
        Save
      </button>
      <button className="btn ghost small" onClick={cancel} style={{ padding: "0.15rem 0.5rem", fontSize: "0.75rem" }}>
        ✕
      </button>
    </span>
  );
}

function ScoreTooltip({ parts, total }) {
  const rows = [
    { label: "Interest & Goal Match", key: "goal", color: "var(--thread)" },
    { label: "Deadline Urgency", key: "urgency", color: "var(--amber)" },
    { label: "Commute Proximity", key: "effort", color: "var(--teal)" },
    { label: "Registered Bonus", key: "progress", color: "var(--indigo)" },
    { label: "Exam Week Penalty", key: "exam", color: "var(--alert)", subtract: true },
  ];

  return (
    <div
      style={{
        position: "absolute",
        bottom: "calc(100% + 8px)",
        left: "50%",
        transform: "translateX(-50%)",
        background: "var(--card)",
        border: "1px solid var(--line)",
        borderRadius: "var(--radius, 10px)",
        boxShadow: "var(--shadow, 0 4px 12px rgba(0,0,0,.12))",
        padding: "0.75rem 1rem",
        minWidth: "240px",
        zIndex: 100,
        fontSize: "0.8rem",
        color: "var(--text-body)",
        whiteSpace: "nowrap",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div style={{ fontWeight: 600, marginBottom: "0.4rem", fontSize: "0.85rem" }}>
        Score Breakdown
      </div>
      {rows.map((r) => {
        const val = parts[r.key];
        if (val == null) return null;
        return (
          <div key={r.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.15rem 0" }}>
            <span style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: r.color, display: "inline-block", flexShrink: 0 }} />
              {r.label}
            </span>
            <span style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums", color: val < 0 ? "var(--alert)" : "var(--ink)" }}>
              {val < 0 ? `−${Math.abs(val)}` : `+${val}`}
            </span>
          </div>
        );
      })}
      <div style={{ borderTop: "1px solid var(--line)", marginTop: "0.35rem", paddingTop: "0.35rem", display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
        <span>Total</span>
        <span>{total}</span>
      </div>
    </div>
  );
}
