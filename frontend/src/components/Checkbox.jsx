import { Check } from "lucide-react";

/**
 * Custom Checkbox component.
 *
 * Props:
 *   checked   – boolean
 *   onChange  – function(newChecked: boolean)
 *   disabled  – boolean
 *   label     – ReactNode (optional — renders a full clickable row when provided)
 *   className – extra class on the row wrapper (only used when label is provided)
 *   id        – forwarded to the hidden input for external <label> association
 */
export default function Checkbox({ checked, onChange, disabled, label, className = "", id, "aria-label": ariaLabel }) {
  const box = (
    <span className={`checkbox-box${checked ? " checked" : ""}`}>
      {checked && <Check size={12} strokeWidth={2.5} color="var(--btn-primary-text)" />}
    </span>
  );

  if (label) {
    return (
      <label
        className={`checkbox-row${disabled ? " is-disabled" : ""} ${className}`}
      >
        <input
          id={id}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange && onChange(e.target.checked)}
          aria-label={ariaLabel}
          className="checkbox-input-hidden"
        />
        {box}
        <span>{label}</span>
      </label>
    );
  }

  // Standalone (no label text) — just the box, still accessible
  return (
    <label
      className={`checkbox-standalone${disabled ? " is-disabled" : ""}`}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange && onChange(e.target.checked)}
        aria-label={ariaLabel}
        className="checkbox-input-hidden"
      />
      {box}
    </label>
  );
}
