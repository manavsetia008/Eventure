/**
 * Custom Radio component.
 *
 * Props:
 *   checked   – boolean
 *   onChange  – function called when this radio is selected
 *   disabled  – boolean
 *   label     – ReactNode (optional — renders a full clickable row when provided)
 *   name      – radio group name (forwarded to hidden input)
 *   value     – radio value (forwarded to hidden input)
 *   id        – forwarded to the hidden input
 */
export default function Radio({ checked, onChange, disabled, label, name, value, id, "aria-label": ariaLabel }) {
  const dot = (
    <span className={`radio-dot${checked ? " checked" : ""}`}>
      {checked && (
        <span className="radio-dot-inner" />
      )}
    </span>
  );

  if (label) {
    return (
      <label
        className={`radio-row${disabled ? " is-disabled" : ""}`}
      >
        <input
          id={id}
          type="radio"
          name={name}
          value={value}
          checked={checked}
          disabled={disabled}
          onChange={() => onChange && onChange(value)}
          aria-label={ariaLabel}
          className="radio-input-hidden"
        />
        {dot}
        <span>{label}</span>
      </label>
    );
  }

  return (
    <label
      className={`radio-standalone${disabled ? " is-disabled" : ""}`}
    >
      <input
        id={id}
        type="radio"
        name={name}
        value={value}
        checked={checked}
        disabled={disabled}
        onChange={() => onChange && onChange(value)}
        aria-label={ariaLabel}
        className="radio-input-hidden"
      />
      {dot}
    </label>
  );
}
