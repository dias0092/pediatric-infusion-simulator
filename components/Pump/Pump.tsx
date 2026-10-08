'use client';

import { useEffect, useRef, useState } from 'react';
import type { PumpState } from '@/lib/engine/pump';
import { pumpScreen, type PumpScreen, type ScreenLine } from '@/lib/engine/display';
import type { PumpButton } from '@/lib/engine/types';

const SELF_TEST_MS = 1500;
const SELF_TEST_SCREEN: PumpScreen = { tone: 'normal', header: 'SELF TEST…', lines: [], footer: 'OK' };

/** True for 1.5 s after the pump is switched on (cosmetic; the keys wait meanwhile). */
function useSelfTest(status: PumpState['status']): boolean {
  const previous = useRef(status);
  const [testing, setTesting] = useState(false);
  useEffect(() => {
    if (previous.current === 'off' && status !== 'off') setTesting(true);
    previous.current = status;
  }, [status]);
  useEffect(() => {
    if (!testing) return;
    const id = window.setTimeout(() => setTesting(false), SELF_TEST_MS);
    return () => window.clearTimeout(id);
  }, [testing]);
  return testing;
}

const KEY_TEXT: Record<PumpButton, string> = {
  POWER: '⏻',
  MENU: 'MENU',
  ENTER: 'ENTER',
  MUTE: '🔕',
  LEFT: '◀',
  MINUS: '−',
  PLUS: '+',
  RIGHT: '▶',
  START: 'START',
  STOP: 'STOP',
};

const KEY_ORDER: PumpButton[] = ['POWER', 'MENU', 'ENTER', 'MUTE', 'LEFT', 'MINUS', 'PLUS', 'RIGHT', 'START', 'STOP'];

const KEY_CLASS: Partial<Record<PumpButton, string>> = {
  POWER: 'key-power',
  START: 'key-start',
  STOP: 'key-stop',
};

interface PumpProps {
  state: PumpState;
  drugLabel: string | null;
  progress: number;
  /** Without a handler the keys are disabled (e.g. the picture on the home page). */
  onPress?: (button: PumpButton) => void;
}

export function Pump({ state, drugLabel, progress, onPress }: PumpProps) {
  const selfTest = useSelfTest(state.status);
  const screen = selfTest ? SELF_TEST_SCREEN : pumpScreen(state, drugLabel, progress);
  return (
    <div className="pump" role="group" aria-label="Infusion pump">
      <div className="pump-top">
        <span className="pump-brand">PIS-1</span>
        <span className={`pump-led ${state.status === 'running' ? 'led-green' : ''}`} title="RUN" />
        <span className={`pump-led ${screen.tone === 'warn' ? 'led-amber' : ''}`} title="WARNING" />
        <span className={`pump-led ${screen.tone === 'alarm' ? 'led-red' : ''}`} title="ALARM" />
        <span className="pump-power" aria-label={state.onMains ? 'mains' : 'battery'}>
          {state.onMains ? '🔌' : '🔋'}
        </span>
      </div>
      <div className={`pump-screen tone-${screen.tone}`}>
        {screen.tone !== 'off' && (
          <>
            <div className="pump-screen-header" aria-live="polite">{screen.header}</div>
            {screen.lines.map((line) => (
              <Line key={line.label} line={line} />
            ))}
            <div className="pump-screen-footer">{screen.footer}</div>
          </>
        )}
      </div>
      <div className="pump-keys">
        {KEY_ORDER.map((button) => (
          <button
            key={button}
            type="button"
            aria-label={button}
            className={`pump-key ${KEY_CLASS[button] ?? ''}`}
            disabled={!onPress || selfTest}
            onClick={() => onPress?.(button)}
          >
            {KEY_TEXT[button]}
          </button>
        ))}
      </div>
    </div>
  );
}

function Line({ line }: { line: ScreenLine }) {
  return (
    <div className={`pump-line ${line.selected ? 'is-selected' : ''}`}>
      <span className="pump-line-label">
        {line.selected ? '▸' : ' '}
        {line.label}
      </span>
      <span className="pump-line-value">
        {line.digits ? <Digits digits={line.digits} cursor={line.cursor ?? 0} /> : line.value}
      </span>
      <span className="pump-line-unit">{line.unit}</span>
    </div>
  );
}

function Digits({ digits, cursor }: { digits: number[]; cursor: number }) {
  return (
    <>
      {digits.map((digit, i) => (
        <span key={i}>
          {i === digits.length - 1 ? '.' : ''}
          <span className={i === cursor ? 'digit-cursor' : undefined}>{digit}</span>
        </span>
      ))}
    </>
  );
}
