import React, { useState } from "react";

const EVENT_CHARS = ["E", "v", "e", "n", "t"];
const URE_CHARS = ["u", "r", "e"];

export default function Logo({ size = 26, animated = true }) {
  const [hopping, setHopping] = useState(false);

  const handleHop = () => {
    setHopping(true);
    setTimeout(() => setHopping(false), 650);
  };

  return (
    <div className="brand-logo-wrap" onMouseEnter={handleHop}>
      <style>{`
        .brand-logo-wrap {
          position: relative;
          display: inline-flex;
          align-items: center;
          gap: 0.55rem;
          text-decoration: none;
          cursor: pointer;
        }
        .brand-wordmark-animated {
          display: inline-flex;
          align-items: baseline;
          font-size: 1.25rem;
          letter-spacing: -0.025em;
          font-weight: 800;
          line-height: 1;
          position: relative;
        }
        .brand-char {
          display: inline-block;
          transform-origin: 50% 100%;
          animation: logo-stamp 0.52s cubic-bezier(.2, .8, .25, 1.15) var(--d, 0ms) both;
          transition: transform 0.2s cubic-bezier(.3, 1.4, .5, 1), color 0.15s;
        }
        .brand-logo-wrap:hover .brand-char {
          animation: logo-jiggle 0.5s cubic-bezier(.3, 1.5, .5, 1);
        }
        .brand-mini-bird {
          display: inline-block;
          margin-left: 2px;
          vertical-align: middle;
          transform-origin: 50% 100%;
          animation: logo-pop 0.55s cubic-bezier(.3, 1.6, .5, 1) 0.35s both;
        }
        .brand-mini-bird.is-hop {
          animation: logo-hop 0.65s cubic-bezier(.3, .7, .4, 1);
        }
        .brand-mini-bird-svg {
          display: block;
        }
        .brand-logo-squiggle {
          position: absolute;
          left: 0;
          bottom: -4px;
          width: 100%;
          height: 5px;
          overflow: visible;
          pointer-events: none;
        }
        .brand-logo-squiggle path {
          fill: none;
          stroke: var(--gd-coral, #ff5c7a);
          stroke-width: 2;
          stroke-linecap: round;
          stroke-linejoin: round;
          stroke-dasharray: 1;
          stroke-dashoffset: 1;
          animation: logo-draw 0.7s cubic-bezier(.5, 0, .2, 1) 0.3s both;
        }
        .brand-logo-wrap:hover .brand-logo-squiggle path {
          stroke-dashoffset: 0;
          animation: logo-draw 0.5s cubic-bezier(.5, 0, .2, 1) both;
        }

        @keyframes logo-stamp {
          0% {
            opacity: 0;
            transform: translateY(-16px) scale(1.2) rotate(var(--r, 0deg));
          }
          60% {
            opacity: 1;
            transform: translateY(2px) scale(0.96, 1.04);
          }
          80% {
            transform: translateY(-1px) scale(1.02, 0.98);
          }
          100% {
            opacity: 1;
            transform: none;
          }
        }
        @keyframes logo-jiggle {
          0% { transform: none; }
          25% { transform: rotate(-5deg) scale(1.1); }
          50% { transform: rotate(4deg) translateY(-3px); }
          75% { transform: rotate(-2deg); }
          100% { transform: none; }
        }
        @keyframes logo-pop {
          0% { opacity: 0; transform: scale(0.4) translateY(6px); }
          70% { opacity: 1; transform: scale(1.15) translateY(-2px); }
          100% { opacity: 1; transform: none; }
        }
        @keyframes logo-hop {
          0% { transform: none; }
          25% { transform: scale(1.2, 0.8) translateY(0); }
          50% { transform: translateY(-10px) scale(0.9, 1.15); }
          75% { transform: translateY(0) scale(1.1, 0.9); }
          100% { transform: none; }
        }
        @keyframes logo-draw {
          to { stroke-dashoffset: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .brand-char, .brand-mini-bird, .brand-logo-squiggle path {
            animation: none !important;
            opacity: 1 !important;
            transform: none !important;
            stroke-dashoffset: 0 !important;
          }
        }
      `}</style>

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

      <span className="brand-wordmark-animated" aria-label="Eventure">
        <span className="brand-accent">
          {EVENT_CHARS.map((c, i) => (
            <span
              key={i}
              className="brand-char"
              style={{
                "--d": `${40 + i * 35}ms`,
                "--r": `${((i % 2 === 0 ? 1 : -1) * (i + 1) * 1.5).toFixed(1)}deg`,
              }}
            >
              {c}
            </span>
          ))}
        </span>
        <span className="brand-tail">
          {URE_CHARS.map((c, i) => (
            <span
              key={i}
              className="brand-char"
              style={{
                "--d": `${215 + i * 35}ms`,
                "--r": `${((i % 2 === 0 ? -1 : 1) * (i + 1) * 1.5).toFixed(1)}deg`,
              }}
            >
              {c}
            </span>
          ))}
        </span>

        {/* Mini doodle bird perched on Eventure in the navbar */}
        <span className={`brand-mini-bird ${hopping ? "is-hop" : ""}`} title="Pip the Doodle Bird!">
          <svg viewBox="-10 -20 20 22" width="16" height="18" className="brand-mini-bird-svg" aria-hidden="true">
            <path fill="var(--card, #fff)" stroke="var(--ink, #0f172a)" strokeWidth="1.6" d="M-6 -2 C-8 -8 -3 -14 2 -14 C8 -14 10 -9 9 -3 C8 1 3 2 0 2 C-4 2 -6 0 -6 -2 Z" />
            <path fill="#ff9f1c" stroke="var(--ink, #0f172a)" strokeWidth="1.4" d="M8 -7 L13 -5 L8 -3 Z" />
            <circle cx="2" cy="-8" r="1.4" fill="var(--ink, #0f172a)" />
            <circle cx="2.4" cy="-8.4" r="0.5" fill="#fff" />
          </svg>
        </span>

        <svg className="brand-logo-squiggle" viewBox="0 0 80 6" preserveAspectRatio="none" aria-hidden="true">
          <path pathLength={1} d="M 1 4 Q 20 1, 40 4 T 79 4" />
        </svg>
      </span>
    </div>
  );
}
