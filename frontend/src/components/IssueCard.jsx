const RADAR_CONFIG = {
  overlap: {
    title: "Deterministic Clash Radar: Time Overlap",
    badge: "HIGH: Time Overlap",
    formula: "Buffer < 0: Events share overlapping hours",
    badgeStyle: { background: "rgba(231, 76, 60, 0.15)", color: "var(--alert)", borderColor: "var(--alert)", fontWeight: 700 },
  },
  travel_gap: {
    title: "Deterministic Clash Radar: Travel Commute Gap",
    badge: "MEDIUM: Travel Gap",
    formula: "Buffer = Gap − Road Travel Time − 15 min buffer (< 0 min)",
    badgeStyle: { background: "rgba(243, 156, 18, 0.15)", color: "var(--amber)", borderColor: "var(--amber)", fontWeight: 700 },
  },
  exam_week: {
    title: "Academic Shield: Semester Exam Week",
    badge: "HIGH: Exam Week Shield",
    formula: "Academic Shield: Event falls inside university exam datesheet",
    badgeStyle: { background: "rgba(231, 76, 60, 0.15)", color: "var(--alert)", borderColor: "var(--alert)", fontWeight: 700 },
  },
  calendar_busy: {
    title: "Personal Google Calendar Collision",
    badge: "MEDIUM: Calendar Busy",
    formula: "Personal schedule collision synced via Google Calendar OAuth",
    badgeStyle: { background: "rgba(243, 156, 18, 0.15)", color: "var(--amber)", borderColor: "var(--amber)", fontWeight: 700 },
  },
};

export default function IssueCard({ issue, onSkip, onDismiss }) {
  const s = issue.suggestion;
  const canAct = s && s.skip;
  const dismissLabel = canAct ? "Keep both anyway" : "Got it, I will plan around it";
  const cfg = RADAR_CONFIG[issue.type] || {
    title: "Conflict detected",
    badge: "NOTICE",
    formula: "Deterministic schedule conflict detected",
    badgeStyle: { background: "var(--surface)", color: "var(--muted)", borderColor: "var(--line)" },
  };

  return (
    <article className={`issue sev-${issue.severity}`}>
      <div className="issue-head">
        <h3 style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span>⚡</span>
          <span>{cfg.title}</span>
        </h3>
        <span className="pill" style={cfg.badgeStyle}>{cfg.badge}</span>
      </div>
      <p className="issue-msg">{issue.message}</p>
      
      {/* Deterministic Radar Formula Pill */}
      <div style={{ marginBottom: "0.6rem" }}>
        <span className="small muted" style={{ display: "inline-block", background: "var(--surface)", padding: "0.2rem 0.55rem", borderRadius: "6px", border: "1px solid var(--line)" }}>
          📐 <b>Formula:</b> <code>{cfg.formula}</code>
        </span>
      </div>

      {issue.titles.length === 2 && (
        <div className="fork" aria-hidden="true">
          <span>{issue.titles[0]}</span>
          <i />
          <span>{issue.titles[1]}</span>
        </div>
      )}
      {s && (
        <div className="suggestion">
          <p><strong>Recommendation:</strong> {s.reason}</p>
        </div>
      )}
      <div className="row issue-actions">
        {canAct && s.action === "keep" && (
          <button className="btn small" onClick={() => onSkip(s.skip)}>
            Keep {s.keep_title} · Mark {s.skip_title} as Skipped
          </button>
        )}
        {canAct && s.action === "skip" && (
          <button className="btn small" onClick={() => onSkip(s.skip)}>
            Mark {s.skip_title} as Skipped
          </button>
        )}
        <button className="btn ghost small" onClick={onDismiss}>{dismissLabel}</button>
      </div>
    </article>
  );
}
