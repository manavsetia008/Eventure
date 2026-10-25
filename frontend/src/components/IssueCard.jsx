const TITLES = {
  overlap: "These two clash",
  travel_gap: "Not enough time to travel",
  exam_week: "Lands in exam time",
  calendar_busy: "Busy in your calendar",
};

export default function IssueCard({ issue, onSkip, onDismiss }) {
  const s = issue.suggestion;
  const canAct = s && s.skip;
  const dismissLabel = canAct ? "Keep both anyway" : "Got it, I will plan around it";
  return (
    <article className={`issue sev-${issue.severity}`}>
      <h3>{TITLES[issue.type]}</h3>
      <p>{issue.message}</p>
      {issue.titles.length === 2 && (
        <div className="fork" aria-hidden="true">
          <span>{issue.titles[0]}</span>
          <i />
          <span>{issue.titles[1]}</span>
        </div>
      )}
      {s && <p className="suggestion">{s.reason}</p>}
      <div className="row">
        {canAct && s.action === "keep" && (
          <button className="btn" onClick={() => onSkip(s.skip)}>Keep {s.keep_title}, skip {s.skip_title}</button>
        )}
        {canAct && s.action === "skip" && (
          <button className="btn" onClick={() => onSkip(s.skip)}>Skip {s.skip_title}</button>
        )}
        <button className="btn ghost" onClick={onDismiss}>{dismissLabel}</button>
      </div>
    </article>
  );
}
