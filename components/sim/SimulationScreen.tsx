'use client';

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { addHistory } from '@/lib/client/history';
import { browserOutbox, type FlushOutcome } from '@/lib/client/outbox';
import { beep, startAlarmSound, stopAlarmSound, unlockAudio } from '@/lib/client/sound';
import { KEYS, localKV } from '@/lib/client/storage';
import { gradeSession } from '@/lib/engine/grading';
import { pressButton } from '@/lib/engine/pump';
import { applyEvent, createSession, type Session } from '@/lib/engine/session';
import type { EventInput, Mode, PumpButton, Scenario, SimEvent } from '@/lib/engine/types';
import { getScenario } from '@/lib/scenarios';
import { APP_VERSION } from '@/lib/version';
import { useI18n } from '../I18nProvider';
import { NicknameDialog, readNickname } from '../NicknameDialog';
import { Page } from '../ui';
import { AlarmPanel } from './AlarmPanel';
import { FeedbackBanner } from './FeedbackBanner';
import { InfusionControls, speedFactor, type Speed } from './InfusionControls';
import { PatientCard } from './PatientCard';
import { PumpStep } from './PumpStep';
import { ResultSummary, type SubmitState } from './ResultSummary';
import { StepCalc } from './StepCalc';
import { StepDrug } from './StepDrug';
import { StepRoute } from './StepRoute';

export function SimulationScreen({ scenarioId, mode }: { scenarioId: string; mode: Mode }) {
  const { d, l } = useI18n();
  const scenario = getScenario(scenarioId);
  const [mounted, setMounted] = useState(false);
  const [nickname, setNickname] = useState<string | null>(null);
  const [run, setRun] = useState(0);

  useEffect(() => {
    setMounted(true);
    setNickname(readNickname());
  }, []);

  if (!scenario) return null;
  const title = `${scenario.number}. ${l(scenario.title)}`;
  const back = `/scenarios?mode=${mode}`;
  if (!mounted) {
    return (
      <Page title={title} back={back}>
        <p className="text-sm text-[var(--muted)]">{d.common.loading}</p>
      </Page>
    );
  }
  if (!nickname) {
    return (
      <Page title={title} back={back}>
        <NicknameDialog onSave={setNickname} />
      </Page>
    );
  }
  return (
    <SimulationRun
      key={run}
      scenario={scenario}
      mode={mode}
      nickname={nickname}
      title={title}
      back={back}
      onRetry={() => setRun((n) => n + 1)}
    />
  );
}

interface RunState {
  session: Session;
  events: SimEvent[];
}

/** Applies one event; an event the engine rejects (a UI bug) is logged and dropped. */
function reducer(state: RunState, event: SimEvent): RunState {
  try {
    return { session: applyEvent(state.session, event), events: [...state.events, event] };
  } catch (error) {
    console.error('Ignored simulation event', event, error);
    return state;
  }
}

interface RunProps {
  scenario: Scenario;
  mode: Mode;
  nickname: string;
  title: string;
  back: string;
  onRetry: () => void;
}

function SimulationRun({ scenario, mode, nickname, title, back, onRetry }: RunProps) {
  const { d, locale } = useI18n();
  const [state, dispatch] = useReducer(reducer, undefined, () => ({ session: createSession(scenario, mode), events: [] }));
  const { session } = state;
  const { pump, alarm, step } = session;
  const spec = scenario.alarm;

  const startedAt = useRef(0);
  const [attemptId] = useState(() => crypto.randomUUID());
  const [progress, setProgress] = useState(0);
  const [speed, setSpeed] = useState<Speed>('normal');
  const [soundOn, setSoundOn] = useState(() => localKV.get(KEYS.sound) !== 'off');
  const [submit, setSubmit] = useState<SubmitState>('idle');
  const submitted = useRef(false);

  useEffect(() => {
    startedAt.current = performance.now();
  }, []);

  const send = useCallback((input: EventInput) => {
    dispatch({ ...input, t: Math.round(performance.now() - startedAt.current) } as SimEvent);
  }, []);

  const press = useCallback(
    (button: PumpButton) => {
      unlockAudio();
      // START with an empty RATE or VTBI: the pump refuses with a short beep.
      if (soundOn && pressButton(pump, button).effect === 'beep') beep(440, 200);
      send({ type: 'pumpButton', button });
    },
    [send, soundOn, pump],
  );

  // Simulated clock: progress stops at the next pending alarm threshold.
  const running = step === 'infusion' && pump.status === 'running';
  const simSec = pump.rateTenths > 0 ? (pump.vtbiTenths / pump.rateTenths) * 3600 : 0;
  const cap =
    spec && alarm === null
      ? spec.atProgress
      : spec?.type === 'lowBattery' && alarm && !alarm.resolved && !alarm.depleted
        ? (spec.depleteAtProgress ?? 1)
        : 1;

  useEffect(() => {
    if (!running || simSec <= 0) return;
    const factor = speedFactor(speed, simSec);
    let last = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      const dt = (now - last) / 1000;
      last = now;
      setProgress((p) => Math.min(cap, p + (dt * factor) / simSec));
    }, 100);
    return () => window.clearInterval(id);
  }, [running, simSec, speed, cap]);

  // Events produced by the simulated clock.
  useEffect(() => {
    if (step !== 'infusion' || pump.status !== 'running') return;
    if (spec && alarm === null && progress >= spec.atProgress) {
      send({ type: 'alarmRaised', alarm: spec.type });
    } else if (
      spec?.type === 'lowBattery' &&
      alarm &&
      !alarm.resolved &&
      !alarm.depleted &&
      progress >= (spec.depleteAtProgress ?? 1)
    ) {
      send({ type: 'batteryDepleted' });
    } else if (progress >= 1 && !pump.alarm && (!spec || alarm?.resolved)) {
      send({ type: 'infusionCompleted' });
    }
  }, [progress, step, pump.status, pump.alarm, spec, alarm, send]);

  // Alarm sound and vibration.
  const sounding = !!pump.alarm && !pump.alarm.muted;
  useEffect(() => {
    if (sounding && soundOn) startAlarmSound();
    else stopAlarmSound();
  }, [sounding, soundOn]);
  useEffect(() => stopAlarmSound, []);
  const alarmRaised = alarm !== null;
  useEffect(() => {
    if (alarmRaised) navigator.vibrate?.([300, 150, 300]);
  }, [alarmRaised]);

  // Finish: grade locally, keep in history, queue for the server and try to send now.
  const grade = useMemo(() => (session.finished ? gradeSession(session) : null), [session]);
  useEffect(() => {
    if (!grade || submitted.current) return;
    submitted.current = true;
    if (soundOn) beep(660, 300);
    addHistory(localKV, {
      id: attemptId,
      scenarioId: scenario.id,
      mode,
      score: grade.score,
      passed: grade.passed,
      durationSec: grade.durationSec,
      createdAt: new Date().toISOString(),
    });
    browserOutbox.enqueue({
      id: attemptId,
      nickname,
      scenarioId: scenario.id,
      mode,
      locale,
      appVersion: APP_VERSION,
      events: state.events,
    });
    setSubmit('sending');
    void browserOutbox.flush().then((outcomes) => {
      const outcome: FlushOutcome =
        outcomes[attemptId] ?? (browserOutbox.pending().some((p) => p.id === attemptId) ? 'queued' : 'sent');
      setSubmit(outcome);
    });
  }, [grade, attemptId, scenario.id, mode, nickname, locale, state.events, soundOn]);

  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    localKV.set(KEYS.sound, next ? 'on' : 'off');
  };

  const showPump = step === 'pump' || step === 'infusion' || step === 'done';
  const calcStep = scenario.calcSteps[session.calcIndex];

  return (
    <Page title={title} back={back}>
      <div className="mb-3 flex items-center gap-2 text-sm">
        <span className="badge">{d.modes[mode]}</span>
        <span className="truncate text-[var(--muted)]">{nickname}</span>
      </div>
      <div className="grid gap-4 md:grid-cols-2 md:items-start">
        <div className="space-y-4">
          <PatientCard scenario={scenario} />
          {!showPump && <FeedbackBanner feedback={session.feedback} mode={mode} />}
          {step === 'drug' && <StepDrug session={session} onSelect={(optionId) => send({ type: 'drugSelected', optionId })} />}
          {step === 'route' && <StepRoute session={session} onSelect={(routeId) => send({ type: 'routeSelected', routeId })} />}
          {step === 'calc' && calcStep && (
            <StepCalc
              key={calcStep.id}
              session={session}
              onAnswer={(value, unit) => send({ type: 'calcAnswered', stepId: calcStep.id, value, unit })}
            />
          )}
          {grade && <ResultSummary grade={grade} mode={mode} submit={submit} onRetry={onRetry} />}
        </div>
        {showPump && (
          <div className="space-y-4">
            <FeedbackBanner feedback={session.feedback} mode={mode} />
            <PumpStep
              session={session}
              progress={progress}
              onPress={session.finished ? undefined : press}
              onChecklist={() => send({ type: 'checklistCompleted' })}
            />
            {session.alarm?.autoResolved && (
              <p className="rounded-lg bg-amber-50 p-3 text-sm" role="status">
                {d.infusion.seniorResolved}
              </p>
            )}
            {step === 'infusion' && <AlarmPanel session={session} onAction={(actionId) => send({ type: 'alarmAction', actionId })} />}
            {step === 'infusion' && (
              <InfusionControls speed={speed} onSpeed={setSpeed} soundOn={soundOn} onToggleSound={toggleSound} />
            )}
          </div>
        )}
      </div>
    </Page>
  );
}
