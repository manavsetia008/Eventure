import Notice from "./Notice.jsx";

export default function IssueCard({ issue, onSkip, onDismiss }) {
  const s = issue.suggestion;
  const canAct = s && s.skip;

  const title =
    issue.type === "overlap"
      ? "Schedule Clash"
      : issue.type === "travel_gap"
      ? "Transit Warning"
      : issue.type === "exam_week"
      ? "Exam Week Overlap"
      : "Schedule Conflict";

  const actions = (
    <>
      {canAct && s.keep_title && (
        <button
          type="button"
          className="btn small"
          onClick={() => onSkip(s.skip)}
        >
          Keep {s.keep_title}
        </button>
      )}
      {canAct && s.skip_title && (
        <button
          type="button"
          className="btn ghost small"
          onClick={() => onSkip(s.keep)}
        >
          Keep {s.skip_title}
        </button>
      )}
      <button
        type="button"
        className="btn-tertiary"
        onClick={onDismiss}
      >
        Keep both anyway
      </button>
    </>
  );

  return (
    <Notice
      variant="danger"
      title={title}
      message={issue.message}
      conflictNames={issue.titles && issue.titles.length === 2 ? issue.titles : null}
      recommendation={s?.reason || null}
      actions={actions}
      className="issue-notice"
    />
  );
}
