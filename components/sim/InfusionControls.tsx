'use client';

import { useI18n } from '../I18nProvider';

export type Speed = 'realtime' | 'normal' | 'fast';

const TARGET_SECONDS = { normal: 60, fast: 10 } as const;

/** How many simulated seconds pass per real second. */
export function speedFactor(speed: Speed, simulatedSeconds: number): number {
  return speed === 'realtime' ? 1 : Math.max(1, simulatedSeconds / TARGET_SECONDS[speed]);
}

const SPEEDS: Speed[] = ['realtime', 'normal', 'fast'];

interface InfusionControlsProps {
  speed: Speed;
  onSpeed: (speed: Speed) => void;
  soundOn: boolean;
  onToggleSound: () => void;
}

export function InfusionControls({ speed, onSpeed, soundOn, onToggleSound }: InfusionControlsProps) {
  const { d } = useI18n();
  return (
    <div className="card space-y-2">
      <div className="text-sm font-medium">{d.infusion.speed}</div>
      <div className="grid grid-cols-3 gap-2" role="group" aria-label={d.infusion.speed}>
        {SPEEDS.map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={speed === s}
            className={`btn ${speed === s ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => onSpeed(s)}
          >
            {d.infusion[s]}
          </button>
        ))}
      </div>
      <button type="button" className="btn btn-secondary w-full" onClick={onToggleSound}>
        {soundOn ? d.common.soundOn : d.common.soundOff}
      </button>
    </div>
  );
}
