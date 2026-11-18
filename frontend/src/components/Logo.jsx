export default function Logo({ size = 26 }) {
  return (
    <div className="brand-logo-wrap">
      <svg
        width={size}
        height={size}
        viewBox="0 0 28 28"
        fill="none"
        className="brand-icon"
        aria-hidden="true"
      >
        <rect
          x="2.5"
          y="4.5"
          width="23"
          height="20"
          rx="5"
          fill="var(--blue-tint)"
          stroke="var(--thread)"
          strokeWidth="1.75"
        />
        <line x1="2.5" y1="10" x2="25.5" y2="10" stroke="var(--thread)" strokeWidth="1.5" />
        <line x1="8" y1="2" x2="8" y2="5.5" stroke="var(--thread)" strokeWidth="1.75" strokeLinecap="round" />
        <line x1="20" y1="2" x2="20" y2="5.5" stroke="var(--thread)" strokeWidth="1.75" strokeLinecap="round" />
        <circle cx="8" cy="15" r="1.25" fill="var(--thread)" />
        <circle cx="14" cy="15" r="1.25" fill="var(--thread)" />
        <circle cx="20" cy="15" r="1.25" fill="var(--thread)" />
        <circle cx="8" cy="19.5" r="1.25" fill="var(--thread)" />
        <circle cx="14" cy="19.5" r="1.25" fill="var(--thread)" />
        <circle cx="20" cy="19.5" r="1.25" fill="var(--thread)" />
      </svg>
      <span className="brand-wordmark">
        <span className="brand-accent">Event</span>
        <span className="brand-tail">ure</span>
      </span>
    </div>
  );
}
