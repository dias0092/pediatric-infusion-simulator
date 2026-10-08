let ctx: AudioContext | null = null;
let timer: ReturnType<typeof setInterval> | null = null;

function context(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** Call from a user gesture (a button press) so that later alarms are allowed to play. */
export function unlockAudio(): void {
  context();
}

export function beep(frequency = 880, durationMs = 120): void {
  const c = context();
  if (!c) return;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = 'square';
  osc.frequency.value = frequency;
  gain.gain.value = 0.08;
  osc.connect(gain).connect(c.destination);
  osc.start();
  osc.stop(c.currentTime + durationMs / 1000);
}

export function startAlarmSound(): void {
  if (timer) return;
  const pattern = () => {
    beep(960, 160);
    setTimeout(() => beep(720, 160), 220);
  };
  pattern();
  timer = setInterval(pattern, 1000);
}

export function stopAlarmSound(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
