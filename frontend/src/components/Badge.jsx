export default function Badge({ variant = "neutral", children, label, className = "" }) {
  const text = label || children;
  return (
    <span className={`stripe-badge badge-${variant} ${className}`.trim()}>
      {text}
    </span>
  );
}
