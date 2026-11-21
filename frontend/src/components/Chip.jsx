/**
 * Minimal Chip component (Unstop, Hackathon, filters).
 * 1px border, transparent bg, radius 6px, height 26px, 13px text.
 * No green/orange heavy borders.
 * 
 * @param {string} label - Tag or text
 * @param {boolean} [selected] - Selected state (inverse text/bg or blue accent)
 * @param {function} [onClick] - Click handler if clickable
 * @param {string} [className] - Optional extra class
 * @param {React.ReactNode} [icon] - Optional tiny icon
 */
export default function Chip({ label, selected = false, onClick, className = "", icon = null }) {
  const Comp = onClick ? "button" : "span";
  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`clean-chip ${selected ? "selected" : ""} ${onClick ? "clickable" : ""} ${className}`}
    >
      {icon && <span className="chip-icon">{icon}</span>}
      <span className="chip-text">{label}</span>
    </Comp>
  );
}
