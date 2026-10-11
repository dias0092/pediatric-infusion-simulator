interface DripLineProps {
  /** Fraction of VTBI already infused, 0..1. */
  progress: number;
  running: boolean;
  rateMlH: number;
}

/** Bag → drip chamber → line → patient. The bag empties with progress; drops fall while running. */
export function DripLine({ progress, running, rateMlH }: DripLineProps) {
  const level = Math.min(1, Math.max(0, 1 - progress));
  const dropSeconds = Math.min(2, Math.max(0.35, 60 / Math.max(rateMlH, 1)));
  return (
    <svg className="drip" viewBox="0 0 320 84" role="img" aria-label="IV bag, line and patient">
      <rect x="8" y="4" width="40" height="56" rx="8" className="drip-bag" />
      <rect x="10" y={6 + 52 * (1 - level)} width="36" height={52 * level} rx="6" className="drip-fluid" />
      <rect x="22" y="62" width="12" height="14" rx="3" className="drip-chamber" />
      {running && <circle cx="28" cy="65" r="2.5" className="drip-drop" style={{ animationDuration: `${dropSeconds}s` }} />}
      <path d="M28 76 V80 H276" className="drip-tube" />
      <path d="M28 76 V80 H276" className={`drip-flow ${running ? 'is-running' : ''}`} />
      <text x="282" y="76" fontSize="28">
        🧒
      </text>
    </svg>
  );
}
