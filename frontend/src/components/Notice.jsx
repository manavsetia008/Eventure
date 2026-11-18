import { AlertCircle, AlertTriangle, Info } from "lucide-react";

export default function Notice({
  variant = "danger",
  title,
  children,
  message,
  conflictNames,
  recommendation,
  actions,
  className = "",
}) {
  const Icon = variant === "danger" ? AlertCircle : variant === "warning" ? AlertTriangle : Info;

  return (
    <div className={`clean-notice notice-${variant} ${className}`.trim()} role="alert">
      <div className="notice-header-row">
        <Icon size={16} strokeWidth={1.75} className="notice-icon" />
        {title && <h3 className="notice-title">{title}</h3>}
      </div>

      {(message || children) && (
        <div className="notice-body">
          {message && <p className="notice-msg">{message}</p>}
          {children}
        </div>
      )}

      {conflictNames && conflictNames.length === 2 && (
        <div className="notice-conflict-row">
          <span className="notice-conflict-name">{conflictNames[0]}</span>
          <span className="notice-conflict-vs">vs</span>
          <span className="notice-conflict-name">{conflictNames[1]}</span>
        </div>
      )}

      {recommendation && (
        <p className="notice-recommendation">{recommendation}</p>
      )}

      {actions && (
        <div className="notice-actions-row">
          {actions}
        </div>
      )}
    </div>
  );
}
