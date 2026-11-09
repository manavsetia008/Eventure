const TITLES = {
  overlap: { title: "Schedule clash", badge: "Clash" },
  travel_gap: { title: "Insufficient travel time", badge: "Travel gap" },
  exam_week: { title: "Falls during exam week", badge: "Exam week" },
  calendar_busy: { title: "Conflict with personal calendar", badge: "Busy" },
};

export default function IssueCard({ issue, onSkip, onDismiss }) {
  const s = issue.suggestion;
  const canAct = s && s.skip;
  const dismissLabel = canAct ? "Keep both anyway" : "Got it, I will plan around it";
  const typeInfo = TITLES[issue.type] || { title: "Conflict detected", badge: "Notice" };

  return (
    <article className={`issue sev-${issue.severity}`}>
      <div className="issue-head">
        <h3>{typeInfo.title}</h3>
        <span className="pill alert-pill">{typeInfo.badge}</span>
      </div>
      <p className="issue-msg">{issue.message}</p>
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
          <button className="btn small" onClick={() => onSkip(s.skip)}>Keep {s.keep_title}, skip {s.skip_title}</button>
        )}
        {canAct && s.action === "skip" && (
          <button className="btn small" onClick={() => onSkip(s.skip)}>Skip {s.skip_title}</button>
        )}
        <button className="btn ghost small" onClick={onDismiss}>{dismissLabel}</button>
      </div>
    </article>
  );
}
