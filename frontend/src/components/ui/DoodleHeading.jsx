import { useEffect, useMemo, useRef, useState } from "react";

/**
 * Deterministic hash [0, 1) based on index for consistent tilts and timings.
 */
function hash(n) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/**
 * Mascot presets matching the Doodle Crew.
 */
const MASCOTS = {
  bird: {
    name: "Pip",
    defaultSays: "Tracking all deadlines!",
    render: (eyeRef) => (
      <svg viewBox="-20 -40 40 45" width="28" height="32" className="dh-mascot-svg" aria-hidden="true">
        <path className="dh-art-stroke" d="M-4 2 L-4 -4 M4 2 L4 -4" />
        <path className="dh-art-fill" d="M-14 -12 C-16 -24 -8 -32 2 -32 C13 -32 18 -22 16 -12 C14 -4 6 -2 0 -2 C-8 -2 -13 -5 -14 -12 Z" />
        <path className="dh-accent-fill" d="M15 -24 L23 -21 L15 -18 Z" />
        <path className="dh-accent-stroke" d="M-2 -30 L4 -46 L10 -29 Z" />
        <g ref={eyeRef}>
          <circle cx="5" cy="-22" r="3.2" className="dh-eye-white" />
          <circle cx="6" cy="-22" r="1.6" className="dh-pupil" />
        </g>
      </svg>
    ),
  },
  kid: {
    name: "Juno",
    defaultSays: "Ready to explore!",
    render: (eyeRef) => (
      <svg viewBox="-20 -45 40 48" width="28" height="34" className="dh-mascot-svg" aria-hidden="true">
        <path className="dh-art-fill" d="M-10 2 C-12 -12 -9 -24 -2 -28 L2 -28 C9 -24 12 -12 10 2 Z" />
        <circle cx="0" cy="-32" r="11" className="dh-art-fill" />
        <path className="dh-art-stroke thick" d="M-12 -38 C-4 -44 4 -44 12 -38" />
        <g ref={eyeRef}>
          <circle cx="-3" cy="-33" r="1.8" className="dh-pupil" />
          <circle cx="3" cy="-33" r="1.8" className="dh-pupil" />
        </g>
        <path className="dh-art-stroke thin" d="M-3 -27 C-1 -25 1 -25 3 -27" />
      </svg>
    ),
  },
  ghost: {
    name: "Boo",
    defaultSays: "Zero clashes!",
    render: (eyeRef) => (
      <svg viewBox="-20 -40 40 45" width="26" height="30" className="dh-mascot-svg" aria-hidden="true">
        <path className="dh-art-fill" d="M-14 2 L-14 -18 C-14 -32 -7 -38 0 -38 C7 -38 14 -32 14 -18 L14 2 C7 -1 -7 -1 -14 2 Z" />
        <g ref={eyeRef}>
          <circle cx="-4" cy="-24" r="3.8" className="dh-eye-white" />
          <circle cx="-4" cy="-24" r="1.8" className="dh-pupil" />
          <circle cx="5" cy="-24" r="3.8" className="dh-eye-white" />
          <circle cx="5" cy="-24" r="1.8" className="dh-pupil" />
        </g>
        <ellipse cx="0.5" cy="-16" rx="2.5" ry="3.5" className="dh-pupil" />
      </svg>
    ),
  },
  mushroom: {
    name: "Morel",
    defaultSays: "Drop posters here!",
    render: (eyeRef) => (
      <svg viewBox="-20 -40 40 45" width="28" height="32" className="dh-mascot-svg" aria-hidden="true">
        <path className="dh-art-fill" d="M-6 2 C-7 -6 -6 -14 -4 -18 L4 -18 C6 -14 7 -6 6 2 Z" />
        <path className="dh-accent-fill" d="M-17 -18 C-19 -30 -8 -37 0 -37 C8 -37 19 -30 17 -18 Z" />
        <circle cx="-8" cy="-26" r="2.5" className="dh-eye-white" />
        <circle cx="4" cy="-30" r="2" className="dh-eye-white" />
        <g ref={eyeRef}>
          <circle cx="-2.5" cy="-10" r="1.4" className="dh-pupil" />
          <circle cx="2.5" cy="-10" r="1.4" className="dh-pupil" />
        </g>
      </svg>
    ),
  },
  cat: {
    name: "Patch",
    defaultSays: "Great team!",
    render: (eyeRef) => (
      <svg viewBox="-20 -40 40 45" width="28" height="32" className="dh-mascot-svg" aria-hidden="true">
        <path className="dh-art-fill" d="M-12 2 C-14 -8 -11 -22 0 -22 C11 -22 14 -8 12 2 Z" />
        <path className="dh-art-fill" d="M-12 -16 L-14 -28 L-5 -21 Z" />
        <path className="dh-art-fill" d="M5 -21 L14 -28 L12 -16 Z" />
        <ellipse cx="0" cy="-14" rx="10" ry="8" className="dh-art-fill" />
        <g ref={eyeRef}>
          <circle cx="-3" cy="-15" r="2.2" className="dh-pupil" />
          <circle cx="3" cy="-15" r="2.2" className="dh-pupil" />
        </g>
        <path className="dh-art-stroke thin" d="M-1.5 -10 L0 -8.5 L1.5 -10" />
      </svg>
    ),
  },
  yeti: {
    name: "Bruno",
    defaultSays: "Settings locked in!",
    render: (eyeRef) => (
      <svg viewBox="-22 -45 44 48" width="30" height="34" className="dh-mascot-svg" aria-hidden="true">
        <path className="dh-art-fill" d="M-14 2 C-17 -12 -17 -26 -13 -34 C-10 -40 -4 -42 1 -42 C7 -42 13 -39 15 -32 C18 -24 18 -12 14 2 Z" />
        <path className="dh-accent-fill" d="M-9 -37 C-12 -42 -14 -46 -12 -50 C-9 -47 -6 -44 -3 -41 Z" />
        <path className="dh-accent-fill" d="M5 -41 C8 -44 11 -47 14 -50 C14 -46 12 -42 9 -37 Z" />
        <g ref={eyeRef}>
          <circle cx="-4" cy="-30" r="3.2" className="dh-eye-white" />
          <circle cx="-4" cy="-30" r="1.6" className="dh-pupil" />
          <circle cx="5" cy="-30" r="3.2" className="dh-eye-white" />
          <circle cx="5" cy="-30" r="1.6" className="dh-pupil" />
        </g>
        <path className="dh-art-stroke thin" d="M-3 -23 C-1 -20 2 -20 4 -23" />
      </svg>
    ),
  },
};

/**
 * Resolve mascot by name or keyword from text.
 */
function resolveMascot(text, explicitMascot) {
  if (explicitMascot && MASCOTS[explicitMascot]) return explicitMascot;
  const lower = String(text).toLowerCase();
  if (lower.includes("time") || lower.includes("line")) return "bird";
  if (lower.includes("discover") || lower.includes("find")) return "kid";
  if (lower.includes("add") || lower.includes("create") || lower.includes("new")) return "mushroom";
  if (lower.includes("inbox") || lower.includes("mail")) return "ghost";
  if (lower.includes("communit") || lower.includes("club") || lower.includes("team")) return "cat";
  if (lower.includes("setting") || lower.includes("profile")) return "yeti";
  return "bird";
}

export default function DoodleHeading({
  text = "",
  tag = "h1",
  mascot,
  says,
  showMascot = true,
  showSquiggle = true,
  className = "",
  style,
  children,
}) {
  const Tag = tag;
  const content = text || (typeof children === "string" ? children : "");

  const mascotKey = resolveMascot(content, mascot);
  const mascotConfig = MASCOTS[mascotKey] || MASCOTS.bird;
  const speechText = says || mascotConfig.defaultSays;

  const [talking, setTalking] = useState(false);
  const [hopping, setHopping] = useState(false);
  const talkTimerRef = useRef(0);
  const eyeRef = useRef(null);

  const words = useMemo(() => {
    return content.split(" ");
  }, [content]);

  // Pointer tracking for mascot eyes
  const onPointerMove = (e) => {
    if (!eyeRef.current) return;
    const rect = eyeRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    const dist = Math.hypot(dx, dy);
    const max = 2.4;
    const k = dist > 0 ? (max * Math.min(1, dist / 180)) / dist : 0;
    const tx = dx * k;
    const ty = dy * k;
    eyeRef.current.style.transform = `translate(${tx.toFixed(1)}px, ${ty.toFixed(1)}px)`;
  };

  const handleMascotClick = () => {
    setTalking(true);
    setHopping(true);
    clearTimeout(talkTimerRef.current);
    talkTimerRef.current = setTimeout(() => {
      setTalking(false);
      setHopping(false);
    }, 2800);
  };

  useEffect(() => {
    return () => clearTimeout(talkTimerRef.current);
  }, []);

  let globalCharIdx = 0;

  return (
    <div
      className={`dh-wrap ${className}`}
      style={style}
      onPointerMove={onPointerMove}
    >
      <style>{CSS}</style>
      <Tag className="dh-heading" aria-label={content}>
        <span className="dh-words">
          {words.map((word, wIdx) => {
            const chars = Array.from(word);
            return (
              <span key={wIdx} className="dh-word">
                {chars.map((char, cIdx) => {
                  const idx = globalCharIdx++;
                  const delay = 60 + idx * 42;
                  const rot = ((hash(idx * 2.3) - 0.5) * 8).toFixed(1);
                  return (
                    <span
                      key={cIdx}
                      className="dh-letter"
                      style={{
                        "--d": `${delay}ms`,
                        "--r": `${rot}deg`,
                      }}
                      data-char={char}
                    >
                      {char}
                    </span>
                  );
                })}
                {wIdx < words.length - 1 && <span className="dh-space">&nbsp;</span>}
              </span>
            );
          })}
        </span>

        {showMascot && (
          <span
            className={`dh-mascot-perch ${hopping ? "is-hop" : ""}`}
            onClick={handleMascotClick}
            title={`${mascotConfig.name}: click me!`}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleMascotClick();
              }
            }}
          >
            {mascotConfig.render(eyeRef)}

            {talking && (
              <span className="dh-speech-bubble" aria-live="polite">
                {speechText}
              </span>
            )}
          </span>
        )}
      </Tag>

      {showSquiggle && (
        <svg
          className="dh-squiggle"
          viewBox="0 0 160 12"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path
            pathLength={1}
            d="M 2 7 Q 20 2, 40 7 T 80 7 T 120 7 T 158 7"
            className="dh-squiggle-path"
          />
        </svg>
      )}
    </div>
  );
}

const CSS = `
.dh-wrap {
  position: relative;
  display: inline-flex;
  flex-direction: column;
  align-items: flex-start;
  margin-bottom: 0.35rem;
}

.dh-heading {
  display: inline-flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 0.15em;
  margin: 0;
  padding: 0;
  color: var(--ink, #0f172a);
  font-family: inherit;
  font-weight: 800;
  line-height: 1.15;
  letter-spacing: -0.035em;
  position: relative;
}

.dh-words {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: baseline;
}

.dh-word {
  display: inline-flex;
  align-items: baseline;
  white-space: nowrap;
}

.dh-space {
  display: inline-block;
  width: 0.28em;
}

.dh-letter {
  display: inline-block;
  transform-origin: 50% 100%;
  animation: dh-stamp 0.52s cubic-bezier(.2, .8, .25, 1.15) var(--d, 0ms) both;
  transition: transform 0.2s cubic-bezier(.3, 1.4, .5, 1), color 0.2s;
  cursor: default;
  user-select: none;
}

.dh-letter:hover {
  animation: dh-jiggle 0.55s cubic-bezier(.3, 1.5, .5, 1);
  color: var(--accent, #6366f1);
}

.dh-mascot-perch {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  position: relative;
  margin-left: 0.4rem;
  cursor: pointer;
  transform-origin: 50% 100%;
  animation: dh-pop-in 0.6s cubic-bezier(.3, 1.5, .5, 1) 0.3s both;
  user-select: none;
  vertical-align: middle;
}

.dh-mascot-perch:hover .dh-mascot-svg {
  transform: rotate(-6deg) scale(1.1);
}

.dh-mascot-svg {
  display: block;
  transition: transform 0.25s cubic-bezier(.3, 1.5, .5, 1);
}

.dh-art-fill {
  fill: var(--card, #ffffff);
  stroke: var(--ink, #0f172a);
  stroke-width: 2.2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.dh-art-stroke {
  fill: none;
  stroke: var(--ink, #0f172a);
  stroke-width: 2.2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.dh-art-stroke.thick {
  stroke-width: 3.2;
}

.dh-art-stroke.thin {
  stroke-width: 1.5;
}

.dh-accent-fill {
  fill: var(--accent, #6366f1);
  stroke: var(--ink, #0f172a);
  stroke-width: 2.2;
}

.dh-accent-stroke {
  fill: none;
  stroke: var(--accent, #6366f1);
  stroke-width: 2.2;
}

.dh-eye-white {
  fill: var(--card, #ffffff);
  stroke: var(--ink, #0f172a);
  stroke-width: 1.6;
}

.dh-pupil {
  fill: var(--ink, #0f172a);
  stroke: none;
}

.dh-mascot-perch.is-hop {
  animation: dh-hop 0.65s cubic-bezier(.3, .7, .4, 1);
}

.dh-speech-bubble {
  position: absolute;
  bottom: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%);
  background: var(--ink, #0f172a);
  color: var(--card, #ffffff);
  padding: 4px 9px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.18);
  pointer-events: none;
  z-index: 20;
  animation: dh-bubble-pop 0.3s cubic-bezier(.3, 1.6, .5, 1) both;
}

.dh-speech-bubble::after {
  content: "";
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border-width: 4px;
  border-style: solid;
  border-color: var(--ink, #0f172a) transparent transparent transparent;
}

.dh-squiggle {
  width: 100%;
  max-width: 220px;
  height: 8px;
  overflow: visible;
  margin-top: 2px;
}

.dh-squiggle-path {
  fill: none;
  stroke: var(--accent, #6366f1);
  stroke-width: 2.6;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-dasharray: 1;
  stroke-dashoffset: 1;
  animation: dh-draw 0.75s cubic-bezier(.5, 0, .2, 1) 0.32s both;
}

@keyframes dh-stamp {
  0% {
    opacity: 0;
    transform: translateY(-24px) scale(1.22) rotate(var(--r, 0deg));
  }
  55% {
    opacity: 1;
    transform: translateY(2px) scale(0.96, 1.04) rotate(0deg);
  }
  75% {
    transform: translateY(-1px) scale(1.03, 0.97);
  }
  100% {
    opacity: 1;
    transform: none;
  }
}

@keyframes dh-pop-in {
  0% {
    opacity: 0;
    transform: translateY(14px) scale(0.6) rotate(-8deg);
  }
  65% {
    opacity: 1;
    transform: translateY(-3px) scale(1.1) rotate(2deg);
  }
  100% {
    opacity: 1;
    transform: none;
  }
}

@keyframes dh-jiggle {
  0% { transform: none; }
  25% { transform: rotate(-5deg) scale(1.08, 0.94); }
  50% { transform: rotate(4deg) translateY(-4px) scale(0.96, 1.05); }
  75% { transform: rotate(-2deg) scale(1.02); }
  100% { transform: none; }
}

@keyframes dh-hop {
  0% { transform: none; }
  20% { transform: scale(1.15, 0.82); }
  45% { transform: translateY(-22px) scale(0.94, 1.1); }
  70% { transform: translateY(0) scale(1.12, 0.88); }
  85% { transform: scale(0.97, 1.03); }
  100% { transform: none; }
}

@keyframes dh-bubble-pop {
  0% { opacity: 0; transform: translateX(-50%) translateY(4px) scale(0.7); }
  100% { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
}

@keyframes dh-draw {
  to { stroke-dashoffset: 0; }
}

@media (prefers-reduced-motion: reduce) {
  .dh-letter, .dh-mascot-perch, .dh-squiggle-path {
    animation: none !important;
    opacity: 1 !important;
    transform: none !important;
    stroke-dashoffset: 0 !important;
  }
}
`;
