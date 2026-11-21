import { AlertTriangle } from "lucide-react";
import { fmtRange } from "../utils";

const TITLES = {
  overlap: "Schedule overlap",
  travel_gap: "Transit gap warning",
  exam_week: "Exam week clash",
};

export default function IssueCard({ issue, onSkip, onDismiss }) {
  const s = issue.suggestion;
  const canAct = s && s.skip;
  const isOverlap = issue.type === "overlap";

  const title = TITLES[issue.type] || "Schedule conflict";

  const overlapMin = issue.meta?.overlap_minutes;
  let desc = issue.message;
  if (isOverlap && overlapMin) {
    const hours = (overlapMin / 60).toFixed(1).replace(".0", "");
    desc = `These two events overlap by about ${hours} hour${hours === "1" ? "" : "s"}.`;
  }

  const eventTimes = issue.event_times || [];

  return (
    <div className="issue-card" role="alert">
      <div className="issue-title-row">
        <AlertTriangle size={16} strokeWidth={1.75} className="issue-warn-icon" aria-hidden="true" />
        <h3 className="issue-title">{title}</h3>
      </div>

      <p className="issue-desc">{desc}</p>

      {eventTimes.length > 0 && (
        <div className="issue-events">
          {eventTimes.map((et, i) => (
            <div className="issue-event-row" key={i}>
              <span className="issue-event-name" title={et.title}>{et.title}</span>
              <span className="issue-event-time">{fmtRange(et.start_at, et.end_at)}</span>
            </div>
          ))}
        </div>
      )}

      {s?.reason && <p className="issue-rec">{s.reason}</p>}

      <div className="issue-actions-row">
        {canAct && s.keep_title && (
          <button type="button" className="btn small" onClick={() => onSkip(s.skip)}>
            Keep {s.keep_title}
          </button>
        )}
        {canAct && s.skip_title && (
          <button type="button" className="btn ghost small" onClick={() => onSkip(s.keep)}>
            Keep {s.skip_title}
          </button>
        )}
        <button type="button" className="btn-tertiary" onClick={onDismiss}>
          Review later
        </button>
      </div>
    </div>
  );
}
