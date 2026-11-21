/**
 * Minimal Status indicator: Plain text + 6px dot.
 * Zero background, zero border, zero pill boxes.
 * 
 * @param {'active'|'on_schedule'|'synced'|'due_soon'|'overdue'|'clash'|'time_overlap'|'neutral'|'draft'} variant
 * @param {string} label - Status label text
 * @param {string} [className] - Optional extra class
 */
export default function Status({ variant = "neutral", label, className = "" }) {
  const norm = (variant || "").toLowerCase().replace(/[\s-]+/g, "_");

  let statusType = "neutral";
  if (["due_soon", "warning", "soon", "closing_soon"].includes(norm)) {
    statusType = "warning";
  } else if (["overdue", "clash", "time_overlap", "danger", "cancelled"].includes(norm)) {
    statusType = "danger";
  }

  return (
    <span className={`clean-status status-${statusType} ${className}`}>
      <span className="status-dot" aria-hidden="true" />
      <span className="status-label">{label}</span>
    </span>
  );
}
