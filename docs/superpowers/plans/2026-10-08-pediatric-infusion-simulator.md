# Pediatric Infusion Simulator — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Мобильный веб-симулятор педиатрического инфузомата (5 сценариев, два режима, тревоги, баллы) с бэкендом результатов и рейтингом, задеплоенный на Vercel.

**Architecture:** Один проект Next.js (App Router). Вся логика симуляции — чистый TypeScript в `lib/engine` (событийный журнал → `applyEvent` → `gradeSession`); тот же код работает в браузере и на сервере, поэтому сервер пересчитывает баллы. API — Route Handlers, хранилище — Postgres (Neon) за интерфейсом `ResultsRepo` (в разработке и e2e — `MemoryRepo`).

**Tech Stack:** Next.js 16.4.0, React 19.3.0, TypeScript ^5.9.3, Tailwind CSS 4.3.3, Vitest 5.0.3 (+ Vite 8.3.4), zod 4.6.5, @neondatabase/serverless 1.2.0, qrcode 1.5.4, Playwright 1.64.0, Vercel CLI 63.

**Spec:** `docs/superpowers/specs/2026-10-08-pediatric-infusion-simulator-design.md`

## Global Constraints

- TypeScript `^5.9.3`, не 7.x (официальный шаблон Next.js 16.4 закрепляет `^5`).
- Внутри `lib/engine`, `lib/scenarios`, `lib/client`, `lib/server`, `lib/i18n` — только относительные импорты (их читают Vitest и Playwright); в `app/` и `components/` — алиас `@/`.
- Языки интерфейса: `ru` (по умолчанию) и `kk`; надписи на дисплее и кнопках насоса — английские.
- Пометка на главной и в подвале: «Учебный тренажёр. Не для клинического применения.» / «Оқу тренажёры. Клиникалық қолдануға арналмаған.»
- Баллы: препарат 15, путь 15, расчёт 20, скорость 20, VTBI и время 10, двойная проверка 10, тревога / без ошибок 10. Допуск расчёта `0.05`. `CRITICAL_RATE_RATIO = 2`. Правило попыток в режиме с подсказками ×1 / ×0,5 / ×0.
- Пределы насоса: RATE 0,0–999,9 мл/ч (4 цифры в десятых), VTBI 0,0–9999,9 мл (5 цифр в десятых).
- О человеке хранится только ник (2–20 символов). IP не хранится.
- Секреты (`DATABASE_URL`, `ADMIN_TOKEN`) никогда не выводятся в чат и логи; `.env*` в `.gitignore`.
- Каждый коммит заканчивается строкой `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Небольшое расширение спецификации: у ускорения времени три режима — «Реальное время» (×1), «Обычно» (≈60 с), «Быстро» (≈10 с); «Быстро» нужен для ярмарки и для e2e-теста.
- Тесты — не больше 4 воркеров (машина пользователя: 14 ядер / 24 ГБ; хук пользователя блокирует неограниченные прогоны). `maxWorkers: 4` в `vitest.config.mts`, и в командах всегда `npm test -- --maxWorkers=4`.

## Карта файлов

```
package.json, tsconfig.json, next.config.ts, postcss.config.mjs, vitest.config.mts,
playwright.config.ts, .gitignore
app/
  layout.tsx, globals.css, page.tsx
  scenarios/page.tsx, sim/[scenarioId]/page.tsx, learn/page.tsx,
  results/page.tsx, stand/page.tsx, admin/page.tsx
  api/results/route.ts, api/leaderboard/route.ts,
  api/admin/results/route.ts, api/admin/hide/route.ts
lib/
  version.ts                      APP_VERSION
  nickname.ts                     validateNickname (общий для клиента и сервера)
  engine/types.ts                 типы и перечисления
  engine/calc.ts                  формулы, expectedValues, форматирование времени
  engine/pump.ts                  автомат насоса
  engine/session.ts               applyEvent, replay, ReplayError
  engine/grading.ts               gradeSession
  engine/display.ts               модель дисплея насоса (pumpScreen)
  engine/testing.ts               programPump, perfectEvents (для тестов)
  scenarios/s1-…s5-*.ts, index.ts данные сценариев
  i18n/ru.ts, kk.ts, index.ts     словари
  client/storage.ts, history.ts, outbox.ts, shuffle.ts, sound.ts
  server/repo.ts, memory-repo.ts, postgres-repo.ts, get-repo.ts,
  server/admin-auth.ts, payload.ts, results-service.ts
components/
  I18nProvider.tsx, Providers.tsx, ui.tsx, LocaleSwitch.tsx, NicknameDialog.tsx, Leaderboard.tsx
  Pump/Pump.tsx, Pump/DripLine.tsx
  sim/SimulationScreen.tsx, PatientCard.tsx, StepDrug.tsx, StepRoute.tsx,
  sim/StepCalc.tsx, PumpStep.tsx, Checklist.tsx, AlarmPanel.tsx,
  sim/InfusionControls.tsx, FeedbackBanner.tsx, ResultSummary.tsx
  screens/HomeScreen.tsx, ScenarioList.tsx, LearnScreen.tsx,
  screens/ResultsScreen.tsx, StandScreen.tsx, AdminScreen.tsx
db/schema.sql
scripts/migrate.mjs
tests/e2e/scenario1.spec.ts
```

---

### Task 1: Каркас проекта

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `vitest.config.mts`, `.gitignore`
- Create: `app/layout.tsx`, `app/globals.css`, `app/page.tsx`, `lib/version.ts`
- Test: `lib/version.test.ts`

**Interfaces:**
- Produces: `APP_VERSION: string` из `lib/version.ts`; команды `npm test`, `npm run build`, `npm run typecheck`.

- [ ] **Step 1: Создать `package.json`**

```json
{
  "name": "pediatric-infusion-simulator",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "next typegen && tsc --noEmit",
    "e2e": "playwright test",
    "db:migrate": "node --env-file=.env.local scripts/migrate.mjs"
  },
  "dependencies": {
    "@neondatabase/serverless": "1.2.0",
    "next": "16.4.0",
    "qrcode": "1.5.4",
    "react": "19.3.0",
    "react-dom": "19.3.0",
    "zod": "4.6.5"
  },
  "devDependencies": {
    "@playwright/test": "1.64.0",
    "@tailwindcss/postcss": "4.3.3",
    "@types/node": "^24",
    "@types/qrcode": "1.5.6",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "tailwindcss": "4.3.3",
    "typescript": "^5.9.3",
    "vite": "8.3.4",
    "vitest": "5.0.3"
  }
}
```

- [ ] **Step 2: Создать конфиги**

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": [
    "next-env.d.ts",
    "**/*.ts",
    "**/*.tsx",
    ".next/types/**/*.ts",
    ".next/dev/types/**/*.ts",
    "**/*.mts"
  ],
  "exclude": ["node_modules"]
}
```

`next.config.ts`:

```ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {};

export default nextConfig;
```

`postcss.config.mjs`:

```js
const config = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};

export default config;
```

`vitest.config.mts`:

```ts
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: [{ find: /^@\//, replacement: fileURLToPath(new URL('./', import.meta.url)) }],
  },
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts', 'app/**/*.test.ts'],
    maxWorkers: 4,
  },
});
```

`.gitignore`:

```gitignore
/node_modules
/.next/
/out/
/build
/coverage
/test-results/
/playwright-report/
/playwright/.cache/
.DS_Store
*.pem
npm-debug.log*
.env*
.vercel
*.tsbuildinfo
next-env.d.ts
```

- [ ] **Step 3: Создать минимальное приложение**

`lib/version.ts`:

```ts
export const APP_VERSION = '1.0.0';
```

`app/globals.css`:

```css
@import "tailwindcss";

:root {
  --bg: #f4f7f7;
  --fg: #10201f;
  --muted: #5b6b6a;
  --brand: #0f766e;
  --brand-ink: #ffffff;
  --card: #ffffff;
  --line: #d5dfde;
  --ok: #15803d;
  --warn: #b45309;
  --bad: #b91c1c;
}

body {
  background: var(--bg);
  color: var(--fg);
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
}
```

`app/layout.tsx`:

```tsx
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'Pediatric Infusion Simulator',
  description: 'Учебный симулятор инфузомата для педиатрии',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0f766e',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
```

`app/page.tsx`:

```tsx
export default function Page() {
  return <main className="p-4">Pediatric Infusion Simulator</main>;
}
```

- [ ] **Step 4: Написать тест версии**

`lib/version.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { APP_VERSION } from './version';

describe('APP_VERSION', () => {
  it('matches package.json', () => {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
    expect(APP_VERSION).toBe(pkg.version);
  });
});
```

- [ ] **Step 5: Установить зависимости и проверить**

Run: `npm install`
Expected: установка без ошибок (предупреждения `npm warn` допустимы).

Run: `npm test -- --maxWorkers=4`
Expected: `1 passed`.

Run: `npm run build`
Expected: `✓ Compiled successfully`, маршрут `/` в списке.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json tsconfig.json next.config.ts postcss.config.mjs vitest.config.mts .gitignore app lib/version.ts lib/version.test.ts
git commit -m "chore: scaffold Next.js project with Vitest" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 2: Типы и формулы (`lib/engine/types.ts`, `lib/engine/calc.ts`)

**Files:**
- Create: `lib/engine/types.ts`, `lib/engine/calc.ts`
- Test: `lib/engine/calc.test.ts`

**Interfaces:**
- Produces (types.ts): `LOCALES`, `Locale`, `L10n`, `MODES`, `Mode`, `ROUTE_IDS`, `RouteId`, `UNIT_IDS`, `UnitId`, `PUMP_BUTTONS`, `PumpButton`, `ALARM_TYPES`, `AlarmType`, `ERROR_CODES`, `ErrorCode`, `SimError`, `Prescription`, `DrugOption`, `CalcQuantity`, `CalcStep`, `AlarmAction`, `AlarmSpec`, `Patient`, `Scenario`, `SimEvent`, `EventInput`.
- Produces (calc.ts): `round1(x)`, `doseMg(mgPerKg, kg)`, `volumeFromDose(mg, mgPerMl)`, `volumeFromMlPerKg(mlPerKg, kg)`, `rateMlH(ml, min)`, `maintenance421(kg)`, `girRateMlH(gir, kg, mgPerMl)`, `timeHours(vtbi, rate)`, `interface Expected { doseMg: number | null; volumeMl: number; rateMlH: number; vtbiMl: number; durationMin: number }`, `expectedValues(p: Prescription, kg): Expected`, `formatDuration(hours): string` (`'0:15'`), `formatRemaining(seconds): string` (`'29:59'`, `'1:00:00'`).

- [ ] **Step 1: Создать `lib/engine/types.ts`**

```ts
export const LOCALES = ['ru', 'kk'] as const;
export type Locale = (typeof LOCALES)[number];
export type L10n = Record<Locale, string>;

export const MODES = ['learning', 'exam'] as const;
export type Mode = (typeof MODES)[number];

export const ROUTE_IDS = ['piv', 'cvc', 'picc', 'io'] as const;
export type RouteId = (typeof ROUTE_IDS)[number];

export const UNIT_IDS = ['mg', 'g', 'ml', 'ml_h', 'mg_kg', 'ml_kg', 'mg_ml'] as const;
export type UnitId = (typeof UNIT_IDS)[number];

export const PUMP_BUTTONS = [
  'POWER', 'MENU', 'LEFT', 'RIGHT', 'PLUS', 'MINUS', 'ENTER', 'START', 'STOP', 'MUTE',
] as const;
export type PumpButton = (typeof PUMP_BUTTONS)[number];

export const ALARM_TYPES = ['occlusion', 'airInLine', 'lowBattery'] as const;
export type AlarmType = (typeof ALARM_TYPES)[number];

export const ERROR_CODES = [
  'wrongDrug', 'criticalDrug', 'routeNotAvailable', 'wrongRoute', 'criticalRoute',
  'wrongCalc', 'wrongUnit', 'wrongRate', 'criticalRate', 'wrongVtbi',
  'ignoredLimitWarning', 'startWithoutCheck', 'wrongAlarmAction', 'restartWithoutFix',
  'stoppedNeedlessly', 'batteryDepleted',
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export interface SimError {
  code: ErrorCode;
  ref?: string;
}

export type Prescription =
  | { kind: 'dosePerKg'; mgPerKg: number; concentrationMgPerMl: number; durationMin: number }
  | { kind: 'volumePerKg'; mlPerKg: number; durationMin: number }
  | { kind: 'maintenance421'; durationMin: number }
  | { kind: 'gir'; mgPerKgMin: number; concentrationMgPerMl: number; durationMin: number };

export interface DrugOption {
  id: string;
  name: L10n;
  /** Text on the pump display, English, e.g. "PARACETAMOL 10 mg/mL". */
  pumpLabel: string;
  /** Training drug-library soft limits, ml/h. */
  softMinRate: number;
  softMaxRate: number;
  critical?: boolean;
}

export type CalcQuantity = 'doseMg' | 'volumeMl' | 'rateMlH';

export interface CalcStep {
  id: string;
  quantity: CalcQuantity;
  prompt: L10n;
  hint: L10n;
  unit: UnitId;
  unitOptions: UnitId[];
}

export interface AlarmAction {
  id: string;
  label: L10n;
  /** Shown after the action, e.g. the cause found while inspecting the line. */
  reveals?: L10n;
}

export interface AlarmSpec {
  type: AlarmType;
  /** Fraction of VTBI infused when the alarm fires, 0..1. */
  atProgress: number;
  /** lowBattery only: fraction at which the battery runs out if not on mains. */
  depleteAtProgress?: number;
  actions: AlarmAction[];
  /** Ids of the correct actions in the required order (the final START is implicit). */
  sequence: string[];
}

export interface Patient {
  code: string;
  age: L10n;
  weightKg: number;
  condition: L10n;
  accesses: RouteId[];
}

export interface Scenario {
  id: string;
  number: number;
  title: L10n;
  reviewStatus: 'draft' | 'reviewed';
  patient: Patient;
  order: L10n;
  prescription: Prescription;
  drugOptions: DrugOption[];
  correctDrugId: string;
  acceptableRoutes: RouteId[];
  criticalRoutes: RouteId[];
  calcSteps: CalcStep[];
  alarm: AlarmSpec | null;
  sources: string[];
}

export type SimEvent =
  | { type: 'drugSelected'; optionId: string; t: number }
  | { type: 'routeSelected'; routeId: RouteId; t: number }
  | { type: 'calcAnswered'; stepId: string; value: number; unit: UnitId; t: number }
  | { type: 'pumpButton'; button: PumpButton; t: number }
  | { type: 'checklistCompleted'; t: number }
  | { type: 'alarmRaised'; alarm: AlarmType; t: number }
  | { type: 'batteryDepleted'; t: number }
  | { type: 'alarmAction'; actionId: string; t: number }
  | { type: 'infusionCompleted'; t: number };

type WithoutT<T> = T extends unknown ? Omit<T, 't'> : never;
/** A SimEvent before the session clock stamps it with `t`. */
export type EventInput = WithoutT<SimEvent>;
```

- [ ] **Step 2: Написать падающие тесты `lib/engine/calc.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import {
  doseMg, expectedValues, formatDuration, formatRemaining, girRateMlH, maintenance421,
  rateMlH, round1, timeHours, volumeFromDose, volumeFromMlPerKg,
} from './calc';

describe('formulas', () => {
  it('dose, volume, rate', () => {
    expect(doseMg(15, 14)).toBe(210);
    expect(volumeFromDose(210, 10)).toBe(21);
    expect(volumeFromMlPerKg(30, 12)).toBe(360);
    expect(rateMlH(21, 15)).toBe(84);
    expect(timeHours(21, 84)).toBe(0.25);
  });

  it('4-2-1 rule', () => {
    expect(maintenance421(8)).toBe(32);
    expect(maintenance421(15)).toBe(50);
    expect(maintenance421(25)).toBe(65);
  });

  it('GIR', () => {
    expect(round1(girRateMlH(6, 6, 200))).toBe(10.8);
  });

  it('round1', () => {
    expect(round1(10.800000000000001)).toBe(10.8);
    expect(round1(43.2)).toBe(43.2);
  });
});

describe('expectedValues', () => {
  it('dosePerKg', () => {
    expect(
      expectedValues({ kind: 'dosePerKg', mgPerKg: 15, concentrationMgPerMl: 10, durationMin: 15 }, 14),
    ).toEqual({ doseMg: 210, volumeMl: 21, rateMlH: 84, vtbiMl: 21, durationMin: 15 });
  });

  it('volumePerKg', () => {
    expect(expectedValues({ kind: 'volumePerKg', mlPerKg: 30, durationMin: 30 }, 12)).toEqual({
      doseMg: null, volumeMl: 360, rateMlH: 720, vtbiMl: 360, durationMin: 30,
    });
  });

  it('maintenance421', () => {
    expect(expectedValues({ kind: 'maintenance421', durationMin: 480 }, 15)).toEqual({
      doseMg: null, volumeMl: 400, rateMlH: 50, vtbiMl: 400, durationMin: 480,
    });
  });

  it('gir', () => {
    expect(
      expectedValues({ kind: 'gir', mgPerKgMin: 6, concentrationMgPerMl: 200, durationMin: 240 }, 6),
    ).toEqual({ doseMg: null, volumeMl: 43.2, rateMlH: 10.8, vtbiMl: 43.2, durationMin: 240 });
  });
});

describe('formatting', () => {
  it('formatDuration', () => {
    expect(formatDuration(0.25)).toBe('0:15');
    expect(formatDuration(0.5)).toBe('0:30');
    expect(formatDuration(4)).toBe('4:00');
    expect(formatDuration(8)).toBe('8:00');
  });

  it('formatRemaining', () => {
    expect(formatRemaining(1799)).toBe('29:59');
    expect(formatRemaining(0)).toBe('00:00');
    expect(formatRemaining(3600)).toBe('1:00:00');
    expect(formatRemaining(28799.4)).toBe('7:59:59');
  });
});
```

- [ ] **Step 3: Запустить и убедиться, что тесты падают**

Run: `npx vitest run lib/engine/calc.test.ts`
Expected: FAIL — `Failed to resolve import "./calc"`.

- [ ] **Step 4: Реализовать `lib/engine/calc.ts`**

```ts
import type { Prescription } from './types';

export const round1 = (x: number): number => Math.round(x * 10) / 10;

export const doseMg = (mgPerKg: number, weightKg: number): number => mgPerKg * weightKg;

export const volumeFromDose = (dose: number, concentrationMgPerMl: number): number =>
  dose / concentrationMgPerMl;

export const volumeFromMlPerKg = (mlPerKg: number, weightKg: number): number => mlPerKg * weightKg;

export const rateMlH = (volumeMl: number, durationMin: number): number => volumeMl / (durationMin / 60);

/** Holliday–Segar hourly rule: 4 ml/kg/h for the first 10 kg, 2 for the next 10, 1 above 20 kg. */
export function maintenance421(weightKg: number): number {
  const first = Math.min(weightKg, 10);
  const second = Math.min(Math.max(weightKg - 10, 0), 10);
  const rest = Math.max(weightKg - 20, 0);
  return 4 * first + 2 * second + rest;
}

export const girRateMlH = (mgPerKgMin: number, weightKg: number, concentrationMgPerMl: number): number =>
  (mgPerKgMin * weightKg * 60) / concentrationMgPerMl;

export const timeHours = (vtbiMl: number, rate: number): number => vtbiMl / rate;

export interface Expected {
  doseMg: number | null;
  volumeMl: number;
  rateMlH: number;
  vtbiMl: number;
  durationMin: number;
}

export function expectedValues(p: Prescription, weightKg: number): Expected {
  switch (p.kind) {
    case 'dosePerKg': {
      const dose = doseMg(p.mgPerKg, weightKg);
      const volume = round1(volumeFromDose(dose, p.concentrationMgPerMl));
      return {
        doseMg: round1(dose),
        volumeMl: volume,
        rateMlH: round1(rateMlH(volume, p.durationMin)),
        vtbiMl: volume,
        durationMin: p.durationMin,
      };
    }
    case 'volumePerKg': {
      const volume = round1(volumeFromMlPerKg(p.mlPerKg, weightKg));
      return {
        doseMg: null,
        volumeMl: volume,
        rateMlH: round1(rateMlH(volume, p.durationMin)),
        vtbiMl: volume,
        durationMin: p.durationMin,
      };
    }
    case 'maintenance421':
    case 'gir': {
      const rate = round1(
        p.kind === 'gir'
          ? girRateMlH(p.mgPerKgMin, weightKg, p.concentrationMgPerMl)
          : maintenance421(weightKg),
      );
      const vtbi = round1((rate * p.durationMin) / 60);
      return { doseMg: null, volumeMl: vtbi, rateMlH: rate, vtbiMl: vtbi, durationMin: p.durationMin };
    }
  }
}

const pad2 = (n: number): string => String(n).padStart(2, '0');

/** Hours → "H:MM", as on the pump TIME line. */
export function formatDuration(hours: number): string {
  const totalMin = Math.round(hours * 60);
  return `${Math.floor(totalMin / 60)}:${pad2(totalMin % 60)}`;
}

/** Seconds → "MM:SS" below one hour, otherwise "H:MM:SS". */
export function formatRemaining(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}:${pad2(m)}:${pad2(s)}` : `${pad2(m)}:${pad2(s)}`;
}
```

- [ ] **Step 5: Запустить тесты**

Run: `npx vitest run lib/engine/calc.test.ts`
Expected: PASS (все тесты).

- [ ] **Step 6: Commit**

```bash
git add lib/engine/types.ts lib/engine/calc.ts lib/engine/calc.test.ts
git commit -m "feat(engine): add simulation types and dosing formulas" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 3: Автомат инфузомата (`lib/engine/pump.ts`)

**Files:**
- Create: `lib/engine/pump.ts`, `lib/engine/testing.ts`
- Test: `lib/engine/pump.test.ts`

**Interfaces:**
- Consumes: `PumpButton`, `AlarmType` из `./types`.
- Produces (pump.ts): `FIELD_DIGITS = { rate: 4, vtbi: 5 }`, `type PumpField = 'rate' | 'vtbi'`, `type PumpStatus = 'off' | 'program' | 'limitWarning' | 'confirm' | 'running' | 'paused' | 'alarmStopped' | 'complete'`, `interface PumpAlarm { type: AlarmType; fixed: boolean; muted: boolean; depleted: boolean }`, `interface PumpState { status; field; editing; cursor; draft: number[]; rateTenths; vtbiTenths; pendingTenths: number | null; minRateTenths; maxRateTenths; alarm: PumpAlarm | null; onMains: boolean }`, `type PumpEffect = 'beep' | 'limitOverride' | 'startAttempt' | 'restartAttempt' | 'stopped' | null`, `createPump()`, `toDigits(tenths, count)`, `fromDigits(digits)`, `formatTenths(tenths, count)` (`840, 4 → '084.0'`), `setRateLimits(state, minRate, maxRate)`, `pressButton(state, button): { state: PumpState; effect: PumpEffect }`, `beginInfusion(s)`, `rejectStart(s)`, `raiseAlarm(s, type)`, `depleteBattery(s)`, `markAlarmFixed(s)`, `resumeAfterAlarm(s)`, `completeInfusion(s)`.
- Produces (testing.ts): `digitPresses(tenths, count): PumpButton[]`, `programPump(rateTenths, vtbiTenths): PumpButton[]` — последовательность от выключенного насоса до введённых RATE и VTBI (без START).

- [ ] **Step 1: Создать `lib/engine/testing.ts`**

```ts
import { FIELD_DIGITS, toDigits } from './pump';
import type { PumpButton } from './types';

/** Button presses that turn an all-zero draft (cursor on the first digit) into `tenths`. */
export function digitPresses(tenths: number, count: number): PumpButton[] {
  const presses: PumpButton[] = [];
  toDigits(tenths, count).forEach((digit, index) => {
    if (index > 0) presses.push('RIGHT');
    for (let k = 0; k < digit; k++) presses.push('PLUS');
  });
  return presses;
}

/** From a switched-off pump: power on, enter RATE, switch to VTBI, enter VTBI. */
export function programPump(rateTenths: number, vtbiTenths: number): PumpButton[] {
  return [
    'POWER',
    'ENTER', ...digitPresses(rateTenths, FIELD_DIGITS.rate), 'ENTER',
    'MENU',
    'ENTER', ...digitPresses(vtbiTenths, FIELD_DIGITS.vtbi), 'ENTER',
  ];
}
```

- [ ] **Step 2: Написать падающие тесты `lib/engine/pump.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import {
  beginInfusion, completeInfusion, createPump, depleteBattery, formatTenths, markAlarmFixed,
  pressButton, raiseAlarm, resumeAfterAlarm, setRateLimits, type PumpState,
} from './pump';
import { programPump } from './testing';
import type { PumpButton } from './types';

function press(state: PumpState, ...buttons: PumpButton[]): PumpState {
  return buttons.reduce((s, b) => pressButton(s, b).state, state);
}

const programmed = (rate: number, vtbi: number) =>
  press(setRateLimits(createPump(), 20, 150), ...programPump(rate, vtbi));

describe('pump programming', () => {
  it('is off until POWER', () => {
    const s = press(createPump(), 'ENTER', 'START', 'MENU');
    expect(s.status).toBe('off');
    expect(press(s, 'POWER').status).toBe('program');
  });

  it('edits RATE digit by digit', () => {
    let s = press(createPump(), 'POWER', 'ENTER');
    expect(s.editing).toBe(true);
    expect(s.draft).toEqual([0, 0, 0, 0]);
    expect(s.cursor).toBe(0);
    s = press(s, 'RIGHT', 'PLUS', 'PLUS', 'RIGHT', 'PLUS', 'ENTER');
    expect(s.editing).toBe(false);
    expect(s.rateTenths).toBe(210);
  });

  it('keeps the cursor inside the field and wraps digits', () => {
    let s = press(createPump(), 'POWER', 'ENTER', 'LEFT');
    expect(s.cursor).toBe(0);
    s = press(s, 'RIGHT', 'RIGHT', 'RIGHT', 'RIGHT', 'RIGHT');
    expect(s.cursor).toBe(3);
    s = press(s, 'MINUS');
    expect(s.draft).toEqual([0, 0, 0, 9]);
    s = press(s, 'PLUS');
    expect(s.draft).toEqual([0, 0, 0, 0]);
  });

  it('STOP discards the draft', () => {
    const s = press(createPump(), 'POWER', 'ENTER', 'PLUS', 'STOP');
    expect(s.editing).toBe(false);
    expect(s.rateTenths).toBe(0);
  });

  it('MENU switches to the 5-digit VTBI field', () => {
    const s = press(createPump(), 'POWER', 'MENU', 'ENTER');
    expect(s.field).toBe('vtbi');
    expect(s.draft).toHaveLength(5);
  });

  it('programPump enters both values', () => {
    const s = programmed(840, 210);
    expect(s).toMatchObject({ status: 'program', rateTenths: 840, vtbiTenths: 210, editing: false });
  });

  it('formats tenths', () => {
    expect(formatTenths(840, 4)).toBe('084.0');
    expect(formatTenths(210, 5)).toBe('0021.0');
  });
});

describe('drug library limits', () => {
  it('warns above the soft limit and records an override', () => {
    // 800.0 ml/h: eight presses on the hundreds digit, limits are 20–150 ml/h.
    let s = press(setRateLimits(createPump(), 20, 150), 'POWER', 'ENTER');
    s = press(s, 'PLUS', 'PLUS', 'PLUS', 'PLUS', 'PLUS', 'PLUS', 'PLUS', 'PLUS', 'ENTER');
    expect(s.status).toBe('limitWarning');
    expect(s.pendingTenths).toBe(8000);
    const confirmed = pressButton(s, 'ENTER');
    expect(confirmed.effect).toBe('limitOverride');
    expect(confirmed.state).toMatchObject({ status: 'program', rateTenths: 8000, editing: false });
  });

  it('STOP on the warning returns to editing without saving', () => {
    let s = press(setRateLimits(createPump(), 20, 150), 'POWER', 'ENTER', 'RIGHT', 'RIGHT', 'PLUS', 'ENTER');
    expect(s.status).toBe('limitWarning');
    s = press(s, 'STOP');
    expect(s).toMatchObject({ status: 'program', editing: true, rateTenths: 0, pendingTenths: null });
  });
});

describe('start and run', () => {
  it('beeps when RATE or VTBI is zero', () => {
    const r = pressButton(press(createPump(), 'POWER'), 'START');
    expect(r.effect).toBe('beep');
    expect(r.state.status).toBe('program');
  });

  it('START → confirm → startAttempt; STOP leaves confirm', () => {
    const confirm = press(programmed(840, 210), 'START');
    expect(confirm.status).toBe('confirm');
    expect(press(confirm, 'STOP').status).toBe('program');
    expect(pressButton(confirm, 'START').effect).toBe('startAttempt');
  });

  it('running ⇄ paused', () => {
    const running = beginInfusion(press(programmed(840, 210), 'START'));
    const stopped = pressButton(running, 'STOP');
    expect(stopped.effect).toBe('stopped');
    expect(stopped.state.status).toBe('paused');
    expect(press(stopped.state, 'MENU', 'ENTER').status).toBe('paused');
    expect(press(stopped.state, 'START').status).toBe('running');
  });

  it('completes', () => {
    const running = beginInfusion(press(programmed(840, 210), 'START'));
    expect(completeInfusion(running).status).toBe('complete');
  });
});

describe('alarms', () => {
  const running = () => beginInfusion(press(programmed(840, 210), 'START'));

  it('occlusion stops the pump; START asks for a restart; MUTE silences', () => {
    const s = raiseAlarm(running(), 'occlusion');
    expect(s.status).toBe('alarmStopped');
    expect(pressButton(s, 'START').effect).toBe('restartAttempt');
    expect(press(s, 'MUTE').alarm?.muted).toBe(true);
    const fixed = markAlarmFixed(s);
    expect(fixed.alarm?.fixed).toBe(true);
    expect(resumeAfterAlarm(fixed)).toMatchObject({ status: 'running', alarm: null });
  });

  it('low battery keeps running; mains clears it', () => {
    const s = raiseAlarm(running(), 'lowBattery');
    expect(s.status).toBe('running');
    expect(markAlarmFixed(s)).toMatchObject({ status: 'running', alarm: null, onMains: true });
  });

  it('depleted battery stops the pump until mains + START', () => {
    const s = depleteBattery(raiseAlarm(running(), 'lowBattery'));
    expect(s.status).toBe('alarmStopped');
    expect(s.alarm?.depleted).toBe(true);
    const fixed = markAlarmFixed(s);
    expect(fixed).toMatchObject({ onMains: true, alarm: { fixed: true } });
    expect(resumeAfterAlarm(fixed).status).toBe('running');
  });
});
```

- [ ] **Step 3: Запустить и убедиться, что тесты падают**

Run: `npx vitest run lib/engine/pump.test.ts`
Expected: FAIL — `Failed to resolve import "./pump"`.

- [ ] **Step 4: Реализовать `lib/engine/pump.ts`**

```ts
import type { AlarmType, PumpButton } from './types';

export const FIELD_DIGITS = { rate: 4, vtbi: 5 } as const;
export type PumpField = keyof typeof FIELD_DIGITS;

export type PumpStatus =
  | 'off' | 'program' | 'limitWarning' | 'confirm' | 'running' | 'paused' | 'alarmStopped' | 'complete';

export interface PumpAlarm {
  type: AlarmType;
  fixed: boolean;
  muted: boolean;
  depleted: boolean;
}

export interface PumpState {
  status: PumpStatus;
  field: PumpField;
  editing: boolean;
  cursor: number;
  draft: number[];
  rateTenths: number;
  vtbiTenths: number;
  pendingTenths: number | null;
  minRateTenths: number;
  maxRateTenths: number;
  alarm: PumpAlarm | null;
  onMains: boolean;
}

export type PumpEffect = 'beep' | 'limitOverride' | 'startAttempt' | 'restartAttempt' | 'stopped' | null;

interface PressResult {
  state: PumpState;
  effect: PumpEffect;
}

const result = (state: PumpState, effect: PumpEffect = null): PressResult => ({ state, effect });

export function createPump(): PumpState {
  return {
    status: 'off',
    field: 'rate',
    editing: false,
    cursor: 0,
    draft: [],
    rateTenths: 0,
    vtbiTenths: 0,
    pendingTenths: null,
    minRateTenths: 0,
    maxRateTenths: 9999,
    alarm: null,
    onMains: false,
  };
}

export function toDigits(tenths: number, count: number): number[] {
  return String(tenths).padStart(count, '0').slice(-count).split('').map(Number);
}

export function fromDigits(digits: number[]): number {
  return digits.reduce((acc, d) => acc * 10 + d, 0);
}

export function formatTenths(tenths: number, count: number): string {
  const s = String(tenths).padStart(count, '0');
  return `${s.slice(0, -1)}.${s.slice(-1)}`;
}

export function setRateLimits(state: PumpState, minRate: number, maxRate: number): PumpState {
  return { ...state, minRateTenths: Math.round(minRate * 10), maxRateTenths: Math.round(maxRate * 10) };
}

const fieldValue = (s: PumpState, field: PumpField): number => (field === 'rate' ? s.rateTenths : s.vtbiTenths);

const withField = (s: PumpState, field: PumpField, value: number): PumpState =>
  field === 'rate' ? { ...s, rateTenths: value } : { ...s, vtbiTenths: value };

function pressInProgram(s: PumpState, button: PumpButton): PressResult {
  switch (button) {
    case 'MENU':
      return result({ ...s, field: s.field === 'rate' ? 'vtbi' : 'rate' });
    case 'ENTER':
      return result({ ...s, editing: true, cursor: 0, draft: toDigits(fieldValue(s, s.field), FIELD_DIGITS[s.field]) });
    case 'START':
      return s.rateTenths === 0 || s.vtbiTenths === 0 ? result(s, 'beep') : result({ ...s, status: 'confirm' });
    default:
      return result(s);
  }
}

function pressWhileEditing(s: PumpState, button: PumpButton): PressResult {
  switch (button) {
    case 'LEFT':
      return result({ ...s, cursor: Math.max(0, s.cursor - 1) });
    case 'RIGHT':
      return result({ ...s, cursor: Math.min(s.draft.length - 1, s.cursor + 1) });
    case 'PLUS':
    case 'MINUS': {
      const draft = [...s.draft];
      draft[s.cursor] = (draft[s.cursor] + (button === 'PLUS' ? 1 : 9)) % 10;
      return result({ ...s, draft });
    }
    case 'ENTER': {
      const value = fromDigits(s.draft);
      const outside = value < s.minRateTenths || value > s.maxRateTenths;
      if (s.field === 'rate' && value > 0 && outside) {
        return result({ ...s, status: 'limitWarning', pendingTenths: value });
      }
      return result({ ...withField(s, s.field, value), editing: false });
    }
    case 'STOP':
      return result({ ...s, editing: false });
    default:
      return result(s);
  }
}

export function pressButton(s: PumpState, button: PumpButton): PressResult {
  if (button === 'MUTE') {
    return result(s.alarm ? { ...s, alarm: { ...s.alarm, muted: true } } : s);
  }
  switch (s.status) {
    case 'off':
      return button === 'POWER' ? result({ ...s, status: 'program' }) : result(s);
    case 'program':
      return s.editing ? pressWhileEditing(s, button) : pressInProgram(s, button);
    case 'limitWarning':
      if (button === 'ENTER' && s.pendingTenths !== null) {
        return result(
          { ...s, rateTenths: s.pendingTenths, pendingTenths: null, editing: false, status: 'program' },
          'limitOverride',
        );
      }
      return button === 'STOP' ? result({ ...s, pendingTenths: null, status: 'program' }) : result(s);
    case 'confirm':
      if (button === 'START') return result(s, 'startAttempt');
      return button === 'STOP' ? result({ ...s, status: 'program' }) : result(s);
    case 'running':
      return button === 'STOP' ? result({ ...s, status: 'paused' }, 'stopped') : result(s);
    case 'paused':
      return button === 'START' ? result({ ...s, status: 'running' }) : result(s);
    case 'alarmStopped':
      return button === 'START' ? result(s, 'restartAttempt') : result(s);
    case 'complete':
      return result(s);
  }
}

export const beginInfusion = (s: PumpState): PumpState => ({ ...s, status: 'running' });

export const rejectStart = (s: PumpState): PumpState => ({ ...s, status: 'program' });

export function raiseAlarm(s: PumpState, type: AlarmType): PumpState {
  return {
    ...s,
    alarm: { type, fixed: false, muted: false, depleted: false },
    status: type === 'lowBattery' ? s.status : 'alarmStopped',
  };
}

export function depleteBattery(s: PumpState): PumpState {
  if (!s.alarm) return s;
  return { ...s, status: 'alarmStopped', alarm: { ...s.alarm, depleted: true, muted: false } };
}

/** Called once the student has done every required action for the active alarm. */
export function markAlarmFixed(s: PumpState): PumpState {
  if (!s.alarm) return s;
  if (s.alarm.type === 'lowBattery') {
    return s.alarm.depleted
      ? { ...s, onMains: true, alarm: { ...s.alarm, fixed: true } }
      : { ...s, onMains: true, alarm: null };
  }
  return { ...s, alarm: { ...s.alarm, fixed: true } };
}

export const resumeAfterAlarm = (s: PumpState): PumpState => ({ ...s, status: 'running', alarm: null });

export const completeInfusion = (s: PumpState): PumpState => ({ ...s, status: 'complete', alarm: null });
```

- [ ] **Step 5: Запустить тесты**

Run: `npx vitest run lib/engine/pump.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/engine/pump.ts lib/engine/pump.test.ts lib/engine/testing.ts
git commit -m "feat(engine): add infusion pump state machine" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 4: Данные сценариев (`lib/scenarios`)

**Files:**
- Create: `lib/scenarios/common.ts`, `lib/scenarios/s1-paracetamol.ts`, `lib/scenarios/s2-ceftriaxone.ts`, `lib/scenarios/s3-saline-bolus.ts`, `lib/scenarios/s4-maintenance.ts`, `lib/scenarios/s5-glucose.ts`, `lib/scenarios/index.ts`
- Test: `lib/scenarios/scenarios.test.ts`

**Interfaces:**
- Consumes: `Scenario`, `CalcStep`, `L10n`, `UnitId` из `../engine/types`; `expectedValues`, `formatDuration`, `timeHours` из `../engine/calc`.
- Produces: `scenarios: Scenario[]` (порядок 1..5), `getScenario(id: string): Scenario | undefined`. Идентификаторы: `s1-paracetamol`, `s2-ceftriaxone`, `s3-saline-bolus`, `s4-maintenance`, `s5-glucose`. Идентификаторы вариантов, шагов и действий — как в коде ниже (на них ссылаются тесты задач 5–6 и e2e).

- [ ] **Step 1: Написать падающий тест `lib/scenarios/scenarios.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { expectedValues, formatDuration, timeHours } from '../engine/calc';
import { getScenario, scenarios } from './index';

const table = {
  's1-paracetamol': { rate: 84, vtbi: 21, time: '0:15' },
  's2-ceftriaxone': { rate: 80, vtbi: 40, time: '0:30' },
  's3-saline-bolus': { rate: 720, vtbi: 360, time: '0:30' },
  's4-maintenance': { rate: 50, vtbi: 400, time: '8:00' },
  's5-glucose': { rate: 10.8, vtbi: 43.2, time: '4:00' },
} as const;

function collectL10n(value: unknown, out: Array<{ ru: string; kk: string }> = []) {
  if (Array.isArray(value)) {
    value.forEach((v) => collectL10n(v, out));
  } else if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (typeof obj.ru === 'string' && typeof obj.kk === 'string') out.push(obj as { ru: string; kk: string });
    else Object.values(obj).forEach((v) => collectL10n(v, out));
  }
  return out;
}

describe('scenario data', () => {
  it('has five scenarios numbered 1..5 with unique ids', () => {
    expect(scenarios.map((s) => s.number)).toEqual([1, 2, 3, 4, 5]);
    expect(scenarios.map((s) => s.id).sort()).toEqual(Object.keys(table).sort());
  });

  it.each(scenarios)('$id matches the spec table', (s) => {
    const exp = expectedValues(s.prescription, s.patient.weightKg);
    const row = table[s.id as keyof typeof table];
    expect(exp.rateMlH).toBe(row.rate);
    expect(exp.vtbiMl).toBe(row.vtbi);
    expect(formatDuration(timeHours(exp.vtbiMl, exp.rateMlH))).toBe(row.time);
  });

  it.each(scenarios)('$id is internally consistent', (s) => {
    const exp = expectedValues(s.prescription, s.patient.weightKg);
    const correct = s.drugOptions.find((o) => o.id === s.correctDrugId);
    expect(correct).toBeDefined();
    expect(correct!.critical).not.toBe(true);
    expect(exp.rateMlH).toBeGreaterThanOrEqual(correct!.softMinRate);
    expect(exp.rateMlH).toBeLessThanOrEqual(correct!.softMaxRate);
    expect(exp.rateMlH).toBeLessThanOrEqual(999.9);
    expect(exp.vtbiMl).toBeLessThanOrEqual(9999.9);
    expect(s.acceptableRoutes.some((r) => s.patient.accesses.includes(r))).toBe(true);
    expect(s.criticalRoutes.every((r) => !s.acceptableRoutes.includes(r))).toBe(true);
    expect(new Set(s.drugOptions.map((o) => o.id)).size).toBe(s.drugOptions.length);
    expect(s.calcSteps.length).toBeGreaterThan(0);
    for (const c of s.calcSteps) {
      expect(exp[c.quantity]).not.toBeNull();
      expect(c.unitOptions).toContain(c.unit);
    }
    if (s.alarm) {
      const ids = s.alarm.actions.map((a) => a.id);
      expect(s.alarm.sequence.every((id) => ids.includes(id))).toBe(true);
      expect(ids.length).toBeGreaterThan(s.alarm.sequence.length);
      expect(s.alarm.atProgress).toBeGreaterThan(0);
      expect(s.alarm.atProgress).toBeLessThan(1);
    }
    expect(s.reviewStatus).toBe('draft');
    expect(s.sources.length).toBeGreaterThan(0);
  });

  it('has the alarms from the spec', () => {
    expect(scenarios.map((s) => s.alarm?.type ?? null)).toEqual([null, 'occlusion', 'airInLine', 'lowBattery', null]);
    expect(getScenario('s4-maintenance')!.alarm!.depleteAtProgress).toBe(0.7);
  });

  it('marks the dangerous look-alikes and the peripheral route in scenario 5 as critical', () => {
    const critical = scenarios.flatMap((s) => s.drugOptions.filter((o) => o.critical).map((o) => o.id));
    expect(critical.sort()).toEqual(['glucose-40', 'nacl-10']);
    expect(getScenario('s5-glucose')!.criticalRoutes).toEqual(['piv']);
  });

  it('has every text in Russian and Kazakh', () => {
    const texts = collectL10n(scenarios);
    expect(texts.length).toBeGreaterThan(50);
    for (const t of texts) {
      expect(t.ru.trim()).not.toBe('');
      expect(t.kk.trim()).not.toBe('');
    }
  });

  it('returns undefined for an unknown id', () => {
    expect(getScenario('nope')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Запустить и убедиться, что тест падает**

Run: `npx vitest run lib/scenarios/scenarios.test.ts`
Expected: FAIL — `Failed to resolve import "./index"`.

- [ ] **Step 3: Создать `lib/scenarios/common.ts`**

```ts
import type { CalcStep, L10n, UnitId } from '../engine/types';

export const DOSE_UNITS: UnitId[] = ['mg', 'g', 'mg_kg', 'ml'];
export const VOLUME_UNITS: UnitId[] = ['ml', 'mg', 'ml_h', 'mg_ml'];
export const RATE_UNITS: UnitId[] = ['ml_h', 'ml', 'mg_kg', 'ml_kg'];

export const SOURCES = {
  bnfc: 'BNF for Children (BNFC), актуальное издание',
  paracetamol: 'Инструкция по медицинскому применению: парацетамол, раствор для инфузий 10 мг/мл',
  ceftriaxone: 'Инструкция по медицинскому применению: цефтриаксон, порошок для приготовления раствора',
  whoPocketBook: 'WHO. Pocket Book of Hospital Care for Children, 2nd ed., 2013 — Plan C',
  hollidaySegar:
    'Holliday M.A., Segar W.E. The maintenance need for water in parenteral fluid therapy. Pediatrics, 1957',
  nice29: 'NICE NG29. Intravenous fluid therapy in children and young people in hospital',
  aspen: 'ASPEN: предел осмолярности растворов для периферического введения; глюкоза > 12,5 % — только центрально',
  gir: 'GIR (мг/кг/мин) = концентрация глюкозы (%) × скорость (мл/ч) ÷ (6 × масса (кг))',
};

export const doseStep = (prompt: L10n): CalcStep => ({
  id: 'dose',
  quantity: 'doseMg',
  prompt,
  hint: {
    ru: 'Доза (мг) = доза на кг (мг/кг) × масса (кг)',
    kk: 'Доза (мг) = 1 кг-ға доза (мг/кг) × салмақ (кг)',
  },
  unit: 'mg',
  unitOptions: DOSE_UNITS,
});

export const volumeFromDoseStep = (): CalcStep => ({
  id: 'volume',
  quantity: 'volumeMl',
  prompt: {
    ru: 'Рассчитайте объём раствора для введения.',
    kk: 'Енгізілетін ерітінді көлемін есептеңіз.',
  },
  hint: {
    ru: 'Объём (мл) = доза (мг) ÷ концентрация (мг/мл)',
    kk: 'Көлем (мл) = доза (мг) ÷ концентрация (мг/мл)',
  },
  unit: 'ml',
  unitOptions: VOLUME_UNITS,
});
```

- [ ] **Step 4: Создать `lib/scenarios/s1-paracetamol.ts`**

```ts
import type { Scenario } from '../engine/types';
import { SOURCES, doseStep, volumeFromDoseStep } from './common';

export const s1Paracetamol: Scenario = {
  id: 's1-paracetamol',
  number: 1,
  title: { ru: 'Лихорадка: парацетамол в/в', kk: 'Қызба: парацетамол вена ішіне' },
  reviewStatus: 'draft',
  patient: {
    code: '№001',
    age: { ru: '3 года', kk: '3 жас' },
    weightKg: 14,
    condition: {
      ru: 'Лихорадка 39,2 °C, рвота, не может принимать лекарства внутрь.',
      kk: 'Қызба 39,2 °C, құсу, дәріні ішке қабылдай алмайды.',
    },
    accesses: ['piv'],
  },
  order: {
    ru: 'Парацетамол 15 мг/кг в/в, инфузия за 15 минут. Раствор 10 мг/мл.',
    kk: 'Парацетамол 15 мг/кг вена ішіне, инфузия 15 минут ішінде. Ерітінді 10 мг/мл.',
  },
  prescription: { kind: 'dosePerKg', mgPerKg: 15, concentrationMgPerMl: 10, durationMin: 15 },
  drugOptions: [
    {
      id: 'paracetamol-10',
      name: { ru: 'Парацетамол 10 мг/мл', kk: 'Парацетамол 10 мг/мл' },
      pumpLabel: 'PARACETAMOL 10 mg/mL',
      softMinRate: 20,
      softMaxRate: 150,
    },
    {
      id: 'metamizole-500',
      name: { ru: 'Метамизол натрия 500 мг/мл', kk: 'Метамизол натрийі 500 мг/мл' },
      pumpLabel: 'METAMIZOLE 500 mg/mL',
      softMinRate: 1,
      softMaxRate: 20,
    },
    {
      id: 'ketorolac-30',
      name: { ru: 'Кеторолак 30 мг/мл', kk: 'Кеторолак 30 мг/мл' },
      pumpLabel: 'KETOROLAC 30 mg/mL',
      softMinRate: 1,
      softMaxRate: 30,
    },
  ],
  correctDrugId: 'paracetamol-10',
  acceptableRoutes: ['piv'],
  criticalRoutes: [],
  calcSteps: [
    doseStep({
      ru: 'Рассчитайте разовую дозу парацетамола.',
      kk: 'Парацетамолдың бір реттік дозасын есептеңіз.',
    }),
    volumeFromDoseStep(),
  ],
  alarm: null,
  sources: [SOURCES.paracetamol, SOURCES.bnfc],
};
```

- [ ] **Step 5: Создать `lib/scenarios/s2-ceftriaxone.ts`**

```ts
import type { Scenario } from '../engine/types';
import { SOURCES, doseStep, volumeFromDoseStep } from './common';

export const s2Ceftriaxone: Scenario = {
  id: 's2-ceftriaxone',
  number: 2,
  title: { ru: 'Пневмония: цефтриаксон', kk: 'Пневмония: цефтриаксон' },
  reviewStatus: 'draft',
  patient: {
    code: '№002',
    age: { ru: '8 месяцев', kk: '8 ай' },
    weightKg: 8,
    condition: {
      ru: 'Внебольничная пневмония, температура 38,5 °C.',
      kk: 'Ауруханадан тыс пневмония, температура 38,5 °C.',
    },
    accesses: ['piv'],
  },
  order: {
    ru: 'Цефтриаксон 50 мг/кг в/в капельно за 30 минут. Приготовленный раствор 10 мг/мл.',
    kk: 'Цефтриаксон 50 мг/кг вена ішіне тамшылатып, 30 минут ішінде. Дайындалған ерітінді 10 мг/мл.',
  },
  prescription: { kind: 'dosePerKg', mgPerKg: 50, concentrationMgPerMl: 10, durationMin: 30 },
  drugOptions: [
    {
      id: 'ceftriaxone-10',
      name: { ru: 'Цефтриаксон 10 мг/мл', kk: 'Цефтриаксон 10 мг/мл' },
      pumpLabel: 'CEFTRIAXONE 10 mg/mL',
      softMinRate: 20,
      softMaxRate: 150,
    },
    {
      id: 'cefazolin-10',
      name: { ru: 'Цефазолин 10 мг/мл', kk: 'Цефазолин 10 мг/мл' },
      pumpLabel: 'CEFAZOLIN 10 mg/mL',
      softMinRate: 20,
      softMaxRate: 150,
    },
    {
      id: 'cefuroxime-10',
      name: { ru: 'Цефуроксим 10 мг/мл', kk: 'Цефуроксим 10 мг/мл' },
      pumpLabel: 'CEFUROXIME 10 mg/mL',
      softMinRate: 20,
      softMaxRate: 150,
    },
  ],
  correctDrugId: 'ceftriaxone-10',
  acceptableRoutes: ['piv'],
  criticalRoutes: [],
  calcSteps: [
    doseStep({
      ru: 'Рассчитайте разовую дозу цефтриаксона.',
      kk: 'Цефтриаксонның бір реттік дозасын есептеңіз.',
    }),
    volumeFromDoseStep(),
  ],
  alarm: {
    type: 'occlusion',
    atProgress: 0.4,
    actions: [
      {
        id: 'check_line',
        label: {
          ru: 'Осмотреть линию от насоса до пациента: зажимы, перегибы, место катетера',
          kk: 'Сорғыдан науқасқа дейінгі желіні тексеру: қысқыштар, бүгілулер, катетер орны',
        },
        reveals: {
          ru: 'Причина найдена: роликовый зажим ниже насоса закрыт.',
          kk: 'Себебі табылды: сорғыдан төмен роликті қысқыш жабық.',
        },
      },
      { id: 'open_clamp', label: { ru: 'Открыть роликовый зажим', kk: 'Роликті қысқышты ашу' } },
      { id: 'flush_force', label: { ru: 'Промыть катетер с усилием', kk: 'Катетерді күшпен жуу' } },
      {
        id: 'increase_rate',
        label: {
          ru: 'Увеличить скорость, чтобы «продавить» линию',
          kk: 'Желіні «итеру» үшін жылдамдықты арттыру',
        },
      },
      { id: 'power_cycle', label: { ru: 'Выключить и включить насос', kk: 'Сорғыны өшіріп, қайта қосу' } },
    ],
    sequence: ['check_line', 'open_clamp'],
  },
  sources: [SOURCES.ceftriaxone, SOURCES.bnfc],
};
```

- [ ] **Step 6: Создать `lib/scenarios/s3-saline-bolus.ts`**

```ts
import type { Scenario } from '../engine/types';
import { SOURCES, VOLUME_UNITS } from './common';

export const s3SalineBolus: Scenario = {
  id: 's3-saline-bolus',
  number: 3,
  title: { ru: 'Тяжёлое обезвоживание: NaCl 0,9%', kk: 'Ауыр сусыздану: NaCl 0,9%' },
  reviewStatus: 'draft',
  patient: {
    code: '№003',
    age: { ru: '2 года', kk: '2 жас' },
    weightKg: 12,
    condition: {
      ru: 'Острая диарея, тяжёлое обезвоживание: вялость, запавшие глаза, кожная складка расправляется очень медленно.',
      kk: 'Жедел диарея, ауыр сусыздану: әлсіздік, көздері шүңірейген, тері қатпары өте баяу жазылады.',
    },
    accesses: ['piv'],
  },
  order: {
    ru: 'NaCl 0,9% 30 мл/кг в/в за 30 минут (план C ВОЗ, первый этап).',
    kk: 'NaCl 0,9% 30 мл/кг вена ішіне 30 минут ішінде (ДДСҰ C жоспары, бірінші кезең).',
  },
  prescription: { kind: 'volumePerKg', mlPerKg: 30, durationMin: 30 },
  drugOptions: [
    {
      id: 'nacl-09',
      name: { ru: 'NaCl 0,9%', kk: 'NaCl 0,9%' },
      pumpLabel: 'NaCl 0.9%',
      softMinRate: 10,
      softMaxRate: 999.9,
    },
    {
      id: 'nacl-10',
      name: { ru: 'NaCl 10%', kk: 'NaCl 10%' },
      pumpLabel: 'NaCl 10%',
      softMinRate: 1,
      softMaxRate: 20,
      critical: true,
    },
    {
      id: 'glucose-5',
      name: { ru: 'Глюкоза 5%', kk: 'Глюкоза 5%' },
      pumpLabel: 'GLUCOSE 5%',
      softMinRate: 5,
      softMaxRate: 200,
    },
  ],
  correctDrugId: 'nacl-09',
  acceptableRoutes: ['piv'],
  criticalRoutes: [],
  calcSteps: [
    {
      id: 'volume',
      quantity: 'volumeMl',
      prompt: { ru: 'Рассчитайте объём болюса.', kk: 'Болюс көлемін есептеңіз.' },
      hint: { ru: 'Объём (мл) = мл/кг × масса (кг)', kk: 'Көлем (мл) = мл/кг × салмақ (кг)' },
      unit: 'ml',
      unitOptions: VOLUME_UNITS,
    },
  ],
  alarm: {
    type: 'airInLine',
    atProgress: 0.5,
    actions: [
      {
        id: 'clamp_line',
        label: { ru: 'Перекрыть зажим линии к пациенту', kk: 'Науқасқа баратын желінің қысқышын жабу' },
      },
      {
        id: 'remove_air',
        label: {
          ru: 'Удалить воздух из линии по инструкции насоса',
          kk: 'Сорғы нұсқаулығы бойынша желіден ауаны шығару',
        },
      },
      { id: 'unclamp_line', label: { ru: 'Открыть зажим', kk: 'Қысқышты ашу' } },
      { id: 'disable_sensor', label: { ru: 'Отключить датчик воздуха', kk: 'Ауа датчигін өшіру' } },
      {
        id: 'flush_bubble',
        label: {
          ru: 'Промыть катетер, чтобы протолкнуть пузырь',
          kk: 'Көпіршікті итеру үшін катетерді жуу',
        },
      },
    ],
    sequence: ['clamp_line', 'remove_air', 'unclamp_line'],
  },
  sources: [SOURCES.whoPocketBook],
};
```

- [ ] **Step 7: Создать `lib/scenarios/s4-maintenance.ts`**

```ts
import type { Scenario } from '../engine/types';
import { RATE_UNITS, SOURCES } from './common';

export const s4Maintenance: Scenario = {
  id: 's4-maintenance',
  number: 4,
  title: { ru: 'Поддерживающая инфузия: правило 4-2-1', kk: 'Демеуші инфузия: 4-2-1 ережесі' },
  reviewStatus: 'draft',
  patient: {
    code: '№004',
    age: { ru: '4 года', kk: '4 жас' },
    weightKg: 15,
    condition: {
      ru: 'Герпетический стоматит, не может пить из-за боли. Признаков обезвоживания нет.',
      kk: 'Герпестік стоматит, ауырсынуға байланысты іше алмайды. Сусыздану белгілері жоқ.',
    },
    accesses: ['piv'],
  },
  order: {
    ru: 'Поддерживающая инфузия NaCl 0,9% + глюкоза 5%: скорость по правилу 4-2-1, на 8 часов.',
    kk: 'NaCl 0,9% + глюкоза 5% демеуші инфузиясы: жылдамдық 4-2-1 ережесі бойынша, 8 сағатқа.',
  },
  prescription: { kind: 'maintenance421', durationMin: 480 },
  drugOptions: [
    {
      id: 'nacl-09-glucose-5',
      name: { ru: 'NaCl 0,9% + глюкоза 5%', kk: 'NaCl 0,9% + глюкоза 5%' },
      pumpLabel: 'NaCl 0.9% + GLU 5%',
      softMinRate: 5,
      softMaxRate: 100,
    },
    {
      id: 'glucose-5',
      name: { ru: 'Глюкоза 5%', kk: 'Глюкоза 5%' },
      pumpLabel: 'GLUCOSE 5%',
      softMinRate: 5,
      softMaxRate: 100,
    },
    {
      id: 'nacl-045',
      name: { ru: 'NaCl 0,45%', kk: 'NaCl 0,45%' },
      pumpLabel: 'NaCl 0.45%',
      softMinRate: 5,
      softMaxRate: 100,
    },
  ],
  correctDrugId: 'nacl-09-glucose-5',
  acceptableRoutes: ['piv'],
  criticalRoutes: [],
  calcSteps: [
    {
      id: 'rate',
      quantity: 'rateMlH',
      prompt: {
        ru: 'Рассчитайте скорость по правилу 4-2-1.',
        kk: '4-2-1 ережесі бойынша жылдамдықты есептеңіз.',
      },
      hint: {
        ru: '4 мл/кг/ч на первые 10 кг + 2 мл/кг/ч на следующие 10 кг + 1 мл/кг/ч на каждый кг сверх 20',
        kk: 'Алғашқы 10 кг-ға 4 мл/кг/сағ + келесі 10 кг-ға 2 мл/кг/сағ + 20 кг-нан асқан әр кг-ға 1 мл/кг/сағ',
      },
      unit: 'ml_h',
      unitOptions: RATE_UNITS,
    },
  ],
  alarm: {
    type: 'lowBattery',
    atProgress: 0.3,
    depleteAtProgress: 0.7,
    actions: [
      { id: 'connect_power', label: { ru: 'Подключить насос к сети', kk: 'Сорғыны желіге қосу' } },
      {
        id: 'power_off',
        label: { ru: 'Выключить насос, чтобы сберечь заряд', kk: 'Зарядты үнемдеу үшін сорғыны өшіру' },
      },
      { id: 'remove_battery', label: { ru: 'Вынуть аккумулятор', kk: 'Аккумуляторды шығару' } },
    ],
    sequence: ['connect_power'],
  },
  sources: [SOURCES.hollidaySegar, SOURCES.nice29],
};
```

- [ ] **Step 8: Создать `lib/scenarios/s5-glucose.ts`**

```ts
import type { Scenario } from '../engine/types';
import { RATE_UNITS, SOURCES } from './common';

export const s5Glucose: Scenario = {
  id: 's5-glucose',
  number: 5,
  title: { ru: 'Гипогликемия: глюкоза 20% через PICC', kk: 'Гипогликемия: PICC арқылы глюкоза 20%' },
  reviewStatus: 'draft',
  patient: {
    code: '№005',
    age: { ru: '5 месяцев', kk: '5 ай' },
    weightKg: 6,
    condition: {
      ru: 'ОРИТ, стойкая гипогликемия, ограничение жидкости.',
      kk: 'Реанимация бөлімі, тұрақты гипогликемия, сұйықтық шектелген.',
    },
    accesses: ['picc', 'piv'],
  },
  order: {
    ru: 'Глюкоза 20% со скоростью введения глюкозы (GIR) 6 мг/кг/мин, на 4 часа.',
    kk: 'Глюкоза 20%, глюкоза енгізу жылдамдығы (GIR) 6 мг/кг/мин, 4 сағатқа.',
  },
  prescription: { kind: 'gir', mgPerKgMin: 6, concentrationMgPerMl: 200, durationMin: 240 },
  drugOptions: [
    {
      id: 'glucose-20',
      name: { ru: 'Глюкоза 20%', kk: 'Глюкоза 20%' },
      pumpLabel: 'GLUCOSE 20%',
      softMinRate: 2,
      softMaxRate: 20,
    },
    {
      id: 'glucose-10',
      name: { ru: 'Глюкоза 10%', kk: 'Глюкоза 10%' },
      pumpLabel: 'GLUCOSE 10%',
      softMinRate: 2,
      softMaxRate: 40,
    },
    {
      id: 'glucose-40',
      name: { ru: 'Глюкоза 40%', kk: 'Глюкоза 40%' },
      pumpLabel: 'GLUCOSE 40%',
      softMinRate: 1,
      softMaxRate: 10,
      critical: true,
    },
  ],
  correctDrugId: 'glucose-20',
  acceptableRoutes: ['picc', 'cvc'],
  criticalRoutes: ['piv'],
  calcSteps: [
    {
      id: 'rate',
      quantity: 'rateMlH',
      prompt: { ru: 'Рассчитайте скорость по GIR.', kk: 'GIR бойынша жылдамдықты есептеңіз.' },
      hint: {
        ru: 'Скорость (мл/ч) = GIR (мг/кг/мин) × масса (кг) × 60 ÷ концентрация (мг/мл). Глюкоза 20% = 200 мг/мл.',
        kk: 'Жылдамдық (мл/сағ) = GIR (мг/кг/мин) × салмақ (кг) × 60 ÷ концентрация (мг/мл). Глюкоза 20% = 200 мг/мл.',
      },
      unit: 'ml_h',
      unitOptions: RATE_UNITS,
    },
  ],
  alarm: null,
  sources: [SOURCES.aspen, SOURCES.gir],
};
```

- [ ] **Step 9: Создать `lib/scenarios/index.ts`**

```ts
import type { Scenario } from '../engine/types';
import { s1Paracetamol } from './s1-paracetamol';
import { s2Ceftriaxone } from './s2-ceftriaxone';
import { s3SalineBolus } from './s3-saline-bolus';
import { s4Maintenance } from './s4-maintenance';
import { s5Glucose } from './s5-glucose';

export const scenarios: Scenario[] = [s1Paracetamol, s2Ceftriaxone, s3SalineBolus, s4Maintenance, s5Glucose];

export function getScenario(id: string): Scenario | undefined {
  return scenarios.find((s) => s.id === id);
}
```

- [ ] **Step 10: Запустить тесты**

Run: `npx vitest run lib/scenarios/scenarios.test.ts`
Expected: PASS.

- [ ] **Step 11: Commit**

```bash
git add lib/scenarios
git commit -m "feat(scenarios): add five draft clinical scenarios with sources" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 5: Сессия и журнал событий (`lib/engine/session.ts`)

**Files:**
- Create: `lib/engine/session.ts`
- Modify: `lib/engine/testing.ts` (добавить помощники для журналов)
- Test: `lib/engine/session.test.ts`

**Interfaces:**
- Consumes: всё из `./pump` (Task 3), `expectedValues`, `Expected` из `./calc`, типы из `./types`, `getScenario`, `scenarios` из `../scenarios` (Task 4).
- Produces (session.ts): `CALC_TOLERANCE = 0.05`, `CRITICAL_RATE_RATIO = 2`, `EXAM_ALARM_WRONG_LIMIT = 3`, `class ReplayError extends Error`, `type SimStep = 'drug' | 'route' | 'calc' | 'pump' | 'infusion' | 'done'`, `interface Attempts { attempts: number; correctAt: number | null }`, `interface StartRecord { attempts; rateOkAt; vtbiOkAt; checkOkAt }` (`number | null`), `interface AlarmProgress { performed: string[]; wrongCount: number; resolved: boolean; depleted: boolean; autoResolved: boolean }`, `type Feedback = { kind: 'correct' } | { kind: 'wrong'; codes: ErrorCode[] } | { kind: 'blocked'; codes: ErrorCode[] } | { kind: 'reveal'; text: L10n } | null`, `interface Session { scenario; mode; expected: Expected; step: SimStep; drug: Attempts & { selectedId: string | null }; route: Attempts & { selectedId: RouteId | null }; calc: Record<string, Attempts>; calcIndex: number; pump: PumpState; checklistDone: boolean; start: StartRecord; alarm: AlarmProgress | null; errors: SimError[]; critical: boolean; feedback: Feedback; lastT: number; finished: boolean }`, `createSession(scenario, mode)`, `applyEvent(session, event)`, `replay(scenario, mode, events)`, `nextAlarmStep(session): string | null` (id следующего правильного действия, `'START'` если остался перезапуск, иначе `null`).
- Produces (testing.ts): `stamp(inputs: EventInput[], stepMs = 1000): SimEvent[]`, `pumpInputs(buttons)`, `setupInputs(scenario)`, `startInputs(scenario, { rateTenths?, vtbiTenths?, checklist? })`, `alarmInputs(scenario)`, `perfectEvents(scenario): SimEvent[]`.

- [ ] **Step 1: Дополнить `lib/engine/testing.ts`** — заменить файл целиком:

```ts
import { expectedValues } from './calc';
import { FIELD_DIGITS, toDigits } from './pump';
import type { EventInput, PumpButton, Scenario, SimEvent } from './types';

/** Button presses that turn an all-zero draft (cursor on the first digit) into `tenths`. */
export function digitPresses(tenths: number, count: number): PumpButton[] {
  const presses: PumpButton[] = [];
  toDigits(tenths, count).forEach((digit, index) => {
    if (index > 0) presses.push('RIGHT');
    for (let k = 0; k < digit; k++) presses.push('PLUS');
  });
  return presses;
}

/** From a switched-off pump: power on, enter RATE, switch to VTBI, enter VTBI. */
export function programPump(rateTenths: number, vtbiTenths: number): PumpButton[] {
  return [
    'POWER',
    'ENTER', ...digitPresses(rateTenths, FIELD_DIGITS.rate), 'ENTER',
    'MENU',
    'ENTER', ...digitPresses(vtbiTenths, FIELD_DIGITS.vtbi), 'ENTER',
  ];
}

/** Gives events increasing timestamps: stepMs, 2 × stepMs, … */
export function stamp(inputs: EventInput[], stepMs = 1000): SimEvent[] {
  return inputs.map((input, i) => ({ ...input, t: (i + 1) * stepMs }) as SimEvent);
}

export const pumpInputs = (buttons: PumpButton[]): EventInput[] =>
  buttons.map((button) => ({ type: 'pumpButton', button }));

/** Correct drug, route and calculation answers. */
export function setupInputs(scenario: Scenario): EventInput[] {
  const exp = expectedValues(scenario.prescription, scenario.patient.weightKg);
  const route = scenario.acceptableRoutes.find((r) => scenario.patient.accesses.includes(r));
  if (!route) throw new Error(`${scenario.id}: no usable route`);
  return [
    { type: 'drugSelected', optionId: scenario.correctDrugId },
    { type: 'routeSelected', routeId: route },
    ...scenario.calcSteps.map(
      (c): EventInput => ({ type: 'calcAnswered', stepId: c.id, value: exp[c.quantity] ?? NaN, unit: c.unit }),
    ),
  ];
}

/** Program the pump (prescribed values unless overridden), optionally double-check, START twice. */
export function startInputs(
  scenario: Scenario,
  opts: { rateTenths?: number; vtbiTenths?: number; checklist?: boolean } = {},
): EventInput[] {
  const exp = expectedValues(scenario.prescription, scenario.patient.weightKg);
  const rate = opts.rateTenths ?? Math.round(exp.rateMlH * 10);
  const vtbi = opts.vtbiTenths ?? Math.round(exp.vtbiMl * 10);
  const check: EventInput[] = opts.checklist === false ? [] : [{ type: 'checklistCompleted' }];
  return [...pumpInputs(programPump(rate, vtbi)), ...check, ...pumpInputs(['START', 'START'])];
}

/** Raise the scenario alarm and answer it correctly. */
export function alarmInputs(scenario: Scenario): EventInput[] {
  const alarm = scenario.alarm;
  if (!alarm) return [];
  return [
    { type: 'alarmRaised', alarm: alarm.type },
    { type: 'pumpButton', button: 'MUTE' },
    ...alarm.sequence.map((id): EventInput => ({ type: 'alarmAction', actionId: id })),
    ...(alarm.type === 'lowBattery' ? [] : pumpInputs(['START'])),
  ];
}

export function perfectEvents(scenario: Scenario): SimEvent[] {
  return stamp([
    ...setupInputs(scenario),
    ...startInputs(scenario),
    ...alarmInputs(scenario),
    { type: 'infusionCompleted' },
  ]);
}
```

- [ ] **Step 2: Написать падающие тесты `lib/engine/session.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { getScenario, scenarios } from '../scenarios';
import { ReplayError, applyEvent, createSession, nextAlarmStep, replay, type Session } from './session';
import { digitPresses, perfectEvents, programPump, pumpInputs, setupInputs, stamp, startInputs } from './testing';
import type { EventInput, Mode, Scenario } from './types';

const sc = (id: string): Scenario => getScenario(id)!;
const run = (scenario: Scenario, mode: Mode, inputs: EventInput[]): Session =>
  replay(scenario, mode, stamp(inputs));

describe('perfect runs', () => {
  it.each(scenarios)('$id finishes without errors in both modes', (scenario) => {
    for (const mode of ['learning', 'exam'] as const) {
      const s = replay(scenario, mode, perfectEvents(scenario));
      expect(s.finished).toBe(true);
      expect(s.errors).toEqual([]);
      expect(s.critical).toBe(false);
      expect(s.pump.status).toBe('complete');
    }
  });
});

describe('log validation', () => {
  it('rejects events at the wrong step', () => {
    expect(() =>
      run(sc('s1-paracetamol'), 'exam', [{ type: 'calcAnswered', stepId: 'dose', value: 210, unit: 'mg' }]),
    ).toThrow(ReplayError);
  });

  it('rejects time going backwards', () => {
    const s = createSession(sc('s1-paracetamol'), 'exam');
    const after = applyEvent(s, { type: 'drugSelected', optionId: 'paracetamol-10', t: 5000 });
    expect(() => applyEvent(after, { type: 'routeSelected', routeId: 'piv', t: 4000 })).toThrow(ReplayError);
  });

  it('rejects unknown ids', () => {
    expect(() => run(sc('s1-paracetamol'), 'exam', [{ type: 'drugSelected', optionId: 'nope' }])).toThrow(
      ReplayError,
    );
  });

  it('rejects an alarm the scenario does not have', () => {
    const s1 = sc('s1-paracetamol');
    expect(() =>
      run(s1, 'exam', [...setupInputs(s1), ...startInputs(s1), { type: 'alarmRaised', alarm: 'occlusion' }]),
    ).toThrow(ReplayError);
  });

  it('rejects completion while the scenario alarm was not handled', () => {
    const s2 = sc('s2-ceftriaxone');
    expect(() => run(s2, 'exam', [...setupInputs(s2), ...startInputs(s2), { type: 'infusionCompleted' }])).toThrow(
      ReplayError,
    );
  });

  it('rejects events after the session finished', () => {
    const s1 = sc('s1-paracetamol');
    const done = replay(s1, 'exam', perfectEvents(s1));
    expect(() => applyEvent(done, { type: 'pumpButton', button: 'MUTE', t: done.lastT + 1 })).toThrow(ReplayError);
  });
});

describe('drug, route and calculation steps', () => {
  it('learning mode stays on a wrong drug and counts attempts', () => {
    const s = run(sc('s1-paracetamol'), 'learning', [{ type: 'drugSelected', optionId: 'ketorolac-30' }]);
    expect(s.step).toBe('drug');
    expect(s.errors).toEqual([{ code: 'wrongDrug', ref: 'ketorolac-30' }]);
    expect(s.feedback).toEqual({ kind: 'wrong', codes: ['wrongDrug'] });
    const next = applyEvent(s, { type: 'drugSelected', optionId: 'paracetamol-10', t: s.lastT + 1 });
    expect(next.step).toBe('route');
    expect(next.drug).toMatchObject({ attempts: 2, correctAt: 2, selectedId: 'paracetamol-10' });
  });

  it('exam mode moves on after a wrong drug', () => {
    const s = run(sc('s1-paracetamol'), 'exam', [{ type: 'drugSelected', optionId: 'ketorolac-30' }]);
    expect(s.step).toBe('route');
    expect(s.drug.correctAt).toBeNull();
  });

  it('a dangerous look-alike marks the session critical', () => {
    const s = run(sc('s3-saline-bolus'), 'learning', [{ type: 'drugSelected', optionId: 'nacl-10' }]);
    expect(s.critical).toBe(true);
    expect(s.errors[0].code).toBe('criticalDrug');
  });

  it('checks that the access exists and is allowed', () => {
    const s1 = sc('s1-paracetamol');
    const missing = run(s1, 'learning', [
      { type: 'drugSelected', optionId: 'paracetamol-10' },
      { type: 'routeSelected', routeId: 'cvc' },
    ]);
    expect(missing.errors.at(-1)).toEqual({ code: 'routeNotAvailable', ref: 'cvc' });
    expect(missing.step).toBe('route');

    const s5 = sc('s5-glucose');
    const peripheral = run(s5, 'exam', [
      { type: 'drugSelected', optionId: 'glucose-20' },
      { type: 'routeSelected', routeId: 'piv' },
    ]);
    expect(peripheral.critical).toBe(true);
    expect(peripheral.errors.at(-1)?.code).toBe('criticalRoute');

    const central = run(s5, 'exam', [
      { type: 'drugSelected', optionId: 'glucose-20' },
      { type: 'routeSelected', routeId: 'picc' },
    ]);
    expect(central.critical).toBe(false);
    expect(central.step).toBe('calc');
  });

  it('separates a wrong unit from a wrong value and accepts the tolerance', () => {
    const s1 = sc('s1-paracetamol');
    const base: EventInput[] = [
      { type: 'drugSelected', optionId: 'paracetamol-10' },
      { type: 'routeSelected', routeId: 'piv' },
    ];
    const unit = run(s1, 'learning', [...base, { type: 'calcAnswered', stepId: 'dose', value: 210, unit: 'mg_kg' }]);
    expect(unit.errors.at(-1)).toEqual({ code: 'wrongUnit', ref: 'dose' });
    const value = run(s1, 'learning', [...base, { type: 'calcAnswered', stepId: 'dose', value: 21, unit: 'mg' }]);
    expect(value.errors.at(-1)).toEqual({ code: 'wrongCalc', ref: 'dose' });
    const close = run(s1, 'learning', [...base, { type: 'calcAnswered', stepId: 'dose', value: 209.96, unit: 'mg' }]);
    expect(close.errors).toEqual([]);
    expect(close.calcIndex).toBe(1);
  });
});

describe('starting the pump', () => {
  const s1 = sc('s1-paracetamol');
  // 840.0 ml/h (ten times the order): over the 150 ml/h soft limit, confirmed with a second ENTER.
  const tenfold = pumpInputs([
    'POWER', 'ENTER', ...digitPresses(8400, 4), 'ENTER', 'ENTER',
    'MENU', 'ENTER', ...digitPresses(210, 5), 'ENTER',
  ]);

  it('learning mode blocks a wrong rate and returns to programming', () => {
    const s = run(s1, 'learning', [
      ...setupInputs(s1),
      ...pumpInputs(programPump(850, 210)),
      { type: 'checklistCompleted' },
      ...pumpInputs(['START', 'START']),
    ]);
    expect(s.step).toBe('pump');
    expect(s.pump.status).toBe('program');
    expect(s.feedback).toEqual({ kind: 'blocked', codes: ['wrongRate'] });
    expect(s.start).toEqual({ attempts: 1, rateOkAt: null, vtbiOkAt: 1, checkOkAt: 1 });
  });

  it('a tenfold rate overrides the library warning and is critical', () => {
    const s = run(s1, 'exam', [...setupInputs(s1), ...tenfold, { type: 'checklistCompleted' }, ...pumpInputs(['START', 'START'])]);
    expect(s.step).toBe('infusion');
    expect(s.critical).toBe(true);
    expect(s.errors.map((e) => e.code)).toEqual(['ignoredLimitWarning', 'criticalRate']);
  });

  it('learning mode requires the double check; each category keeps its own first success', () => {
    const blocked = run(s1, 'learning', [...setupInputs(s1), ...startInputs(s1, { checklist: false })]);
    expect(blocked.feedback).toEqual({ kind: 'blocked', codes: ['startWithoutCheck'] });
    const s = run(s1, 'learning', [
      ...setupInputs(s1),
      ...startInputs(s1, { checklist: false }),
      { type: 'checklistCompleted' },
      ...pumpInputs(['START', 'START']),
    ]);
    expect(s.step).toBe('infusion');
    expect(s.start).toEqual({ attempts: 2, rateOkAt: 1, vtbiOkAt: 1, checkOkAt: 2 });
  });

  it('exam mode starts with wrong settings and records the errors silently', () => {
    const s = run(s1, 'exam', [...setupInputs(s1), ...startInputs(s1, { rateTenths: 850, checklist: false })]);
    expect(s.step).toBe('infusion');
    expect(s.pump.status).toBe('running');
    expect(s.feedback).toBeNull();
    expect(s.errors.map((e) => e.code)).toEqual(['wrongRate', 'startWithoutCheck']);
  });
});

describe('alarms', () => {
  const s2 = sc('s2-ceftriaxone');
  const occluded: EventInput[] = [...setupInputs(s2), ...startInputs(s2), { type: 'alarmRaised', alarm: 'occlusion' }];

  it('occlusion: a restart before the fix is a wrong action', () => {
    const s = run(s2, 'learning', [...occluded, { type: 'alarmAction', actionId: 'check_line' }, ...pumpInputs(['START'])]);
    expect(s.pump.status).toBe('alarmStopped');
    expect(s.errors.at(-1)).toEqual({ code: 'restartWithoutFix', ref: 'START' });
    expect(s.alarm).toMatchObject({ wrongCount: 1, resolved: false, performed: ['check_line'] });
    expect(nextAlarmStep(s)).toBe('open_clamp');
  });

  it('occlusion: inspection reveals the cause, then fix and restart', () => {
    const inspected = run(s2, 'learning', [...occluded, { type: 'alarmAction', actionId: 'check_line' }]);
    expect(inspected.feedback?.kind).toBe('reveal');
    const fixed = run(s2, 'learning', [
      ...occluded,
      { type: 'alarmAction', actionId: 'check_line' },
      { type: 'alarmAction', actionId: 'open_clamp' },
    ]);
    expect(nextAlarmStep(fixed)).toBe('START');
    const resumed = applyEvent(fixed, { type: 'pumpButton', button: 'START', t: fixed.lastT + 1 });
    expect(resumed.pump).toMatchObject({ status: 'running', alarm: null });
    expect(resumed.alarm?.resolved).toBe(true);
    expect(nextAlarmStep(resumed)).toBeNull();
  });

  it('exam mode: a senior colleague resolves the alarm after three wrong actions', () => {
    const wrong: EventInput = { type: 'alarmAction', actionId: 'flush_force' };
    const s = run(s2, 'exam', [...occluded, wrong, wrong, wrong]);
    expect(s.alarm).toMatchObject({ resolved: true, autoResolved: true, wrongCount: 3 });
    expect(s.pump.status).toBe('running');
  });

  const s4 = sc('s4-maintenance');
  const lowBattery: EventInput[] = [...setupInputs(s4), ...startInputs(s4), { type: 'alarmRaised', alarm: 'lowBattery' }];

  it('low battery: the pump keeps running, STOP is needless, mains resolves it', () => {
    expect(run(s4, 'learning', lowBattery).pump.status).toBe('running');
    const s = run(s4, 'learning', [
      ...lowBattery,
      ...pumpInputs(['STOP']),
      { type: 'alarmAction', actionId: 'connect_power' },
      ...pumpInputs(['START']),
    ]);
    expect(s.errors.map((e) => e.code)).toEqual(['stoppedNeedlessly']);
    expect(s.alarm).toMatchObject({ resolved: true, wrongCount: 1 });
    expect(s.pump).toMatchObject({ status: 'running', onMains: true, alarm: null });
  });

  it('low battery: depletion stops the pump until mains and START', () => {
    const s = run(s4, 'exam', [
      ...lowBattery,
      { type: 'batteryDepleted' },
      { type: 'alarmAction', actionId: 'connect_power' },
    ]);
    expect(s.pump.status).toBe('alarmStopped');
    expect(nextAlarmStep(s)).toBe('START');
    const resumed = applyEvent(s, { type: 'pumpButton', button: 'START', t: s.lastT + 1 });
    expect(resumed.alarm).toMatchObject({ resolved: true, depleted: true });
    const done = applyEvent(resumed, { type: 'infusionCompleted', t: resumed.lastT + 1 });
    expect(done.finished).toBe(true);
    expect(done.errors.map((e) => e.code)).toEqual(['batteryDepleted']);
  });
});
```

- [ ] **Step 3: Запустить и убедиться, что тесты падают**

Run: `npx vitest run lib/engine/session.test.ts`
Expected: FAIL — `Failed to resolve import "./session"`.

- [ ] **Step 4: Реализовать `lib/engine/session.ts`**

```ts
import { expectedValues, type Expected } from './calc';
import {
  beginInfusion, completeInfusion, createPump, depleteBattery, markAlarmFixed, pressButton,
  raiseAlarm, rejectStart, resumeAfterAlarm, setRateLimits, type PumpState,
} from './pump';
import type {
  AlarmType, ErrorCode, L10n, Mode, PumpButton, RouteId, Scenario, SimError, SimEvent, UnitId,
} from './types';

export const CALC_TOLERANCE = 0.05;
export const CRITICAL_RATE_RATIO = 2;
/** Exam mode: after this many wrong actions a senior colleague resolves the alarm. */
export const EXAM_ALARM_WRONG_LIMIT = 3;

export class ReplayError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReplayError';
  }
}

export type SimStep = 'drug' | 'route' | 'calc' | 'pump' | 'infusion' | 'done';

export interface Attempts {
  attempts: number;
  /** 1-based number of the first correct attempt. */
  correctAt: number | null;
}

export interface StartRecord {
  attempts: number;
  rateOkAt: number | null;
  vtbiOkAt: number | null;
  checkOkAt: number | null;
}

export interface AlarmProgress {
  /** Correct actions, in the order the student first did them. */
  performed: string[];
  wrongCount: number;
  resolved: boolean;
  depleted: boolean;
  autoResolved: boolean;
}

export type Feedback =
  | { kind: 'correct' }
  | { kind: 'wrong'; codes: ErrorCode[] }
  | { kind: 'blocked'; codes: ErrorCode[] }
  | { kind: 'reveal'; text: L10n }
  | null;

export interface Session {
  scenario: Scenario;
  mode: Mode;
  expected: Expected;
  step: SimStep;
  drug: Attempts & { selectedId: string | null };
  route: Attempts & { selectedId: RouteId | null };
  calc: Record<string, Attempts>;
  calcIndex: number;
  pump: PumpState;
  checklistDone: boolean;
  start: StartRecord;
  alarm: AlarmProgress | null;
  errors: SimError[];
  critical: boolean;
  feedback: Feedback;
  lastT: number;
  finished: boolean;
}

export function createSession(scenario: Scenario, mode: Mode): Session {
  return {
    scenario,
    mode,
    expected: expectedValues(scenario.prescription, scenario.patient.weightKg),
    step: 'drug',
    drug: { attempts: 0, correctAt: null, selectedId: null },
    route: { attempts: 0, correctAt: null, selectedId: null },
    calc: Object.fromEntries(scenario.calcSteps.map((c) => [c.id, { attempts: 0, correctAt: null }])),
    calcIndex: 0,
    pump: createPump(),
    checklistDone: false,
    start: { attempts: 0, rateOkAt: null, vtbiOkAt: null, checkOkAt: null },
    alarm: null,
    errors: [],
    critical: false,
    feedback: null,
    lastT: 0,
    finished: false,
  };
}

export function applyEvent(s: Session, e: SimEvent): Session {
  if (s.finished) throw new ReplayError('the session is already finished');
  if (!Number.isFinite(e.t) || e.t < s.lastT) throw new ReplayError('event time goes backwards');
  const next: Session = { ...s, lastT: e.t, feedback: null };
  switch (e.type) {
    case 'drugSelected':
      return onDrug(next, e.optionId);
    case 'routeSelected':
      return onRoute(next, e.routeId);
    case 'calcAnswered':
      return onCalc(next, e.stepId, e.value, e.unit);
    case 'pumpButton':
      return onPump(next, e.button);
    case 'checklistCompleted':
      return onChecklist(next);
    case 'alarmRaised':
      return onAlarmRaised(next, e.alarm);
    case 'batteryDepleted':
      return onBatteryDepleted(next);
    case 'alarmAction':
      return onAlarmAction(next, e.actionId);
    case 'infusionCompleted':
      return onCompleted(next);
  }
}

export function replay(scenario: Scenario, mode: Mode, events: SimEvent[]): Session {
  return events.reduce(applyEvent, createSession(scenario, mode));
}

/** The next correct alarm action id, 'START' when only the restart is left, or null. */
export function nextAlarmStep(s: Session): string | null {
  const spec = s.scenario.alarm;
  const alarm = s.alarm;
  if (!spec || !alarm || alarm.resolved) return null;
  return spec.sequence.find((id) => !alarm.performed.includes(id)) ?? 'START';
}

function requireStep(s: Session, ...steps: SimStep[]): void {
  if (!steps.includes(s.step)) throw new ReplayError(`unexpected event at step "${s.step}"`);
}

const countAttempt = (a: Attempts, correct: boolean): Attempts => ({
  attempts: a.attempts + 1,
  correctAt: a.correctAt ?? (correct ? a.attempts + 1 : null),
});

const withErrors = (s: Session, errors: SimError[]): Session =>
  errors.length > 0 ? { ...s, errors: [...s.errors, ...errors] } : s;

const feedbackFor = (errors: SimError[]): Feedback =>
  errors.length > 0 ? { kind: 'wrong', codes: errors.map((e) => e.code) } : { kind: 'correct' };

/** Learning mode moves on only after a correct answer; exam mode always moves on. */
const advance = (s: Session, correct: boolean, patch: Partial<Session>): Session =>
  s.mode === 'exam' || correct ? { ...s, ...patch } : s;

function onDrug(s: Session, optionId: string): Session {
  requireStep(s, 'drug');
  const option = s.scenario.drugOptions.find((o) => o.id === optionId);
  if (!option) throw new ReplayError(`unknown drug option: ${optionId}`);
  const correct = option.id === s.scenario.correctDrugId;
  const errors: SimError[] = correct ? [] : [{ code: option.critical ? 'criticalDrug' : 'wrongDrug', ref: option.id }];
  const next = withErrors(
    {
      ...s,
      drug: { ...countAttempt(s.drug, correct), selectedId: option.id },
      pump: setRateLimits(s.pump, option.softMinRate, option.softMaxRate),
      critical: s.critical || option.critical === true,
      feedback: feedbackFor(errors),
    },
    errors,
  );
  return advance(next, correct, { step: 'route' });
}

function onRoute(s: Session, routeId: RouteId): Session {
  requireStep(s, 'route');
  const { patient, acceptableRoutes, criticalRoutes, calcSteps } = s.scenario;
  const available = patient.accesses.includes(routeId);
  const isCritical = available && criticalRoutes.includes(routeId);
  const correct = available && acceptableRoutes.includes(routeId);
  const code: ErrorCode | null = !available
    ? 'routeNotAvailable'
    : isCritical
      ? 'criticalRoute'
      : correct
        ? null
        : 'wrongRoute';
  const errors: SimError[] = code ? [{ code, ref: routeId }] : [];
  const next = withErrors(
    {
      ...s,
      route: { ...countAttempt(s.route, correct), selectedId: routeId },
      critical: s.critical || isCritical,
      feedback: feedbackFor(errors),
    },
    errors,
  );
  return advance(next, correct, calcSteps.length > 0 ? { step: 'calc', calcIndex: 0 } : { step: 'pump' });
}

function onCalc(s: Session, stepId: string, value: number, unit: UnitId): Session {
  requireStep(s, 'calc');
  const step = s.scenario.calcSteps[s.calcIndex];
  if (!step || step.id !== stepId) throw new ReplayError(`unexpected calc step: ${stepId}`);
  const expected = s.expected[step.quantity];
  if (expected === null) throw new ReplayError(`scenario has no ${step.quantity}`);
  if (!Number.isFinite(value)) throw new ReplayError('calc value is not a number');
  const valueOk = Math.abs(value - expected) <= CALC_TOLERANCE + 1e-9;
  const correct = valueOk && unit === step.unit;
  const errors: SimError[] = correct ? [] : [{ code: valueOk ? 'wrongUnit' : 'wrongCalc', ref: step.id }];
  const next = withErrors(
    { ...s, calc: { ...s.calc, [step.id]: countAttempt(s.calc[step.id], correct) }, feedback: feedbackFor(errors) },
    errors,
  );
  const last = s.calcIndex === s.scenario.calcSteps.length - 1;
  return advance(next, correct, last ? { step: 'pump' } : { calcIndex: s.calcIndex + 1 });
}

function onChecklist(s: Session): Session {
  requireStep(s, 'pump');
  return { ...s, checklistDone: true };
}

function onPump(s: Session, button: PumpButton): Session {
  requireStep(s, 'pump', 'infusion');
  const { state: pump, effect } = pressButton(s.pump, button);
  const next: Session = { ...s, pump };
  switch (effect) {
    case 'limitOverride':
      return withErrors(next, [{ code: 'ignoredLimitWarning' }]);
    case 'startAttempt':
      return onStartAttempt(next);
    case 'restartAttempt':
      return onRestartAttempt(next);
    case 'stopped':
      return onStopped(next);
    default:
      return next;
  }
}

function onStartAttempt(s: Session): Session {
  if (s.step !== 'pump') throw new ReplayError('start attempt outside the pump step');
  const n = s.start.attempts + 1;
  const expectedRate = Math.round(s.expected.rateMlH * 10);
  const rateOk = s.pump.rateTenths === expectedRate;
  const vtbiOk = s.pump.vtbiTenths === Math.round(s.expected.vtbiMl * 10);
  const checkOk = s.checklistDone;
  const ratio = s.pump.rateTenths / expectedRate;
  const rateCritical = !rateOk && (ratio >= CRITICAL_RATE_RATIO || ratio <= 1 / CRITICAL_RATE_RATIO);
  const errors: SimError[] = [];
  if (!rateOk) errors.push({ code: rateCritical ? 'criticalRate' : 'wrongRate' });
  if (!vtbiOk) errors.push({ code: 'wrongVtbi' });
  if (!checkOk) errors.push({ code: 'startWithoutCheck' });
  const start: StartRecord = {
    attempts: n,
    rateOkAt: s.start.rateOkAt ?? (rateOk ? n : null),
    vtbiOkAt: s.start.vtbiOkAt ?? (vtbiOk ? n : null),
    checkOkAt: s.start.checkOkAt ?? (checkOk ? n : null),
  };
  const next = withErrors({ ...s, start, critical: s.critical || rateCritical }, errors);
  const allOk = errors.length === 0;
  if (s.mode === 'learning' && !allOk) {
    return { ...next, pump: rejectStart(next.pump), feedback: { kind: 'blocked', codes: errors.map((e) => e.code) } };
  }
  return { ...next, pump: beginInfusion(next.pump), step: 'infusion', feedback: allOk ? { kind: 'correct' } : null };
}

function onRestartAttempt(s: Session): Session {
  if (!s.alarm || !s.pump.alarm) throw new ReplayError('restart without an active alarm');
  if (s.pump.alarm.fixed) {
    return { ...s, pump: resumeAfterAlarm(s.pump), alarm: { ...s.alarm, resolved: true }, feedback: { kind: 'correct' } };
  }
  return wrongAlarmAction(s, 'restartWithoutFix', 'START');
}

function onStopped(s: Session): Session {
  const lowBatteryActive = s.scenario.alarm?.type === 'lowBattery' && s.alarm !== null && !s.alarm.resolved;
  return lowBatteryActive ? wrongAlarmAction(s, 'stoppedNeedlessly', 'STOP') : s;
}

function wrongAlarmAction(s: Session, code: ErrorCode, ref: string): Session {
  if (!s.alarm) throw new ReplayError('no active alarm');
  const alarm: AlarmProgress = { ...s.alarm, wrongCount: s.alarm.wrongCount + 1 };
  const next = withErrors({ ...s, alarm, feedback: { kind: 'wrong', codes: [code] } }, [{ code, ref }]);
  return next.mode === 'exam' && alarm.wrongCount >= EXAM_ALARM_WRONG_LIMIT ? autoResolve(next) : next;
}

function autoResolve(s: Session): Session {
  let pump = s.pump;
  if (pump.alarm?.type === 'lowBattery' && !pump.alarm.depleted) {
    pump = markAlarmFixed(pump);
  } else if (pump.alarm) {
    pump = resumeAfterAlarm({ ...pump, onMains: pump.onMains || pump.alarm.type === 'lowBattery' });
  }
  return { ...s, pump, alarm: { ...s.alarm!, resolved: true, autoResolved: true } };
}

function onAlarmRaised(s: Session, type: AlarmType): Session {
  requireStep(s, 'infusion');
  if (s.scenario.alarm?.type !== type) throw new ReplayError(`scenario has no ${type} alarm`);
  if (s.alarm) throw new ReplayError('the alarm was already raised');
  if (s.pump.status !== 'running') throw new ReplayError('alarm raised while the pump is not running');
  return {
    ...s,
    alarm: { performed: [], wrongCount: 0, resolved: false, depleted: false, autoResolved: false },
    pump: raiseAlarm(s.pump, type),
  };
}

function onBatteryDepleted(s: Session): Session {
  requireStep(s, 'infusion');
  const a = s.alarm;
  if (s.scenario.alarm?.type !== 'lowBattery' || !a || a.resolved || a.depleted || s.pump.status !== 'running') {
    throw new ReplayError('unexpected battery depletion');
  }
  return withErrors({ ...s, alarm: { ...a, depleted: true }, pump: depleteBattery(s.pump) }, [{ code: 'batteryDepleted' }]);
}

function onAlarmAction(s: Session, actionId: string): Session {
  requireStep(s, 'infusion');
  const spec = s.scenario.alarm;
  const a = s.alarm;
  if (!spec || !a || a.resolved) throw new ReplayError('no active alarm');
  const action = spec.actions.find((x) => x.id === actionId);
  if (!action) throw new ReplayError(`unknown alarm action: ${actionId}`);
  if (!spec.sequence.includes(actionId)) return wrongAlarmAction(s, 'wrongAlarmAction', actionId);
  if (a.performed.includes(actionId)) return s;
  const performed = [...a.performed, actionId];
  let next: Session = {
    ...s,
    alarm: { ...a, performed },
    feedback: action.reveals ? { kind: 'reveal', text: action.reveals } : { kind: 'correct' },
  };
  if (spec.sequence.every((id) => performed.includes(id))) {
    next = { ...next, pump: markAlarmFixed(next.pump) };
    if (spec.type === 'lowBattery' && !a.depleted) {
      next = { ...next, alarm: { ...a, performed, resolved: true } };
    }
  }
  return next;
}

function onCompleted(s: Session): Session {
  requireStep(s, 'infusion');
  if (s.pump.status !== 'running' || s.pump.alarm) throw new ReplayError('the infusion cannot complete now');
  if (s.scenario.alarm && !s.alarm?.resolved) throw new ReplayError('the alarm was not handled');
  return { ...s, pump: completeInfusion(s.pump), step: 'done', finished: true };
}
```

- [ ] **Step 5: Запустить тесты**

Run: `npx vitest run lib/engine`
Expected: PASS (calc, pump, session).

- [ ] **Step 6: Commit**

```bash
git add lib/engine/session.ts lib/engine/session.test.ts lib/engine/testing.ts
git commit -m "feat(engine): add event-sourced simulation session" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 6: Баллы (`lib/engine/grading.ts`)

**Files:**
- Create: `lib/engine/grading.ts`
- Test: `lib/engine/grading.test.ts`

**Interfaces:**
- Consumes: `Session`, `EXAM_ALARM_WRONG_LIMIT` из `./session`; `Mode`, `SimError` из `./types`.
- Produces: `POINTS = { drug: 15, route: 15, calc: 20, rate: 20, vtbi: 10, check: 10, alarm: 10 }`, `type Category = keyof typeof POINTS`, `CATEGORIES: Category[]`, `type Breakdown = Record<Category, number>`, `interface Grade { score: number; passed: boolean; breakdown: Breakdown; errors: SimError[]; durationSec: number }`, `attemptFactor(correctAt, mode)`, `gradeSession(session): Grade` (бросает `Error` для незавершённой сессии).

- [ ] **Step 1: Написать падающие тесты `lib/engine/grading.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { getScenario, scenarios } from '../scenarios';
import { attemptFactor, gradeSession } from './grading';
import { replay } from './session';
import { digitPresses, perfectEvents, pumpInputs, setupInputs, stamp, startInputs } from './testing';
import type { EventInput, Mode, Scenario } from './types';

const sc = (id: string): Scenario => getScenario(id)!;
const grade = (scenario: Scenario, mode: Mode, inputs: EventInput[]) =>
  gradeSession(replay(scenario, mode, stamp(inputs)));
const done: EventInput = { type: 'infusionCompleted' };

describe('attemptFactor', () => {
  it('applies ×1 / ×0.5 / ×0 in learning mode and one attempt in exam mode', () => {
    expect(attemptFactor(1, 'learning')).toBe(1);
    expect(attemptFactor(2, 'learning')).toBe(0.5);
    expect(attemptFactor(3, 'learning')).toBe(0);
    expect(attemptFactor(null, 'learning')).toBe(0);
    expect(attemptFactor(1, 'exam')).toBe(1);
    expect(attemptFactor(2, 'exam')).toBe(0);
  });
});

describe('gradeSession', () => {
  it.each(scenarios)('$id: a perfect run scores 100 in both modes', (scenario) => {
    for (const mode of ['learning', 'exam'] as const) {
      const events = perfectEvents(scenario);
      const g = gradeSession(replay(scenario, mode, events));
      expect(g).toEqual({
        score: 100,
        passed: true,
        breakdown: { drug: 15, route: 15, calc: 20, rate: 20, vtbi: 10, check: 10, alarm: 10 },
        errors: [],
        durationSec: Math.round(events.at(-1)!.t / 1000),
      });
    }
  });

  it('refuses to grade an unfinished session', () => {
    const s1 = sc('s1-paracetamol');
    expect(() => gradeSession(replay(s1, 'exam', stamp(setupInputs(s1))))).toThrow();
  });

  it('learning: a drug found on the second try gives half points and loses "no errors"', () => {
    const s1 = sc('s1-paracetamol');
    const g = grade(s1, 'learning', [
      { type: 'drugSelected', optionId: 'ketorolac-30' },
      ...setupInputs(s1),
      ...startInputs(s1),
      done,
    ]);
    expect(g.breakdown.drug).toBe(7.5);
    expect(g.breakdown.alarm).toBe(0);
    expect(g.score).toBe(83);
    expect(g.passed).toBe(true);
  });

  it('learning: a calculation fixed on the second try gives half of that step', () => {
    const s1 = sc('s1-paracetamol');
    const [drug, route, dose, volume] = setupInputs(s1);
    const g = grade(s1, 'learning', [
      drug, route,
      { type: 'calcAnswered', stepId: 'dose', value: 21, unit: 'mg' },
      dose, volume,
      ...startInputs(s1),
      done,
    ]);
    expect(g.breakdown.calc).toBe(15);
    expect(g.score).toBe(85);
  });

  it('exam: a wrong rate and a skipped double check', () => {
    const s1 = sc('s1-paracetamol');
    const g = grade(s1, 'exam', [...setupInputs(s1), ...startInputs(s1, { rateTenths: 850, checklist: false }), done]);
    expect(g.breakdown).toEqual({ drug: 15, route: 15, calc: 20, rate: 0, vtbi: 10, check: 0, alarm: 0 });
    expect(g.score).toBe(60);
    expect(g.passed).toBe(true);
  });

  it('exam: a tenfold rate fails the station whatever the score', () => {
    const s1 = sc('s1-paracetamol');
    const tenfold = pumpInputs([
      'POWER', 'ENTER', ...digitPresses(8400, 4), 'ENTER', 'ENTER',
      'MENU', 'ENTER', ...digitPresses(210, 5), 'ENTER',
    ]);
    const g = grade(s1, 'exam', [
      ...setupInputs(s1), ...tenfold, { type: 'checklistCompleted' }, ...pumpInputs(['START', 'START']), done,
    ]);
    expect(g.score).toBe(70);
    expect(g.passed).toBe(false);
  });

  it('alarm actions out of order give half of the alarm points', () => {
    const s2 = sc('s2-ceftriaxone');
    const g = grade(s2, 'learning', [
      ...setupInputs(s2), ...startInputs(s2),
      { type: 'alarmRaised', alarm: 'occlusion' },
      { type: 'alarmAction', actionId: 'open_clamp' },
      { type: 'alarmAction', actionId: 'check_line' },
      ...pumpInputs(['START']),
      done,
    ]);
    expect(g.breakdown.alarm).toBe(5);
    expect(g.score).toBe(95);
  });

  it('a restart before the fix gives half of the alarm points', () => {
    const s2 = sc('s2-ceftriaxone');
    const g = grade(s2, 'learning', [
      ...setupInputs(s2), ...startInputs(s2),
      { type: 'alarmRaised', alarm: 'occlusion' },
      ...pumpInputs(['START']),
      { type: 'alarmAction', actionId: 'check_line' },
      { type: 'alarmAction', actionId: 'open_clamp' },
      ...pumpInputs(['START']),
      done,
    ]);
    expect(g.breakdown.alarm).toBe(5);
  });

  it('exam: an alarm resolved by a senior colleague gives no alarm points', () => {
    const s2 = sc('s2-ceftriaxone');
    const wrong: EventInput = { type: 'alarmAction', actionId: 'power_cycle' };
    const g = grade(s2, 'exam', [
      ...setupInputs(s2), ...startInputs(s2), { type: 'alarmRaised', alarm: 'occlusion' }, wrong, wrong, wrong, done,
    ]);
    expect(g.breakdown.alarm).toBe(0);
    expect(g.score).toBe(90);
    expect(g.errors).toHaveLength(3);
  });

  it('a depleted battery gives no alarm points', () => {
    const s4 = sc('s4-maintenance');
    const g = grade(s4, 'exam', [
      ...setupInputs(s4), ...startInputs(s4),
      { type: 'alarmRaised', alarm: 'lowBattery' },
      { type: 'batteryDepleted' },
      { type: 'alarmAction', actionId: 'connect_power' },
      ...pumpInputs(['START']),
      done,
    ]);
    expect(g.breakdown.alarm).toBe(0);
    expect(g.score).toBe(90);
  });
});
```

- [ ] **Step 2: Запустить и убедиться, что тесты падают**

Run: `npx vitest run lib/engine/grading.test.ts`
Expected: FAIL — `Failed to resolve import "./grading"`.

- [ ] **Step 3: Реализовать `lib/engine/grading.ts`**

```ts
import { EXAM_ALARM_WRONG_LIMIT, type Session } from './session';
import type { Mode, SimError } from './types';

export const POINTS = { drug: 15, route: 15, calc: 20, rate: 20, vtbi: 10, check: 10, alarm: 10 } as const;
export type Category = keyof typeof POINTS;
export const CATEGORIES = Object.keys(POINTS) as Category[];
export type Breakdown = Record<Category, number>;

export interface Grade {
  score: number;
  passed: boolean;
  breakdown: Breakdown;
  errors: SimError[];
  durationSec: number;
}

export function attemptFactor(correctAt: number | null, mode: Mode): number {
  if (correctAt === 1) return 1;
  if (correctAt === 2 && mode === 'learning') return 0.5;
  return 0;
}

export function gradeSession(s: Session): Grade {
  if (!s.finished) throw new Error('cannot grade an unfinished session');
  const f = (at: number | null) => attemptFactor(at, s.mode);
  const steps = s.scenario.calcSteps;
  const calc =
    steps.length === 0
      ? POINTS.calc
      : steps.reduce((sum, c) => sum + (POINTS.calc / steps.length) * f(s.calc[c.id].correctAt), 0);
  const breakdown: Breakdown = {
    drug: POINTS.drug * f(s.drug.correctAt),
    route: POINTS.route * f(s.route.correctAt),
    calc,
    rate: POINTS.rate * f(s.start.rateOkAt),
    vtbi: POINTS.vtbi * f(s.start.vtbiOkAt),
    check: POINTS.check * f(s.start.checkOkAt),
    alarm: alarmPoints(s),
  };
  const total = CATEGORIES.reduce((sum, c) => sum + breakdown[c], 0);
  return {
    score: Math.round(total),
    passed: !s.critical,
    breakdown,
    errors: s.errors,
    durationSec: Math.round(s.lastT / 1000),
  };
}

function alarmPoints(s: Session): number {
  const spec = s.scenario.alarm;
  if (!spec) return s.errors.length === 0 ? POINTS.alarm : 0;
  const a = s.alarm;
  if (!a || !a.resolved || a.depleted || a.autoResolved || a.wrongCount >= EXAM_ALARM_WRONG_LIMIT) return 0;
  const inOrder = a.performed.every((id, i) => id === spec.sequence[i]);
  return a.wrongCount === 0 && inOrder ? POINTS.alarm : POINTS.alarm / 2;
}
```

- [ ] **Step 4: Запустить все тесты движка**

Run: `npx vitest run lib`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/engine/grading.ts lib/engine/grading.test.ts
git commit -m "feat(engine): add scoring with attempts, critical errors and alarm points" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 7: Словари интерфейса (`lib/i18n`)

**Files:**
- Create: `lib/i18n/ru.ts`, `lib/i18n/kk.ts`, `lib/i18n/index.ts`
- Test: `lib/i18n/i18n.test.ts`

**Interfaces:**
- Consumes: `ErrorCode`, `RouteId`, `UnitId`, `L10n`, `Locale` из `../engine/types`; `Category` из `../engine/grading`.
- Produces: `ru`, `type Dict = typeof ru`, `kk: Dict`, `dictionaries: Record<Locale, Dict>`, `DEFAULT_LOCALE = 'ru'`, `isLocale(x): x is Locale`. Ключи словаря, которые используют компоненты: `appName`, `appSubtitle`, `disclaimer`, `draftBadge`, `common.*`, `home.*`, `modes.*`, `scenarios.*`, `nickname.*`, `patient.*`, `steps.*`, `routes.*`, `units.*`, `feedback.*`, `pumpGuide[]`, `checklist.*`, `blocked.*`, `infusion.*`, `result.*`, `categories.*`, `errors.*`, `results.*`, `stand.*`, `admin.*`, `learn.*`.

- [ ] **Step 1: Написать падающий тест `lib/i18n/i18n.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { ERROR_CODES, ROUTE_IDS, UNIT_IDS } from '../engine/types';
import { CATEGORIES } from '../engine/grading';
import { dictionaries, isLocale } from './index';
import { kk } from './kk';
import { ru } from './ru';

function shape(x: unknown): unknown {
  if (Array.isArray(x)) return x.map(shape);
  if (x && typeof x === 'object') return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, shape(v)]));
  return typeof x;
}

function strings(x: unknown, out: string[] = []): string[] {
  if (typeof x === 'string') out.push(x);
  else if (Array.isArray(x)) x.forEach((v) => strings(v, out));
  else if (x && typeof x === 'object') Object.values(x).forEach((v) => strings(v, out));
  return out;
}

describe('dictionaries', () => {
  it('kk has exactly the keys and list lengths of ru', () => {
    expect(shape(kk)).toEqual(shape(ru));
  });

  it('has no empty strings', () => {
    for (const d of [ru, kk]) for (const s of strings(d)) expect(s.trim()).not.toBe('');
  });

  it('covers every error code, route, unit and score category', () => {
    for (const d of [ru, kk]) {
      expect(Object.keys(d.errors).sort()).toEqual([...ERROR_CODES].sort());
      expect(Object.keys(d.routes).sort()).toEqual([...ROUTE_IDS].sort());
      expect(Object.keys(d.units).sort()).toEqual([...UNIT_IDS].sort());
      expect(Object.keys(d.categories).sort()).toEqual([...CATEGORIES].sort());
    }
  });

  it('exposes both locales', () => {
    expect(dictionaries.ru).toBe(ru);
    expect(dictionaries.kk).toBe(kk);
    expect(isLocale('kk')).toBe(true);
    expect(isLocale('en')).toBe(false);
  });
});
```

- [ ] **Step 2: Запустить и убедиться, что тест падает**

Run: `npx vitest run lib/i18n/i18n.test.ts`
Expected: FAIL — `Failed to resolve import "./index"`.

- [ ] **Step 3: Создать `lib/i18n/ru.ts`**

```ts
import type { Category } from '../engine/grading';
import type { ErrorCode, RouteId, UnitId } from '../engine/types';

export const ru = {
  langName: 'Русский',
  appName: 'Pediatric Infusion Simulator',
  appSubtitle: 'Тренажёр программирования инфузомата для педиатрии',
  disclaimer: 'Учебный тренажёр. Не для клинического применения.',
  draftBadge: 'Черновик: не проверено преподавателем',
  common: {
    back: 'Назад',
    home: 'На главную',
    check: 'Проверить',
    loading: 'Загрузка…',
    language: 'Язык',
    soundOn: 'Звук: вкл.',
    soundOff: 'Звук: выкл.',
    exit: 'Выйти',
  },
  home: {
    start: 'Начать симуляцию',
    exam: 'Тестовый режим',
    learn: 'Обучение',
    results: 'Результаты',
    tagline: 'Выберите пациента, рассчитайте дозу, настройте инфузомат и отреагируйте на тревоги.',
  },
  modes: { learning: 'С подсказками', exam: 'Тестовый режим' },
  scenarios: { title: 'Выберите пациента' },
  nickname: {
    title: 'Как вас называть?',
    label: 'Ник',
    placeholder: 'Например, Айгерим',
    notice: 'Ник будет виден в общем рейтинге.',
    save: 'Сохранить',
    change: 'Сменить ник',
    errors: {
      length: 'От 2 до 20 символов',
      chars: 'Только буквы, цифры, пробел, _ и -',
      profanity: 'Выберите другой ник',
    },
  },
  patient: {
    title: 'Пациент',
    age: 'Возраст',
    weight: 'Масса',
    kg: 'кг',
    condition: 'Состояние',
    accesses: 'Установленные доступы',
    order: 'Назначение',
  },
  steps: {
    drug: 'Шаг 1. Выберите препарат',
    route: 'Шаг 2. Выберите путь введения',
    calc: 'Шаг 3. Расчёт',
    pump: 'Шаг 4. Настройте инфузомат',
    infusion: 'Инфузия',
    value: 'Число',
    unit: 'Единица',
    chooseUnit: '— единица —',
    needValue: 'Введите число и выберите единицу',
  },
  routes: {
    piv: 'Периферический венозный катетер (ПВК)',
    cvc: 'Центральный венозный катетер (ЦВК)',
    picc: 'PICC',
    io: 'Внутрикостный доступ',
  } satisfies Record<RouteId, string>,
  units: {
    mg: 'мг',
    g: 'г',
    ml: 'мл',
    ml_h: 'мл/ч',
    mg_kg: 'мг/кг',
    ml_kg: 'мл/кг',
    mg_ml: 'мг/мл',
  } satisfies Record<UnitId, string>,
  feedback: {
    correct: '✅ Правильно',
    wrong: '❌ Неверно. Попробуйте ещё раз.',
    reveal: 'Правильный ответ',
    hint: 'Подсказка',
  },
  pumpGuide: [
    '1. Нажмите POWER.',
    '2. ENTER — ввод RATE: ◀ ▶ выбирают разряд, + − меняют цифру, ENTER сохраняет.',
    '3. MENU — перейти к VTBI и ввести объём так же.',
    '4. Сверьте TIME с назначением и выполните двойную проверку.',
    '5. START — экран подтверждения, ещё раз START — запуск.',
  ],
  checklist: {
    title: 'Двойная проверка',
    items: [
      'Пациент: номер и возраст совпадают',
      'Препарат и концентрация',
      'Доза и объём',
      'Путь введения',
      'Скорость, VTBI и время',
    ],
  },
  blocked: {
    wrongRate: 'ОШИБКА НАСТРОЙКИ. Установленная скорость не соответствует назначению.',
    criticalRate: 'ОШИБКА НАСТРОЙКИ. Установленная скорость не соответствует назначению.',
    wrongVtbi: 'Объём (VTBI) не соответствует назначению.',
    startWithoutCheck: 'Сначала выполните двойную проверку.',
    expected: 'Назначено',
  },
  infusion: {
    speed: 'Скорость симуляции',
    realtime: 'Реальное время',
    normal: 'Обычно',
    fast: 'Быстро',
    alarmTitle: 'Тревога! Выберите действия',
    nextHint: 'Следующий шаг',
    restartHint: 'Нажмите START на насосе',
    complete: 'Инфузия завершена',
  },
  result: {
    title: 'Симуляция завершена',
    score: 'Баллы',
    passed: 'Сдано',
    failed: 'Не сдано',
    criticalNote: 'Есть критическая ошибка — станция не сдана при любых баллах.',
    errors: 'Ошибки',
    noErrors: 'Ошибок нет',
    time: 'Время',
    again: 'Пройти ещё раз',
    other: 'Другой сценарий',
    toResults: 'Рейтинг',
    sending: 'Отправляем результат…',
    sent: 'Результат в рейтинге',
    queued: 'Нет связи — результат отправится позже',
    rejected: 'Сервер не принял результат',
  },
  categories: {
    drug: 'Препарат',
    route: 'Путь введения',
    calc: 'Расчёт',
    rate: 'Скорость',
    vtbi: 'Объём (VTBI) и время',
    check: 'Двойная проверка',
    alarm: 'Тревога / без ошибок',
  } satisfies Record<Category, string>,
  errors: {
    wrongDrug: 'Неверный препарат',
    criticalDrug: 'Опасный препарат (критическая ошибка)',
    routeNotAvailable: 'Выбран доступ, которого нет у пациента',
    wrongRoute: 'Неверный путь введения',
    criticalRoute: 'Недопустимый путь введения (критическая ошибка)',
    wrongCalc: 'Ошибка в расчёте',
    wrongUnit: 'Неверные единицы измерения',
    wrongRate: 'Неверная скорость',
    criticalRate: 'Скорость отличается в 2 раза и более (критическая ошибка)',
    wrongVtbi: 'Неверный объём (VTBI)',
    ignoredLimitWarning: 'Проигнорировано предупреждение насоса',
    startWithoutCheck: 'Запуск без двойной проверки',
    wrongAlarmAction: 'Неверное действие при тревоге',
    restartWithoutFix: 'Перезапуск без устранения причины',
    stoppedNeedlessly: 'Инфузия остановлена без необходимости',
    batteryDepleted: 'Насос разрядился',
  } satisfies Record<ErrorCode, string>,
  results: {
    title: 'Результаты',
    mine: 'Мои прохождения',
    none: 'Пока нет прохождений',
    leaderboard: 'Рейтинг',
    today: 'Сегодня',
    allTime: 'Всё время',
    empty: 'Пока пусто',
    failedToLoad: 'Не удалось загрузить рейтинг',
    colNick: 'Ник',
    colScore: 'Баллы',
    colTime: 'Время',
    colScenario: 'Сценарий',
  },
  stand: {
    scan: 'Сканируйте QR-код и пройдите симуляцию',
    download: 'Скачать QR (PNG)',
  },
  admin: {
    title: 'Модерация',
    token: 'Ключ администратора',
    load: 'Загрузить',
    hide: 'Скрыть',
    hidden: 'Скрыто',
    unauthorized: 'Неверный ключ',
  },
  learn: {
    title: 'Обучение',
    cards: [
      {
        title: 'Кнопки инфузомата',
        lines: [
          'POWER — включение.',
          'MENU — выбор поля RATE / VTBI.',
          'ENTER — начать ввод и сохранить значение.',
          '◀ ▶ — выбор разряда; + − — изменить цифру.',
          'START — подтверждение и запуск; STOP — пауза или отмена.',
          'MUTE — выключить звук тревоги.',
        ],
      },
      {
        title: 'Расчёт дозы',
        lines: [
          'Доза (мг) = доза на кг (мг/кг) × масса (кг).',
          'Объём (мл) = доза (мг) ÷ концентрация (мг/мл).',
          'Пример: 15 мг/кг × 14 кг = 210 мг; 210 мг ÷ 10 мг/мл = 21 мл.',
        ],
      },
      {
        title: 'Скорость и время',
        lines: [
          'Скорость (мл/ч) = объём (мл) ÷ время (ч). 15 мин = 0,25 ч.',
          'Пример: 21 мл ÷ 0,25 ч = 84 мл/ч.',
          'Правило 4-2-1: 4 мл/кг/ч на первые 10 кг, 2 — на следующие 10 кг, 1 — на каждый кг сверх 20.',
          'GIR: скорость (мл/ч) = GIR × масса × 60 ÷ концентрация (мг/мл); глюкоза 20% = 200 мг/мл.',
        ],
      },
      {
        title: 'Тревоги',
        lines: [
          'OCCLUSION — насос остановлен: осмотрите линию от насоса до пациента, устраните перегиб или откройте зажим, затем START. Никогда не промывайте катетер с усилием.',
          'AIR IN LINE — перекройте зажим к пациенту, удалите воздух по инструкции насоса, откройте зажим, START.',
          'LOW BATTERY — насос ещё работает: подключите его к сети и не останавливайте инфузию.',
        ],
      },
    ],
  },
};

export type Dict = typeof ru;
```

- [ ] **Step 4: Создать `lib/i18n/kk.ts`** (тексты требуют вычитки носителем языка)

```ts
import type { Dict } from './ru';

export const kk: Dict = {
  langName: 'Қазақша',
  appName: 'Pediatric Infusion Simulator',
  appSubtitle: 'Педиатрияға арналған инфузоматты бағдарламалау тренажёры',
  disclaimer: 'Оқу тренажёры. Клиникалық қолдануға арналмаған.',
  draftBadge: 'Жоба: оқытушы тексермеген',
  common: {
    back: 'Артқа',
    home: 'Басты бетке',
    check: 'Тексеру',
    loading: 'Жүктелуде…',
    language: 'Тіл',
    soundOn: 'Дыбыс: қосулы',
    soundOff: 'Дыбыс: өшірулі',
    exit: 'Шығу',
  },
  home: {
    start: 'Симуляцияны бастау',
    exam: 'Тест режимі',
    learn: 'Оқыту',
    results: 'Нәтижелер',
    tagline: 'Науқасты таңдаңыз, дозаны есептеңіз, инфузоматты баптаңыз және дабылдарға әрекет етіңіз.',
  },
  modes: { learning: 'Кеңестермен', exam: 'Тест режимі' },
  scenarios: { title: 'Науқасты таңдаңыз' },
  nickname: {
    title: 'Сізді қалай атаймыз?',
    label: 'Лақап ат',
    placeholder: 'Мысалы, Айгерим',
    notice: 'Лақап атыңыз жалпы рейтингте көрінеді.',
    save: 'Сақтау',
    change: 'Лақап атты өзгерту',
    errors: {
      length: '2-ден 20 таңбаға дейін',
      chars: 'Тек әріптер, сандар, бос орын, _ және -',
      profanity: 'Басқа лақап ат таңдаңыз',
    },
  },
  patient: {
    title: 'Науқас',
    age: 'Жасы',
    weight: 'Салмағы',
    kg: 'кг',
    condition: 'Жағдайы',
    accesses: 'Орнатылған қол жеткізу жолдары',
    order: 'Тағайындау',
  },
  steps: {
    drug: '1-қадам. Дәріні таңдаңыз',
    route: '2-қадам. Енгізу жолын таңдаңыз',
    calc: '3-қадам. Есептеу',
    pump: '4-қадам. Инфузоматты баптаңыз',
    infusion: 'Инфузия',
    value: 'Сан',
    unit: 'Өлшем бірлігі',
    chooseUnit: '— өлшем бірлігі —',
    needValue: 'Санды енгізіп, өлшем бірлігін таңдаңыз',
  },
  routes: {
    piv: 'Перифериялық веналық катетер (ПВК)',
    cvc: 'Орталық веналық катетер (ЦВК)',
    picc: 'PICC',
    io: 'Сүйекішілік қол жеткізу',
  },
  units: {
    mg: 'мг',
    g: 'г',
    ml: 'мл',
    ml_h: 'мл/сағ',
    mg_kg: 'мг/кг',
    ml_kg: 'мл/кг',
    mg_ml: 'мг/мл',
  },
  feedback: {
    correct: '✅ Дұрыс',
    wrong: '❌ Қате. Қайталап көріңіз.',
    reveal: 'Дұрыс жауап',
    hint: 'Кеңес',
  },
  pumpGuide: [
    '1. POWER түймесін басыңыз.',
    '2. ENTER — RATE енгізу: ◀ ▶ разрядты таңдайды, + − цифрды өзгертеді, ENTER сақтайды.',
    '3. MENU — VTBI өрісіне өтіп, көлемді дәл солай енгізіңіз.',
    '4. TIME мәнін тағайындаумен салыстырып, қос тексеруді орындаңыз.',
    '5. START — растау экраны, қайта START — іске қосу.',
  ],
  checklist: {
    title: 'Қос тексеру',
    items: [
      'Науқас: нөмірі мен жасы сәйкес',
      'Дәрі және концентрациясы',
      'Доза және көлем',
      'Енгізу жолы',
      'Жылдамдық, VTBI және уақыт',
    ],
  },
  blocked: {
    wrongRate: 'БАПТАУ ҚАТЕСІ. Орнатылған жылдамдық тағайындауға сәйкес келмейді.',
    criticalRate: 'БАПТАУ ҚАТЕСІ. Орнатылған жылдамдық тағайындауға сәйкес келмейді.',
    wrongVtbi: 'Көлем (VTBI) тағайындауға сәйкес келмейді.',
    startWithoutCheck: 'Алдымен қос тексеруді орындаңыз.',
    expected: 'Тағайындалғаны',
  },
  infusion: {
    speed: 'Симуляция жылдамдығы',
    realtime: 'Нақты уақыт',
    normal: 'Қалыпты',
    fast: 'Жылдам',
    alarmTitle: 'Дабыл! Әрекеттерді таңдаңыз',
    nextHint: 'Келесі қадам',
    restartHint: 'Сорғыдағы START түймесін басыңыз',
    complete: 'Инфузия аяқталды',
  },
  result: {
    title: 'Симуляция аяқталды',
    score: 'Ұпай',
    passed: 'Тапсырылды',
    failed: 'Тапсырылмады',
    criticalNote: 'Сыни қате бар — ұпайға қарамастан станция тапсырылмады.',
    errors: 'Қателер',
    noErrors: 'Қате жоқ',
    time: 'Уақыт',
    again: 'Қайта өту',
    other: 'Басқа сценарий',
    toResults: 'Рейтинг',
    sending: 'Нәтиже жіберілуде…',
    sent: 'Нәтиже рейтингте',
    queued: 'Байланыс жоқ — нәтиже кейінірек жіберіледі',
    rejected: 'Сервер нәтижені қабылдамады',
  },
  categories: {
    drug: 'Дәрі',
    route: 'Енгізу жолы',
    calc: 'Есептеу',
    rate: 'Жылдамдық',
    vtbi: 'Көлем (VTBI) және уақыт',
    check: 'Қос тексеру',
    alarm: 'Дабыл / қатесіз',
  },
  errors: {
    wrongDrug: 'Қате дәрі',
    criticalDrug: 'Қауіпті дәрі (сыни қате)',
    routeNotAvailable: 'Науқаста жоқ қол жеткізу жолы таңдалды',
    wrongRoute: 'Қате енгізу жолы',
    criticalRoute: 'Рұқсат етілмеген енгізу жолы (сыни қате)',
    wrongCalc: 'Есептеудегі қате',
    wrongUnit: 'Қате өлшем бірлігі',
    wrongRate: 'Қате жылдамдық',
    criticalRate: 'Жылдамдық 2 есе және одан көп ерекшеленеді (сыни қате)',
    wrongVtbi: 'Қате көлем (VTBI)',
    ignoredLimitWarning: 'Сорғы ескертуі елеусіз қалды',
    startWithoutCheck: 'Қос тексерусіз іске қосу',
    wrongAlarmAction: 'Дабыл кезіндегі қате әрекет',
    restartWithoutFix: 'Себебін жоймай қайта іске қосу',
    stoppedNeedlessly: 'Инфузия қажетсіз тоқтатылды',
    batteryDepleted: 'Сорғының заряды бітті',
  },
  results: {
    title: 'Нәтижелер',
    mine: 'Менің өтулерім',
    none: 'Әзірге өту жоқ',
    leaderboard: 'Рейтинг',
    today: 'Бүгін',
    allTime: 'Барлық уақыт',
    empty: 'Әзірге бос',
    failedToLoad: 'Рейтингті жүктеу мүмкін болмады',
    colNick: 'Лақап ат',
    colScore: 'Ұпай',
    colTime: 'Уақыт',
    colScenario: 'Сценарий',
  },
  stand: {
    scan: 'QR-кодты сканерлеп, симуляциядан өтіңіз',
    download: 'QR жүктеу (PNG)',
  },
  admin: {
    title: 'Модерация',
    token: 'Әкімші кілті',
    load: 'Жүктеу',
    hide: 'Жасыру',
    hidden: 'Жасырылған',
    unauthorized: 'Кілт қате',
  },
  learn: {
    title: 'Оқыту',
    cards: [
      {
        title: 'Инфузомат түймелері',
        lines: [
          'POWER — қосу.',
          'MENU — RATE / VTBI өрісін таңдау.',
          'ENTER — енгізуді бастау және мәнді сақтау.',
          '◀ ▶ — разрядты таңдау; + − — цифрды өзгерту.',
          'START — растау және іске қосу; STOP — үзіліс немесе болдырмау.',
          'MUTE — дабыл дыбысын өшіру.',
        ],
      },
      {
        title: 'Дозаны есептеу',
        lines: [
          'Доза (мг) = 1 кг-ға доза (мг/кг) × салмақ (кг).',
          'Көлем (мл) = доза (мг) ÷ концентрация (мг/мл).',
          'Мысал: 15 мг/кг × 14 кг = 210 мг; 210 мг ÷ 10 мг/мл = 21 мл.',
        ],
      },
      {
        title: 'Жылдамдық және уақыт',
        lines: [
          'Жылдамдық (мл/сағ) = көлем (мл) ÷ уақыт (сағ). 15 мин = 0,25 сағ.',
          'Мысал: 21 мл ÷ 0,25 сағ = 84 мл/сағ.',
          '4-2-1 ережесі: алғашқы 10 кг-ға 4 мл/кг/сағ, келесі 10 кг-ға 2, 20 кг-нан асқан әр кг-ға 1.',
          'GIR: жылдамдық (мл/сағ) = GIR × салмақ × 60 ÷ концентрация (мг/мл); глюкоза 20% = 200 мг/мл.',
        ],
      },
      {
        title: 'Дабылдар',
        lines: [
          'OCCLUSION — сорғы тоқтады: сорғыдан науқасқа дейінгі желіні тексеріп, бүгілуді түзетіңіз немесе қысқышты ашыңыз, содан кейін START. Катетерді ешқашан күшпен жумаңыз.',
          'AIR IN LINE — науқасқа баратын қысқышты жабыңыз, ауаны сорғы нұсқаулығы бойынша шығарыңыз, қысқышты ашыңыз, START.',
          'LOW BATTERY — сорғы әлі жұмыс істейді: оны желіге қосыңыз және инфузияны тоқтатпаңыз.',
        ],
      },
    ],
  },
};
```

- [ ] **Step 5: Создать `lib/i18n/index.ts`**

```ts
import type { Locale } from '../engine/types';
import { kk } from './kk';
import { ru, type Dict } from './ru';

export type { Dict };

export const dictionaries: Record<Locale, Dict> = { ru, kk };

export const DEFAULT_LOCALE: Locale = 'ru';

export const isLocale = (x: unknown): x is Locale => x === 'ru' || x === 'kk';
```

- [ ] **Step 6: Запустить тесты**

Run: `npx vitest run lib/i18n`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add lib/i18n
git commit -m "feat(i18n): add Russian and Kazakh dictionaries" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 8: Клиентские утилиты (`lib/client`)

**Files:**
- Create: `lib/client/storage.ts`, `lib/client/history.ts`, `lib/client/outbox.ts`, `lib/client/shuffle.ts`, `lib/client/sound.ts`
- Test: `lib/client/client.test.ts`

**Interfaces:**
- Consumes: `Locale`, `Mode`, `SimEvent` из `../engine/types`.
- Produces:
  - storage.ts: `interface KV { get(key): string | null; set(key, value): void }`, `localKV: KV` (localStorage в `try/catch`), `memoryKV(): KV`, `readJson<T>(kv, key, fallback)`, `writeJson(kv, key, value)`, `KEYS = { nickname: 'pis.nickname', locale: 'pis.locale', sound: 'pis.sound', history: 'pis.history', outbox: 'pis.outbox' }`.
  - history.ts: `interface HistoryItem { id; scenarioId; mode: Mode; score; passed; durationSec; createdAt: string }`, `HISTORY_LIMIT = 50`, `readHistory(kv)`, `addHistory(kv, item)`.
  - outbox.ts: `interface ResultPayload { id; nickname; scenarioId; mode: Mode; locale: Locale; appVersion; events: SimEvent[] }`, `type Sender = (p: ResultPayload) => Promise<{ status: number }>`, `type FlushOutcome = 'sent' | 'queued' | 'rejected'`, `createOutbox(kv, send) → { pending(), enqueue(p), flush(): Promise<Record<string, FlushOutcome>> }`, `type Outbox`, `postResult: Sender`, `browserOutbox: Outbox`.
  - shuffle.ts: `seededShuffle<T>(items, seed: string): T[]`.
  - sound.ts: `unlockAudio()`, `beep(frequency?, durationMs?)`, `startAlarmSound()`, `stopAlarmSound()`.

- [ ] **Step 1: Написать падающие тесты `lib/client/client.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { addHistory, HISTORY_LIMIT, readHistory, type HistoryItem } from './history';
import { createOutbox, type ResultPayload } from './outbox';
import { seededShuffle } from './shuffle';
import { KEYS, memoryKV, readJson } from './storage';

const payload = (id: string): ResultPayload => ({
  id,
  nickname: 'Тест',
  scenarioId: 's1-paracetamol',
  mode: 'learning',
  locale: 'ru',
  appVersion: '1.0.0',
  events: [],
});

describe('storage', () => {
  it('falls back on missing or broken JSON', () => {
    const kv = memoryKV();
    expect(readJson(kv, 'x', 42)).toBe(42);
    kv.set('x', '{broken');
    expect(readJson(kv, 'x', 42)).toBe(42);
  });
});

describe('history', () => {
  const item = (id: string): HistoryItem => ({
    id, scenarioId: 's1-paracetamol', mode: 'exam', score: 90, passed: true, durationSec: 120, createdAt: '2026-10-08T10:00:00Z',
  });

  it('keeps the newest first, without duplicates, up to the limit', () => {
    const kv = memoryKV();
    for (let i = 0; i < HISTORY_LIMIT + 5; i++) addHistory(kv, item(`a${i}`));
    addHistory(kv, item('a54'));
    const list = readHistory(kv);
    expect(list).toHaveLength(HISTORY_LIMIT);
    expect(list[0].id).toBe('a54');
    expect(list.filter((h) => h.id === 'a54')).toHaveLength(1);
  });
});

describe('outbox', () => {
  it('deduplicates by id', () => {
    const outbox = createOutbox(memoryKV(), async () => ({ status: 201 }));
    outbox.enqueue(payload('a'));
    outbox.enqueue(payload('a'));
    expect(outbox.pending()).toHaveLength(1);
  });

  it('drops sent and rejected results, keeps the rest for later', async () => {
    const statuses: Record<string, number | 'throw'> = { ok: 201, dup: 200, bad: 400, down: 503, offline: 'throw' };
    const kv = memoryKV();
    const outbox = createOutbox(kv, async (p) => {
      const s = statuses[p.id];
      if (s === 'throw') throw new TypeError('Failed to fetch');
      return { status: s };
    });
    Object.keys(statuses).forEach((id) => outbox.enqueue(payload(id)));
    const outcomes = await outbox.flush();
    expect(outcomes).toEqual({ ok: 'sent', dup: 'sent', bad: 'rejected', down: 'queued', offline: 'queued' });
    expect(outbox.pending().map((p) => p.id)).toEqual(['down', 'offline']);
    expect(readJson(kv, KEYS.outbox, [])).toHaveLength(2);
  });

  it('keeps results queued while a flush is running', async () => {
    const kv = memoryKV();
    let release: () => void = () => {};
    const outbox = createOutbox(kv, () => new Promise((resolve) => { release = () => resolve({ status: 201 }); }));
    outbox.enqueue(payload('first'));
    const flushing = outbox.flush();
    outbox.enqueue(payload('second'));
    release();
    await flushing;
    expect(outbox.pending().map((p) => p.id)).toEqual(['second']);
  });
});

describe('seededShuffle', () => {
  const items = ['a', 'b', 'c', 'd', 'e', 'f'];

  it('is a deterministic permutation', () => {
    const once = seededShuffle(items, 's1-paracetamol');
    expect(seededShuffle(items, 's1-paracetamol')).toEqual(once);
    expect([...once].sort()).toEqual(items);
    expect(items).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
  });

  it('depends on the seed', () => {
    const orders = ['a', 'b', 'c'].map((seed) => seededShuffle(items, seed).join(''));
    expect(new Set(orders).size).toBeGreaterThan(1);
  });
});
```

- [ ] **Step 2: Запустить и убедиться, что тесты падают**

Run: `npx vitest run lib/client`
Expected: FAIL — `Failed to resolve import "./history"`.

- [ ] **Step 3: Создать `lib/client/storage.ts`**

```ts
export interface KV {
  get(key: string): string | null;
  set(key: string, value: string): void;
}

/** localStorage may be missing or throw (private mode, blocked site data); the app then just forgets. */
export const localKV: KV = {
  get(key) {
    try {
      return globalThis.localStorage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      globalThis.localStorage?.setItem(key, value);
    } catch {
      // storage unavailable
    }
  },
};

export function memoryKV(): KV {
  const map = new Map<string, string>();
  return { get: (key) => map.get(key) ?? null, set: (key, value) => void map.set(key, value) };
}

export function readJson<T>(kv: KV, key: string, fallback: T): T {
  const raw = kv.get(key);
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeJson(kv: KV, key: string, value: unknown): void {
  kv.set(key, JSON.stringify(value));
}

export const KEYS = {
  nickname: 'pis.nickname',
  locale: 'pis.locale',
  sound: 'pis.sound',
  history: 'pis.history',
  outbox: 'pis.outbox',
} as const;
```

- [ ] **Step 4: Создать `lib/client/history.ts`**

```ts
import type { Mode } from '../engine/types';
import { KEYS, readJson, writeJson, type KV } from './storage';

export interface HistoryItem {
  id: string;
  scenarioId: string;
  mode: Mode;
  score: number;
  passed: boolean;
  durationSec: number;
  createdAt: string;
}

export const HISTORY_LIMIT = 50;

export function readHistory(kv: KV): HistoryItem[] {
  const list = readJson<unknown>(kv, KEYS.history, []);
  return Array.isArray(list) ? (list as HistoryItem[]) : [];
}

export function addHistory(kv: KV, item: HistoryItem): HistoryItem[] {
  const list = [item, ...readHistory(kv).filter((h) => h.id !== item.id)].slice(0, HISTORY_LIMIT);
  writeJson(kv, KEYS.history, list);
  return list;
}
```

- [ ] **Step 5: Создать `lib/client/outbox.ts`**

```ts
import type { Locale, Mode, SimEvent } from '../engine/types';
import { KEYS, localKV, readJson, writeJson, type KV } from './storage';

export interface ResultPayload {
  id: string;
  nickname: string;
  scenarioId: string;
  mode: Mode;
  locale: Locale;
  appVersion: string;
  events: SimEvent[];
}

export type Sender = (payload: ResultPayload) => Promise<{ status: number }>;
export type FlushOutcome = 'sent' | 'queued' | 'rejected';

export function createOutbox(kv: KV, send: Sender) {
  const read = (): ResultPayload[] => {
    const list = readJson<unknown>(kv, KEYS.outbox, []);
    return Array.isArray(list) ? (list as ResultPayload[]) : [];
  };

  return {
    pending: read,

    enqueue(payload: ResultPayload): void {
      const list = read();
      if (!list.some((p) => p.id === payload.id)) writeJson(kv, KEYS.outbox, [...list, payload]);
    },

    /** Sends every queued result: 2xx → sent, 4xx → rejected (dropped), 5xx or network error → stays queued. */
    async flush(): Promise<Record<string, FlushOutcome>> {
      const outcomes: Record<string, FlushOutcome> = {};
      for (const payload of read()) {
        try {
          const { status } = await send(payload);
          outcomes[payload.id] = status >= 500 ? 'queued' : status >= 400 ? 'rejected' : 'sent';
        } catch {
          outcomes[payload.id] = 'queued';
        }
      }
      const finished = new Set(Object.keys(outcomes).filter((id) => outcomes[id] !== 'queued'));
      writeJson(kv, KEYS.outbox, read().filter((p) => !finished.has(p.id)));
      return outcomes;
    },
  };
}

export type Outbox = ReturnType<typeof createOutbox>;

export const postResult: Sender = async (payload) => {
  const res = await fetch('/api/results', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return { status: res.status };
};

export const browserOutbox: Outbox = createOutbox(localKV, postResult);
```

- [ ] **Step 6: Создать `lib/client/shuffle.ts`**

```ts
/** Deterministic Fisher–Yates shuffle seeded by a string, so server and client render the same order. */
export function seededShuffle<T>(items: readonly T[], seed: string): T[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const next = (): number => {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    return (h >>> 0) / 4294967296;
  };
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
```

- [ ] **Step 7: Создать `lib/client/sound.ts`** (браузерный API, без тестов)

```ts
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
```

- [ ] **Step 8: Запустить тесты**

Run: `npx vitest run lib/client`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add lib/client
git commit -m "feat(client): add storage, history, result outbox, shuffle and alarm sound" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 9: Серверная логика (`lib/nickname.ts`, `lib/server`)

**Files:**
- Create: `lib/nickname.ts`, `lib/server/payload.ts`, `lib/server/repo.ts`, `lib/server/memory-repo.ts`, `lib/server/admin-auth.ts`, `lib/server/results-service.ts`
- Test: `lib/server/server.test.ts`

**Interfaces:**
- Consumes: `replay`, `ReplayError` (Task 5), `gradeSession`, `Breakdown` (Task 6), `getScenario` (Task 4), `perfectEvents`, `setupInputs`, `startInputs`, `stamp` (тесты), типы и перечисления из `../engine/types`.
- Produces:
  - nickname.ts: `type NicknameCheck = { ok: true; value: string } | { ok: false; reason: 'length' | 'chars' | 'profanity' }`, `validateNickname(raw): NicknameCheck`.
  - payload.ts: `eventSchema`, `resultPayloadSchema`, `MAX_EVENTS = 1000`.
  - repo.ts: `NewResult`, `StoredResult` (`+ hidden, createdAt`), `LeaderboardRow { nickname; score; passed; durationSec; scenarioId; createdAt }`, `LeaderboardQuery { mode; since: string | null; scenarioId: string | null; limit }`, `interface ResultsRepo { insert(r): Promise<{ created: boolean; result: StoredResult }>; leaderboard(q): Promise<LeaderboardRow[]>; recent(limit): Promise<StoredResult[]>; hide(id): Promise<boolean> }`, `compareForBoard(a, b)`.
  - memory-repo.ts: `createMemoryRepo(now?: () => Date): ResultsRepo`.
  - admin-auth.ts: `isAuthorizedAdmin(authorizationHeader: string | null, token: string | undefined): boolean`.
  - results-service.ts: `interface ServiceResponse { status: number; body: unknown }`, `submitResult(body, repo)`, `getLeaderboard(params: URLSearchParams, repo)`, `listRecent(authHeader, token, limitRaw, repo)`, `hideResult(authHeader, token, body, repo)`, `LEADERBOARD_LIMIT = 20`.

- [ ] **Step 1: Написать падающие тесты `lib/server/server.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { perfectEvents, setupInputs, stamp, startInputs } from '../engine/testing';
import { validateNickname } from '../nickname';
import { getScenario } from '../scenarios';
import { isAuthorizedAdmin } from './admin-auth';
import { createMemoryRepo } from './memory-repo';
import type { NewResult } from './repo';
import { getLeaderboard, hideResult, listRecent, submitResult } from './results-service';

const s1 = getScenario('s1-paracetamol')!;
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const body = (overrides: Record<string, unknown> = {}) => ({
  id: uuid(1),
  nickname: 'Айгерим',
  scenarioId: 's1-paracetamol',
  mode: 'exam',
  locale: 'ru',
  appVersion: '1.0.0',
  events: perfectEvents(s1),
  ...overrides,
});
const zero = { drug: 0, route: 0, calc: 0, rate: 0, vtbi: 0, check: 0, alarm: 0 };
const result = (
  n: number, nickname: string, score: number, passed: boolean, durationSec: number,
  mode: 'exam' | 'learning' = 'exam', scenarioId = 's1-paracetamol',
): NewResult => ({
  id: uuid(n), nickname, scenarioId, mode, score, passed, breakdown: zero, errors: [], events: [],
  durationSec, locale: 'ru', appVersion: '1.0.0',
});

describe('validateNickname', () => {
  it('accepts letters of any alphabet, digits, space, _ and -', () => {
    expect(validateNickname('Айгерим')).toEqual({ ok: true, value: 'Айгерим' });
    expect(validateNickname('  Ұлдана   Б  ')).toEqual({ ok: true, value: 'Ұлдана Б' });
    expect(validateNickname('Dias_2026-x')).toEqual({ ok: true, value: 'Dias_2026-x' });
  });

  it('rejects bad length, symbols and profanity', () => {
    expect(validateNickname('A')).toEqual({ ok: false, reason: 'length' });
    expect(validateNickname('x'.repeat(21))).toEqual({ ok: false, reason: 'length' });
    expect(validateNickname('<script>')).toEqual({ ok: false, reason: 'chars' });
    expect(validateNickname('🙂🙂')).toEqual({ ok: false, reason: 'chars' });
    expect(validateNickname('f_u_c_k')).toEqual({ ok: false, reason: 'profanity' });
  });
});

describe('submitResult', () => {
  it('replays the log, stores the result and answers 201', async () => {
    const repo = createMemoryRepo();
    const res = await submitResult(body(), repo);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ id: uuid(1), score: 100, passed: true, errors: [] });
    expect(await repo.recent(10)).toHaveLength(1);
  });

  it('is idempotent for the same id', async () => {
    const repo = createMemoryRepo();
    await submitResult(body(), repo);
    const again = await submitResult(body(), repo);
    expect(again.status).toBe(200);
    expect(await repo.recent(10)).toHaveLength(1);
  });

  it('ignores any score sent by the client', async () => {
    const res = await submitResult(body({ score: 0, passed: false }), createMemoryRepo());
    expect(res.body).toMatchObject({ score: 100, passed: true });
  });

  it('computes the score from the actions', async () => {
    const events = stamp([...setupInputs(s1), ...startInputs(s1, { rateTenths: 850, checklist: false }), { type: 'infusionCompleted' }]);
    const res = await submitResult(body({ events }), createMemoryRepo());
    expect(res.body).toMatchObject({ score: 60, passed: true });
  });

  it('rejects malformed payloads, nicknames and scenarios with 400', async () => {
    const repo = createMemoryRepo();
    expect((await submitResult({ ...body(), events: undefined }, repo)).status).toBe(400);
    expect((await submitResult(body({ id: 'not-a-uuid' }), repo)).status).toBe(400);
    expect(await submitResult(body({ nickname: 'Fuck' }), repo)).toEqual({
      status: 400,
      body: { error: 'invalid_nickname', reason: 'profanity' },
    });
    expect((await submitResult(body({ scenarioId: 's9-nope' }), repo)).body).toEqual({ error: 'unknown_scenario' });
  });

  it('rejects impossible or unfinished logs with 422', async () => {
    const repo = createMemoryRepo();
    const impossible = stamp([...setupInputs(s1), ...startInputs(s1), { type: 'alarmRaised', alarm: 'occlusion' }]);
    expect(await submitResult(body({ events: impossible }), repo)).toMatchObject({
      status: 422,
      body: { error: 'invalid_log' },
    });
    const unfinished = stamp(setupInputs(s1));
    expect(await submitResult(body({ events: unfinished }), repo)).toEqual({ status: 422, body: { error: 'not_finished' } });
    expect(await repo.recent(10)).toHaveLength(0);
  });
});

describe('getLeaderboard', () => {
  it('validates the query', async () => {
    const repo = createMemoryRepo();
    expect((await getLeaderboard(new URLSearchParams('mode=other'), repo)).status).toBe(400);
    expect((await getLeaderboard(new URLSearchParams('mode=exam&since=yesterday'), repo)).status).toBe(400);
    expect((await getLeaderboard(new URLSearchParams('mode=exam&scenario=zzz'), repo)).status).toBe(400);
  });

  it('keeps the best result per nickname and sorts passed, score, time', async () => {
    const repo = createMemoryRepo();
    await repo.insert(result(1, 'Aru', 90, true, 100));
    await repo.insert(result(2, 'aru', 95, true, 120));
    await repo.insert(result(3, 'Bek', 100, false, 50));
    await repo.insert(result(4, 'Dana', 95, true, 90));
    await repo.insert(result(5, 'Erlan', 80, true, 60, 'learning'));
    const res = await getLeaderboard(new URLSearchParams('mode=exam'), repo);
    const rows = (res.body as { rows: Array<{ nickname: string; score: number }> }).rows;
    expect(rows.map((r) => [r.nickname, r.score])).toEqual([['Dana', 95], ['aru', 95], ['Bek', 100]]);
  });

  it('filters by time and scenario and leaves hidden results out', async () => {
    let clock = new Date('2026-10-07T12:00:00Z');
    const repo = createMemoryRepo(() => clock);
    await repo.insert(result(1, 'Old', 99, true, 60));
    clock = new Date('2026-10-08T09:00:00Z');
    await repo.insert(result(2, 'Today', 70, true, 60));
    await repo.insert(result(3, 'Other', 80, true, 60, 'exam', 's2-ceftriaxone'));
    await repo.insert(result(4, 'Rude', 100, true, 10));
    await repo.hide(uuid(4));
    const nicks = async (q: string) =>
      ((await getLeaderboard(new URLSearchParams(q), repo)).body as { rows: Array<{ nickname: string }> }).rows.map(
        (r) => r.nickname,
      );
    expect(await nicks('mode=exam')).toEqual(['Old', 'Other', 'Today']);
    expect(await nicks('mode=exam&since=2026-10-08T00:00:00.000Z')).toEqual(['Other', 'Today']);
    expect(await nicks('mode=exam&scenario=s1-paracetamol')).toEqual(['Old', 'Today']);
  });
});

describe('admin', () => {
  it('checks the bearer token', () => {
    expect(isAuthorizedAdmin('Bearer secret', 'secret')).toBe(true);
    expect(isAuthorizedAdmin('Bearer secreT', 'secret')).toBe(false);
    expect(isAuthorizedAdmin('secret', 'secret')).toBe(false);
    expect(isAuthorizedAdmin(null, 'secret')).toBe(false);
    expect(isAuthorizedAdmin('Bearer ', undefined)).toBe(false);
  });

  it('lists recent results without events and hides one', async () => {
    const repo = createMemoryRepo();
    await submitResult(body(), repo);
    expect((await listRecent(null, 'secret', null, repo)).status).toBe(401);
    const list = await listRecent('Bearer secret', 'secret', '10', repo);
    expect(list.status).toBe(200);
    const rows = (list.body as { rows: Array<Record<string, unknown>> }).rows;
    expect(rows).toHaveLength(1);
    expect(rows[0]).not.toHaveProperty('events');

    expect((await hideResult('Bearer wrong', 'secret', { id: uuid(1) }, repo)).status).toBe(401);
    expect((await hideResult('Bearer secret', 'secret', { id: uuid(9) }, repo)).status).toBe(404);
    expect(await hideResult('Bearer secret', 'secret', { id: uuid(1) }, repo)).toEqual({
      status: 200,
      body: { id: uuid(1), hidden: true },
    });
    const board = await getLeaderboard(new URLSearchParams('mode=exam'), repo);
    expect((board.body as { rows: unknown[] }).rows).toEqual([]);
  });
});
```

- [ ] **Step 2: Запустить и убедиться, что тесты падают**

Run: `npx vitest run lib/server`
Expected: FAIL — `Failed to resolve import "../nickname"`.

- [ ] **Step 3: Создать `lib/nickname.ts`**

```ts
export type NicknameCheck = { ok: true; value: string } | { ok: false; reason: 'length' | 'chars' | 'profanity' };

/** Substrings checked after lowercasing and removing spaces, "_" and "-". Moderation on /admin covers the rest. */
const BLOCKED = [
  'хуй', 'хуе', 'хуё', 'пизд', 'ебат', 'ебан', 'ёбан', 'еблан', 'бля', 'сука', 'мудак', 'мудил',
  'пидор', 'пидар', 'гандон', 'залуп', 'шлюх',
  'fuck', 'shit', 'bitch', 'cunt', 'whore', 'slut', 'nigger', 'nigga',
  'сігей', 'сігіп', 'қотақ',
];

export function validateNickname(raw: string): NicknameCheck {
  const value = raw.normalize('NFC').trim().replace(/\s+/g, ' ');
  const length = [...value].length;
  if (length < 2 || length > 20) return { ok: false, reason: 'length' };
  if (!/^[\p{L}\p{N} _-]+$/u.test(value)) return { ok: false, reason: 'chars' };
  const squashed = value.toLowerCase().replace(/[\s_-]/g, '');
  if (BLOCKED.some((word) => squashed.includes(word))) return { ok: false, reason: 'profanity' };
  return { ok: true, value };
}
```

- [ ] **Step 4: Создать `lib/server/payload.ts`**

```ts
import { z } from 'zod';
import { ALARM_TYPES, LOCALES, MODES, PUMP_BUTTONS, ROUTE_IDS, UNIT_IDS } from '../engine/types';

const MAX_T = 2 * 60 * 60 * 1000;
const t = z.number().int().min(0).max(MAX_T);
const ref = z.string().min(1).max(64);

export const eventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('drugSelected'), optionId: ref, t }),
  z.object({ type: z.literal('routeSelected'), routeId: z.enum(ROUTE_IDS), t }),
  z.object({ type: z.literal('calcAnswered'), stepId: ref, value: z.number(), unit: z.enum(UNIT_IDS), t }),
  z.object({ type: z.literal('pumpButton'), button: z.enum(PUMP_BUTTONS), t }),
  z.object({ type: z.literal('checklistCompleted'), t }),
  z.object({ type: z.literal('alarmRaised'), alarm: z.enum(ALARM_TYPES), t }),
  z.object({ type: z.literal('batteryDepleted'), t }),
  z.object({ type: z.literal('alarmAction'), actionId: ref, t }),
  z.object({ type: z.literal('infusionCompleted'), t }),
]);

export const MAX_EVENTS = 1000;

export const resultPayloadSchema = z.object({
  id: z.uuid(),
  nickname: z.string().max(100),
  scenarioId: ref,
  mode: z.enum(MODES),
  locale: z.enum(LOCALES),
  appVersion: z.string().min(1).max(32),
  events: z.array(eventSchema).min(1).max(MAX_EVENTS),
});
```

- [ ] **Step 5: Создать `lib/server/repo.ts`**

```ts
import type { Breakdown } from '../engine/grading';
import type { Locale, Mode, SimError, SimEvent } from '../engine/types';

export interface NewResult {
  id: string;
  nickname: string;
  scenarioId: string;
  mode: Mode;
  score: number;
  passed: boolean;
  breakdown: Breakdown;
  errors: SimError[];
  events: SimEvent[];
  durationSec: number;
  locale: Locale;
  appVersion: string;
}

export interface StoredResult extends NewResult {
  hidden: boolean;
  createdAt: string;
}

export interface LeaderboardRow {
  nickname: string;
  score: number;
  passed: boolean;
  durationSec: number;
  scenarioId: string;
  createdAt: string;
}

export interface LeaderboardQuery {
  mode: Mode;
  since: string | null;
  scenarioId: string | null;
  limit: number;
}

export interface ResultsRepo {
  insert(result: NewResult): Promise<{ created: boolean; result: StoredResult }>;
  leaderboard(query: LeaderboardQuery): Promise<LeaderboardRow[]>;
  recent(limit: number): Promise<StoredResult[]>;
  hide(id: string): Promise<boolean>;
}

/** Passed first, then higher score, shorter time, earlier attempt. */
export function compareForBoard(a: LeaderboardRow, b: LeaderboardRow): number {
  return (
    Number(b.passed) - Number(a.passed) ||
    b.score - a.score ||
    a.durationSec - b.durationSec ||
    a.createdAt.localeCompare(b.createdAt)
  );
}
```

- [ ] **Step 6: Создать `lib/server/memory-repo.ts`**

```ts
import { compareForBoard, type LeaderboardRow, type ResultsRepo, type StoredResult } from './repo';

/** In-memory store for local development and the e2e test. Data is lost on restart. */
export function createMemoryRepo(now: () => Date = () => new Date()): ResultsRepo {
  const rows = new Map<string, StoredResult>();

  return {
    async insert(result) {
      const existing = rows.get(result.id);
      if (existing) return { created: false, result: existing };
      const stored: StoredResult = { ...result, hidden: false, createdAt: now().toISOString() };
      rows.set(result.id, stored);
      return { created: true, result: stored };
    },

    async leaderboard({ mode, since, scenarioId, limit }) {
      const best = new Map<string, LeaderboardRow>();
      for (const r of rows.values()) {
        if (r.mode !== mode || r.hidden) continue;
        if (since && r.createdAt < since) continue;
        if (scenarioId && r.scenarioId !== scenarioId) continue;
        const row: LeaderboardRow = {
          nickname: r.nickname,
          score: r.score,
          passed: r.passed,
          durationSec: r.durationSec,
          scenarioId: r.scenarioId,
          createdAt: r.createdAt,
        };
        const key = r.nickname.toLowerCase();
        const current = best.get(key);
        if (!current || compareForBoard(row, current) < 0) best.set(key, row);
      }
      return [...best.values()].sort(compareForBoard).slice(0, limit);
    },

    async recent(limit) {
      return [...rows.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
    },

    async hide(id) {
      const r = rows.get(id);
      if (!r) return false;
      rows.set(id, { ...r, hidden: true });
      return true;
    },
  };
}
```

- [ ] **Step 7: Создать `lib/server/admin-auth.ts`**

```ts
import { timingSafeEqual } from 'node:crypto';

const PREFIX = 'Bearer ';

export function isAuthorizedAdmin(authorizationHeader: string | null, token: string | undefined): boolean {
  if (!token || !authorizationHeader?.startsWith(PREFIX)) return false;
  const given = Buffer.from(authorizationHeader.slice(PREFIX.length));
  const expected = Buffer.from(token);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
```

- [ ] **Step 8: Создать `lib/server/results-service.ts`**

```ts
import { z } from 'zod';
import { gradeSession, type Grade } from '../engine/grading';
import { replay, ReplayError } from '../engine/session';
import { MODES, type Mode, type SimEvent } from '../engine/types';
import { validateNickname } from '../nickname';
import { getScenario } from '../scenarios';
import { isAuthorizedAdmin } from './admin-auth';
import { resultPayloadSchema } from './payload';
import type { ResultsRepo } from './repo';

export interface ServiceResponse {
  status: number;
  body: unknown;
}

export const LEADERBOARD_LIMIT = 20;

export async function submitResult(body: unknown, repo: ResultsRepo): Promise<ServiceResponse> {
  const parsed = resultPayloadSchema.safeParse(body);
  if (!parsed.success) return { status: 400, body: { error: 'invalid_payload' } };
  const p = parsed.data;
  const nickname = validateNickname(p.nickname);
  if (!nickname.ok) return { status: 400, body: { error: 'invalid_nickname', reason: nickname.reason } };
  const scenario = getScenario(p.scenarioId);
  if (!scenario) return { status: 400, body: { error: 'unknown_scenario' } };
  const events = p.events as SimEvent[];

  let grade: Grade;
  try {
    const session = replay(scenario, p.mode, events);
    if (!session.finished) return { status: 422, body: { error: 'not_finished' } };
    grade = gradeSession(session);
  } catch (e) {
    if (e instanceof ReplayError) return { status: 422, body: { error: 'invalid_log', detail: e.message } };
    throw e;
  }

  const { created, result } = await repo.insert({
    id: p.id,
    nickname: nickname.value,
    scenarioId: scenario.id,
    mode: p.mode,
    score: grade.score,
    passed: grade.passed,
    breakdown: grade.breakdown,
    errors: grade.errors,
    events,
    durationSec: grade.durationSec,
    locale: p.locale,
    appVersion: p.appVersion,
  });
  return {
    status: created ? 201 : 200,
    body: { id: result.id, score: result.score, passed: result.passed, breakdown: result.breakdown, errors: result.errors },
  };
}

export async function getLeaderboard(params: URLSearchParams, repo: ResultsRepo): Promise<ServiceResponse> {
  const mode = params.get('mode');
  if (!MODES.includes(mode as Mode)) return { status: 400, body: { error: 'invalid_mode' } };

  const sinceRaw = params.get('since');
  let since: string | null = null;
  if (sinceRaw) {
    const date = new Date(sinceRaw);
    if (Number.isNaN(date.getTime())) return { status: 400, body: { error: 'invalid_since' } };
    since = date.toISOString();
  }

  const scenarioId = params.get('scenario');
  if (scenarioId && !getScenario(scenarioId)) return { status: 400, body: { error: 'unknown_scenario' } };

  const rows = await repo.leaderboard({
    mode: mode as Mode,
    since,
    scenarioId: scenarioId || null,
    limit: LEADERBOARD_LIMIT,
  });
  return { status: 200, body: { rows } };
}

export async function listRecent(
  authHeader: string | null,
  token: string | undefined,
  limitRaw: string | null,
  repo: ResultsRepo,
): Promise<ServiceResponse> {
  if (!isAuthorizedAdmin(authHeader, token)) return { status: 401, body: { error: 'unauthorized' } };
  const limit = Math.min(Math.max(Math.trunc(Number(limitRaw)) || 50, 1), 200);
  const rows = await repo.recent(limit);
  return { status: 200, body: { rows: rows.map(({ events: _events, ...rest }) => rest) } };
}

const hideSchema = z.object({ id: z.uuid() });

export async function hideResult(
  authHeader: string | null,
  token: string | undefined,
  body: unknown,
  repo: ResultsRepo,
): Promise<ServiceResponse> {
  if (!isAuthorizedAdmin(authHeader, token)) return { status: 401, body: { error: 'unauthorized' } };
  const parsed = hideSchema.safeParse(body);
  if (!parsed.success) return { status: 400, body: { error: 'invalid_payload' } };
  const hidden = await repo.hide(parsed.data.id);
  return hidden
    ? { status: 200, body: { id: parsed.data.id, hidden: true } }
    : { status: 404, body: { error: 'not_found' } };
}
```

- [ ] **Step 9: Запустить тесты**

Run: `npx vitest run lib`
Expected: PASS (все наборы).

- [ ] **Step 10: Commit**

```bash
git add lib/nickname.ts lib/server
git commit -m "feat(server): validate, replay and store results; leaderboard and moderation services" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 10: Postgres, API-маршруты и миграция

**Files:**
- Create: `lib/server/postgres-repo.ts`, `lib/server/get-repo.ts`
- Create: `app/api/results/route.ts`, `app/api/leaderboard/route.ts`, `app/api/admin/results/route.ts`, `app/api/admin/hide/route.ts`
- Create: `db/schema.sql`, `scripts/migrate.mjs`
- Test: `app/api/api.test.ts`

**Interfaces:**
- Consumes: `ResultsRepo`, `NewResult`, `StoredResult`, `LeaderboardRow` (Task 9), `createMemoryRepo`, `submitResult`, `getLeaderboard`, `listRecent`, `hideResult` (Task 9).
- Produces: `createPostgresRepo(databaseUrl): ResultsRepo`, `getRepo(): ResultsRepo` (одиночка на `globalThis`, чтобы все маршруты в процессе делили одно хранилище), `setRepoForTests(repo | null)`; HTTP: `POST /api/results`, `GET /api/leaderboard?mode=&since=&scenario=` → `{ rows: LeaderboardRow[] }`, `GET /api/admin/results?limit=` → `{ rows }`, `POST /api/admin/hide { id }`; `npm run db:migrate`.

- [ ] **Step 1: Написать падающий тест `app/api/api.test.ts`**

```ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { perfectEvents } from '@/lib/engine/testing';
import { getScenario } from '@/lib/scenarios';
import { createMemoryRepo } from '@/lib/server/memory-repo';
import { setRepoForTests } from '@/lib/server/get-repo';
import { POST as hide } from './admin/hide/route';
import { GET as recent } from './admin/results/route';
import { GET as leaderboard } from './leaderboard/route';
import { POST as submit } from './results/route';

const id = '00000000-0000-4000-8000-000000000001';
const payload = {
  id,
  nickname: 'Айгерим',
  scenarioId: 's1-paracetamol',
  mode: 'learning',
  locale: 'ru',
  appVersion: '1.0.0',
  events: perfectEvents(getScenario('s1-paracetamol')!),
};
const post = (url: string, body: string, headers: Record<string, string> = {}) =>
  new Request(url, { method: 'POST', body, headers: { 'Content-Type': 'application/json', ...headers } });

describe('API routes', () => {
  beforeEach(() => {
    setRepoForTests(createMemoryRepo());
    process.env.ADMIN_TOKEN = 'test-token';
  });
  afterEach(() => {
    setRepoForTests(null);
    delete process.env.ADMIN_TOKEN;
  });

  it('stores a result and shows it on the leaderboard', async () => {
    const created = await submit(post('http://test/api/results', JSON.stringify(payload)));
    expect(created.status).toBe(201);
    expect(await created.json()).toMatchObject({ score: 100, passed: true });

    const board = await leaderboard(new Request('http://test/api/leaderboard?mode=learning'));
    expect(board.headers.get('cache-control')).toBe('no-store');
    expect(await board.json()).toMatchObject({ rows: [{ nickname: 'Айгерим', score: 100 }] });
  });

  it('answers 400 to a body that is not JSON', async () => {
    const res = await submit(post('http://test/api/results', '{oops'));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'invalid_json' });
  });

  it('protects the admin routes with ADMIN_TOKEN', async () => {
    await submit(post('http://test/api/results', JSON.stringify(payload)));
    expect((await recent(new Request('http://test/api/admin/results'))).status).toBe(401);
    const auth = { authorization: 'Bearer test-token' };
    const list = await recent(new Request('http://test/api/admin/results?limit=5', { headers: auth }));
    expect(list.status).toBe(200);
    const hidden = await hide(post('http://test/api/admin/hide', JSON.stringify({ id }), auth));
    expect(await hidden.json()).toEqual({ id, hidden: true });
    const board = await leaderboard(new Request('http://test/api/leaderboard?mode=learning'));
    expect(await board.json()).toEqual({ rows: [] });
  });
});
```

- [ ] **Step 2: Запустить и убедиться, что тест падает**

Run: `npx vitest run app/api`
Expected: FAIL — `Failed to resolve import "@/lib/server/get-repo"`.

- [ ] **Step 3: Создать `lib/server/postgres-repo.ts`**

```ts
import { neon } from '@neondatabase/serverless';
import type { LeaderboardRow, NewResult, ResultsRepo, StoredResult } from './repo';

type Row = Record<string, unknown>;

const iso = (value: unknown): string => new Date(value as string).toISOString();

const toStored = (r: Row): StoredResult => ({
  id: String(r.id),
  nickname: String(r.nickname),
  scenarioId: String(r.scenario_id),
  mode: r.mode as StoredResult['mode'],
  score: Number(r.score),
  passed: Boolean(r.passed),
  breakdown: r.breakdown as StoredResult['breakdown'],
  errors: r.errors as StoredResult['errors'],
  events: r.events as StoredResult['events'],
  durationSec: Number(r.duration_sec),
  locale: r.locale as StoredResult['locale'],
  appVersion: String(r.app_version),
  hidden: Boolean(r.hidden),
  createdAt: iso(r.created_at),
});

const toBoardRow = (r: Row): LeaderboardRow => ({
  nickname: String(r.nickname),
  score: Number(r.score),
  passed: Boolean(r.passed),
  durationSec: Number(r.duration_sec),
  scenarioId: String(r.scenario_id),
  createdAt: iso(r.created_at),
});

export function createPostgresRepo(databaseUrl: string): ResultsRepo {
  const sql = neon(databaseUrl);

  return {
    async insert(r: NewResult) {
      const inserted = (await sql.query(
        `insert into results
           (id, nickname, scenario_id, mode, score, passed, breakdown, errors, events, duration_sec, locale, app_version)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         on conflict (id) do nothing
         returning *`,
        [
          r.id, r.nickname, r.scenarioId, r.mode, r.score, r.passed,
          JSON.stringify(r.breakdown), JSON.stringify(r.errors), JSON.stringify(r.events),
          r.durationSec, r.locale, r.appVersion,
        ],
      )) as Row[];
      if (inserted.length > 0) return { created: true, result: toStored(inserted[0]) };
      const existing = (await sql.query('select * from results where id = $1', [r.id])) as Row[];
      return { created: false, result: toStored(existing[0]) };
    },

    async leaderboard({ mode, since, scenarioId, limit }) {
      const rows = (await sql.query(
        `select nickname, score, passed, duration_sec, scenario_id, created_at
         from (
           select distinct on (lower(nickname)) nickname, score, passed, duration_sec, scenario_id, created_at
           from results
           where mode = $1
             and not hidden
             and created_at >= $2::timestamptz
             and ($3::text is null or scenario_id = $3::text)
           order by lower(nickname), passed desc, score desc, duration_sec asc, created_at asc
         ) best
         order by passed desc, score desc, duration_sec asc, created_at asc
         limit $4`,
        [mode, since ?? '1970-01-01T00:00:00.000Z', scenarioId, limit],
      )) as Row[];
      return rows.map(toBoardRow);
    },

    async recent(limit) {
      const rows = (await sql.query('select * from results order by created_at desc limit $1', [limit])) as Row[];
      return rows.map(toStored);
    },

    async hide(id) {
      const rows = (await sql.query('update results set hidden = true where id = $1 returning id', [id])) as Row[];
      return rows.length > 0;
    },
  };
}
```

- [ ] **Step 4: Создать `lib/server/get-repo.ts`**

```ts
import { createMemoryRepo } from './memory-repo';
import { createPostgresRepo } from './postgres-repo';
import type { ResultsRepo } from './repo';

const store = globalThis as typeof globalThis & { __pisResultsRepo?: ResultsRepo | null };

export function getRepo(): ResultsRepo {
  if (store.__pisResultsRepo) return store.__pisResultsRepo;
  const url = process.env.DATABASE_URL;
  let repo: ResultsRepo;
  if (url) {
    repo = createPostgresRepo(url);
  } else if (process.env.NODE_ENV !== 'production' || process.env.ALLOW_MEMORY_STORE === '1') {
    repo = createMemoryRepo();
  } else {
    throw new Error('DATABASE_URL is not configured');
  }
  store.__pisResultsRepo = repo;
  return repo;
}

/** Tests only: replace or reset the shared repository. */
export function setRepoForTests(repo: ResultsRepo | null): void {
  store.__pisResultsRepo = repo;
}
```

- [ ] **Step 5: Создать маршруты API**

`app/api/results/route.ts`:

```ts
import { getRepo } from '@/lib/server/get-repo';
import { submitResult } from '@/lib/server/results-service';

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }
  const { status, body: payload } = await submitResult(body, getRepo());
  return Response.json(payload, { status });
}
```

`app/api/leaderboard/route.ts`:

```ts
import { getRepo } from '@/lib/server/get-repo';
import { getLeaderboard } from '@/lib/server/results-service';

export async function GET(request: Request): Promise<Response> {
  const { status, body } = await getLeaderboard(new URL(request.url).searchParams, getRepo());
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}
```

`app/api/admin/results/route.ts`:

```ts
import { getRepo } from '@/lib/server/get-repo';
import { listRecent } from '@/lib/server/results-service';

export async function GET(request: Request): Promise<Response> {
  const { status, body } = await listRecent(
    request.headers.get('authorization'),
    process.env.ADMIN_TOKEN,
    new URL(request.url).searchParams.get('limit'),
    getRepo(),
  );
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}
```

`app/api/admin/hide/route.ts`:

```ts
import { getRepo } from '@/lib/server/get-repo';
import { hideResult } from '@/lib/server/results-service';

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }
  const { status, body: payload } = await hideResult(
    request.headers.get('authorization'),
    process.env.ADMIN_TOKEN,
    body,
    getRepo(),
  );
  return Response.json(payload, { status });
}
```

- [ ] **Step 6: Создать `db/schema.sql` и `scripts/migrate.mjs`**

`db/schema.sql`:

```sql
create table if not exists results (
  id uuid primary key,
  nickname text not null check (char_length(nickname) between 2 and 20),
  scenario_id text not null,
  mode text not null check (mode in ('learning', 'exam')),
  score integer not null check (score between 0 and 100),
  passed boolean not null,
  breakdown jsonb not null,
  errors jsonb not null,
  events jsonb not null,
  duration_sec integer not null check (duration_sec >= 0),
  locale text not null check (locale in ('ru', 'kk')),
  app_version text not null,
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists results_board_idx
  on results (mode, created_at desc) where not hidden;
```

`scripts/migrate.mjs`:

```js
import { readFile } from 'node:fs/promises';
import { neon } from '@neondatabase/serverless';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set. Run "vercel env pull .env.local" first.');
  process.exit(1);
}

const sql = neon(url);
const schema = await readFile(new URL('../db/schema.sql', import.meta.url), 'utf8');
const statements = schema
  .split(';')
  .map((s) => s.trim())
  .filter(Boolean);

for (const statement of statements) {
  await sql.query(statement);
}
console.log(`Applied ${statements.length} statements.`);
```

- [ ] **Step 7: Запустить тесты и сборку**

Run: `npm test -- --maxWorkers=4`
Expected: PASS (все наборы, включая `app/api/api.test.ts`).

Run: `npm run build`
Expected: успешная сборка; в списке маршрутов `ƒ /api/results`, `ƒ /api/leaderboard`, `ƒ /api/admin/results`, `ƒ /api/admin/hide`.

- [ ] **Step 8: Commit**

```bash
git add lib/server/postgres-repo.ts lib/server/get-repo.ts app/api db scripts
git commit -m "feat(api): add results, leaderboard and admin routes with Postgres storage" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 11: Виртуальный инфузомат (UI)

**Files:**
- Create: `lib/engine/display.ts`, `components/Pump/Pump.tsx`, `components/Pump/DripLine.tsx`
- Modify: `app/globals.css` (стили насоса, капельницы и общих элементов)
- Test: `lib/engine/display.test.ts`

**Interfaces:**
- Consumes: `PumpState`, `FIELD_DIGITS`, `formatTenths`, `createPump`, `pressButton`, `setRateLimits`, `beginInfusion`, `raiseAlarm`, `markAlarmFixed`, `completeInfusion` (Task 3), `formatDuration`, `formatRemaining` (Task 2), `programPump` (Task 3).
- Produces: `type ScreenTone = 'off' | 'normal' | 'warn' | 'alarm'`, `interface ScreenLine { label: string; value: string; unit: string; selected?: boolean; digits?: number[]; cursor?: number }`, `interface PumpScreen { tone; header: string; lines: ScreenLine[]; footer: string }`, `pumpScreen(state, drugLabel: string | null, progress: number): PumpScreen`; компоненты `<Pump state drugLabel progress onPress? />` (у кнопок `aria-label` = имя кнопки: `POWER`, `MENU`, `LEFT`, `RIGHT`, `PLUS`, `MINUS`, `ENTER`, `START`, `STOP`, `MUTE`; без `onPress` кнопки неактивны) и `<DripLine progress running rateMlH />`; CSS-классы `card`, `btn`, `btn-primary`, `btn-secondary`, `choice`, `is-wrong`, `is-right`, `is-reveal`, `badge`, `field`.

- [ ] **Step 1: Написать падающий тест `lib/engine/display.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { pumpScreen } from './display';
import {
  beginInfusion, completeInfusion, createPump, markAlarmFixed, pressButton, raiseAlarm, setRateLimits,
  type PumpState,
} from './pump';
import { programPump } from './testing';
import type { PumpButton } from './types';

const press = (s: PumpState, ...buttons: PumpButton[]) => buttons.reduce((acc, b) => pressButton(acc, b).state, s);
const programmed = () => press(setRateLimits(createPump(), 20, 150), ...programPump(840, 210));
const running = () => beginInfusion(press(programmed(), 'START'));

describe('pumpScreen', () => {
  it('is dark when off', () => {
    expect(pumpScreen(createPump(), null, 0)).toEqual({ tone: 'off', header: '', lines: [], footer: '' });
  });

  it('shows RATE, VTBI and the computed TIME while programming', () => {
    const screen = pumpScreen(programmed(), 'PARACETAMOL 10 mg/mL', 0);
    expect(screen.tone).toBe('normal');
    expect(screen.header).toBe('PARACETAMOL 10 mg/mL');
    expect(screen.lines.map((l) => [l.label, l.value, l.unit])).toEqual([
      ['RATE', '084.0', 'ml/h'],
      ['VTBI', '0021.0', 'ml'],
      ['TIME', '0:15', 'h:mm'],
    ]);
    expect(screen.lines[1].selected).toBe(true);
  });

  it('shows the draft digits and the cursor while editing', () => {
    const s = press(createPump(), 'POWER', 'ENTER', 'RIGHT', 'PLUS');
    const rate = pumpScreen(s, null, 0).lines[0];
    expect(rate.digits).toEqual([0, 1, 0, 0]);
    expect(rate.cursor).toBe(1);
    expect(pumpScreen(s, null, 0).lines[2].value).toBe('--:--');
  });

  it('warns about the drug-library limit', () => {
    // 200.0 ml/h against a 20–150 ml/h library limit.
    const s = press(setRateLimits(createPump(), 20, 150), 'POWER', 'ENTER', 'PLUS', 'PLUS', 'ENTER');
    const screen = pumpScreen(s, 'X', 0);
    expect(screen.tone).toBe('warn');
    expect(screen.header).toBe('⚠ RATE ABOVE LIMIT');
    expect(screen.lines[0].value).toBe('200.0');
  });

  it('counts the infused volume and the time left', () => {
    const screen = pumpScreen(running(), 'X', 0.5);
    expect(screen.lines.map((l) => [l.label, l.value])).toEqual([
      ['RATE', '084.0'],
      ['VI', '0010.5'],
      ['LEFT', '07:30'],
    ]);
  });

  it('shows alarms', () => {
    const occlusion = raiseAlarm(running(), 'occlusion');
    expect(pumpScreen(occlusion, 'X', 0.4)).toMatchObject({ tone: 'alarm', header: '⛔ OCCLUSION', footer: 'MUTE = SILENCE' });
    expect(pumpScreen(markAlarmFixed(occlusion), 'X', 0.4).footer).toBe('START = RESTART');
    expect(pumpScreen(raiseAlarm(running(), 'airInLine'), 'X', 0.5).header).toBe('⛔ AIR IN LINE');
    expect(pumpScreen(raiseAlarm(running(), 'lowBattery'), 'X', 0.3)).toMatchObject({
      tone: 'warn',
      header: '⚠ LOW BATTERY 10%',
    });
  });

  it('reports the end of the infusion', () => {
    expect(pumpScreen(completeInfusion(running()), 'X', 1).header).toBe('VTBI INFUSED');
  });
});
```

- [ ] **Step 2: Запустить и убедиться, что тест падает**

Run: `npx vitest run lib/engine/display.test.ts`
Expected: FAIL — `Failed to resolve import "./display"`.

- [ ] **Step 3: Реализовать `lib/engine/display.ts`**

```ts
import { formatDuration, formatRemaining } from './calc';
import { FIELD_DIGITS, formatTenths, type PumpField, type PumpState } from './pump';

export type ScreenTone = 'off' | 'normal' | 'warn' | 'alarm';

export interface ScreenLine {
  label: string;
  value: string;
  unit: string;
  selected?: boolean;
  /** Present while the field is being edited: the draft digits (last one is tenths). */
  digits?: number[];
  cursor?: number;
}

export interface PumpScreen {
  tone: ScreenTone;
  header: string;
  lines: ScreenLine[];
  footer: string;
}

const UNIT: Record<PumpField, string> = { rate: 'ml/h', vtbi: 'ml' };
const LABEL: Record<PumpField, string> = { rate: 'RATE', vtbi: 'VTBI' };

function fieldLine(s: PumpState, field: PumpField): ScreenLine {
  const tenths = field === 'rate' ? s.rateTenths : s.vtbiTenths;
  const line: ScreenLine = {
    label: LABEL[field],
    value: formatTenths(tenths, FIELD_DIGITS[field]),
    unit: UNIT[field],
    selected: s.field === field,
  };
  return s.editing && s.field === field ? { ...line, digits: s.draft, cursor: s.cursor } : line;
}

const timeLine = (s: PumpState): ScreenLine => ({
  label: 'TIME',
  value: s.rateTenths > 0 && s.vtbiTenths > 0 ? formatDuration(s.vtbiTenths / s.rateTenths) : '--:--',
  unit: 'h:mm',
});

function alarmHeader(s: PumpState): string {
  if (s.alarm?.depleted) return '⛔ BATTERY EMPTY';
  return s.alarm?.type === 'airInLine' ? '⛔ AIR IN LINE' : '⛔ OCCLUSION';
}

export function pumpScreen(s: PumpState, drugLabel: string | null, progress: number): PumpScreen {
  const drug = drugLabel ?? 'NO DRUG LIBRARY';
  const rate = formatTenths(s.rateTenths, FIELD_DIGITS.rate);
  const remainingSec = s.rateTenths > 0 ? ((1 - progress) * (s.vtbiTenths / s.rateTenths)) * 3600 : 0;
  const runLines: ScreenLine[] = [
    { label: 'RATE', value: rate, unit: 'ml/h' },
    { label: 'VI', value: formatTenths(Math.round(progress * s.vtbiTenths), FIELD_DIGITS.vtbi), unit: 'ml' },
    { label: 'LEFT', value: formatRemaining(remainingSec), unit: '' },
  ];

  switch (s.status) {
    case 'off':
      return { tone: 'off', header: '', lines: [], footer: '' };
    case 'program':
      return {
        tone: 'normal',
        header: drug,
        lines: [fieldLine(s, 'rate'), fieldLine(s, 'vtbi'), timeLine(s)],
        footer: s.editing ? '◀ ▶  + −  ENTER = OK  STOP = CANCEL' : 'MENU = FIELD  ENTER = EDIT  START',
      };
    case 'limitWarning': {
      const pending = s.pendingTenths ?? 0;
      return {
        tone: 'warn',
        header: pending > s.maxRateTenths ? '⚠ RATE ABOVE LIMIT' : '⚠ RATE BELOW LIMIT',
        lines: [
          { label: 'RATE', value: formatTenths(pending, FIELD_DIGITS.rate), unit: 'ml/h' },
          {
            label: 'LIMIT',
            value: `${formatTenths(s.minRateTenths, FIELD_DIGITS.rate)}–${formatTenths(s.maxRateTenths, FIELD_DIGITS.rate)}`,
            unit: 'ml/h',
          },
        ],
        footer: 'ENTER = CONFIRM  STOP = BACK',
      };
    }
    case 'confirm':
      return {
        tone: 'normal',
        header: 'CONFIRM SETTINGS?',
        lines: [
          { label: 'RATE', value: rate, unit: 'ml/h' },
          { label: 'VTBI', value: formatTenths(s.vtbiTenths, FIELD_DIGITS.vtbi), unit: 'ml' },
          timeLine(s),
        ],
        footer: 'START = RUN  STOP = BACK',
      };
    case 'running':
      return s.alarm?.type === 'lowBattery'
        ? { tone: 'warn', header: '⚠ LOW BATTERY 10%', lines: runLines, footer: 'MUTE = SILENCE' }
        : { tone: 'normal', header: `▶▶ ${drug}`, lines: runLines, footer: 'STOP = PAUSE' };
    case 'paused':
      return { tone: 'warn', header: 'PAUSED', lines: runLines, footer: 'START = CONTINUE' };
    case 'alarmStopped':
      return {
        tone: 'alarm',
        header: alarmHeader(s),
        lines: runLines,
        footer: s.alarm?.fixed ? 'START = RESTART' : 'MUTE = SILENCE',
      };
    case 'complete':
      return {
        tone: 'normal',
        header: 'VTBI INFUSED',
        lines: [{ label: 'VI', value: formatTenths(s.vtbiTenths, FIELD_DIGITS.vtbi), unit: 'ml' }],
        footer: 'KVO',
      };
  }
}
```

- [ ] **Step 4: Запустить тест**

Run: `npx vitest run lib/engine/display.test.ts`
Expected: PASS.

- [ ] **Step 5: Создать `components/Pump/Pump.tsx`**

```tsx
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
      <div className={`pump-screen tone-${screen.tone}`} aria-live="polite">
        {screen.tone !== 'off' && (
          <>
            <div className="pump-screen-header">{screen.header}</div>
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
```

- [ ] **Step 6: Создать `components/Pump/DripLine.tsx`**

```tsx
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
```

- [ ] **Step 7: Заменить `app/globals.css` целиком**

```css
@import "tailwindcss";

:root {
  --bg: #f4f7f7;
  --fg: #10201f;
  --muted: #5b6b6a;
  --brand: #0f766e;
  --brand-ink: #ffffff;
  --card: #ffffff;
  --line: #d5dfde;
  --ok: #15803d;
  --warn: #b45309;
  --bad: #b91c1c;
}

body {
  background: var(--bg);
  color: var(--fg);
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
  -webkit-tap-highlight-color: transparent;
}

.card { background: var(--card); border: 1px solid var(--line); border-radius: 16px; padding: 16px; }
.btn {
  display: flex; align-items: center; justify-content: center; min-height: 48px; padding: 0 16px;
  border-radius: 12px; font-weight: 600; text-align: center; touch-action: manipulation;
}
.btn-primary { background: var(--brand); color: var(--brand-ink); }
.btn-secondary { background: var(--card); color: var(--fg); border: 1px solid var(--line); }
.btn:disabled { opacity: 0.5; }
.choice {
  display: block; width: 100%; min-height: 48px; padding: 12px 14px; text-align: left;
  border: 1px solid var(--line); border-radius: 12px; background: var(--card);
}
.choice.is-wrong { border-color: var(--bad); background: #fef2f2; }
.choice.is-right { border-color: var(--ok); background: #f0fdf4; }
.choice.is-reveal { outline: 2px dashed var(--ok); outline-offset: 2px; }
.badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 12px; background: #fef3c7; color: #92400e; }
.field { width: 100%; min-height: 44px; padding: 0 12px; border: 1px solid var(--line); border-radius: 10px; background: #fff; }

/* Pump */
.pump {
  width: 100%; max-width: 360px; margin: 0 auto; padding: 14px; border: 1px solid #cbd5e1; border-radius: 22px;
  background: linear-gradient(180deg, #f8fafc, #e2e8f0);
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.18), inset 0 1px 0 #fff;
}
.pump-top { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; font-size: 12px; color: #475569; }
.pump-brand { margin-right: auto; font-weight: 700; letter-spacing: 0.1em; }
.pump-led { width: 10px; height: 10px; border-radius: 50%; background: #cbd5e1; box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.3); }
.led-green { background: #22c55e; box-shadow: 0 0 8px #22c55e; }
.led-amber { background: #f59e0b; box-shadow: 0 0 8px #f59e0b; }
.led-red { background: #ef4444; box-shadow: 0 0 8px #ef4444; animation: blink 0.8s steps(2) infinite; }
@keyframes blink { 50% { opacity: 0.3; } }
.pump-screen {
  min-height: 150px; padding: 10px 12px; border-radius: 10px;
  font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; font-size: 15px; line-height: 1.5;
  background: #0b2a1e; color: #b7f5c9; box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.6);
}
.pump-screen.tone-off { background: #111827; }
.pump-screen.tone-warn { background: #3a2a05; color: #fde68a; }
.pump-screen.tone-alarm { background: #450a0a; color: #fecaca; }
.pump-screen-header { overflow: hidden; font-size: 13px; font-weight: 700; letter-spacing: 0.04em; white-space: nowrap; text-overflow: ellipsis; }
.tone-alarm .pump-screen-header { font-size: 16px; animation: blink 0.8s steps(2) infinite; }
.pump-line { display: grid; grid-template-columns: 5.5em 1fr 3.5em; align-items: baseline; }
.pump-line.is-selected { color: #ffffff; }
.pump-line-value { padding-right: 6px; font-size: 22px; text-align: right; font-variant-numeric: tabular-nums; }
.pump-line-unit { font-size: 12px; opacity: 0.8; }
.digit-cursor { border-radius: 2px; background: #b7f5c9; color: #0b2a1e; }
.pump-screen-footer { margin-top: 6px; font-size: 11px; opacity: 0.75; }
.pump-keys { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-top: 12px; }
.pump-key {
  min-height: 48px; border: 1px solid #94a3b8; border-radius: 12px; font-size: 15px; font-weight: 700;
  background: linear-gradient(180deg, #ffffff, #e2e8f0); color: #0f172a; box-shadow: 0 2px 0 #94a3b8;
  touch-action: manipulation; user-select: none;
}
.pump-key:active:not(:disabled) { transform: translateY(2px); box-shadow: none; }
.pump-key:disabled { opacity: 0.6; }
.key-start, .key-stop { grid-column: span 2; color: #ffffff; }
.key-start { border-color: #15803d; background: linear-gradient(180deg, #4ade80, #16a34a); box-shadow: 0 2px 0 #15803d; }
.key-stop { border-color: #b91c1c; background: linear-gradient(180deg, #f87171, #dc2626); box-shadow: 0 2px 0 #b91c1c; }
.key-power { color: var(--brand); }

/* Drip line */
.drip { display: block; width: 100%; max-width: 420px; height: auto; margin: 0 auto; }
.drip-bag { fill: #e8f4fb; stroke: #7aa7c7; stroke-width: 2; }
.drip-fluid { fill: #8ec9ef; transition: y 0.3s linear, height 0.3s linear; }
.drip-chamber { fill: #f1f5f9; stroke: #7aa7c7; stroke-width: 1.5; }
.drip-drop { fill: #3b82f6; animation: drop 1s linear infinite; }
@keyframes drop { from { transform: translateY(0); opacity: 1; } to { transform: translateY(9px); opacity: 0.2; } }
.drip-tube { fill: none; stroke: #94a3b8; stroke-width: 3; }
.drip-flow { fill: none; stroke: #3b82f6; stroke-width: 3; stroke-dasharray: 6 10; opacity: 0; }
.drip-flow.is-running { opacity: 1; animation: flow 1s linear infinite; }
@keyframes flow { to { stroke-dashoffset: -16; } }

@media (prefers-reduced-motion: reduce) {
  .led-red, .tone-alarm .pump-screen-header, .drip-drop, .drip-flow.is-running { animation: none; }
}
```

- [ ] **Step 8: Проверить сборку**

Run: `npm test -- --maxWorkers=4 && npm run build`
Expected: тесты проходят, сборка успешна.

- [ ] **Step 9: Commit**

```bash
git add lib/engine/display.ts lib/engine/display.test.ts components/Pump app/globals.css
git commit -m "feat(ui): add virtual infusion pump and drip line" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 12: Каркас интерфейса, главная, сценарии, обучение

**Files:**
- Create: `components/I18nProvider.tsx`, `components/Providers.tsx`, `components/ui.tsx`, `components/LocaleSwitch.tsx`, `components/NicknameDialog.tsx`
- Create: `components/screens/HomeScreen.tsx`, `components/screens/ScenarioList.tsx`, `components/screens/LearnScreen.tsx`
- Create: `app/scenarios/page.tsx`, `app/learn/page.tsx`
- Modify: `app/layout.tsx`, `app/page.tsx`

**Interfaces:**
- Consumes: `dictionaries`, `DEFAULT_LOCALE`, `isLocale`, `Dict` (Task 7); `localKV`, `KEYS` (Task 8); `browserOutbox` (Task 8); `validateNickname` (Task 9); `scenarios` (Task 4); `Pump` (Task 11); `createPump` (Task 3).
- Produces: `I18nProvider`, `useI18n(): { locale; setLocale(l); d: Dict; l(text: L10n): string }`; `Providers` (языки + отправка очереди результатов при открытии и по событию `online`); `Page({ title?, back?, wide?, children })`, `LinkButton({ href, variant?, children })`, `Card({ className?, children })`, `Segmented<T>({ value, options: [T, string][], onChange })`; `LocaleSwitch`; `NicknameDialog({ initial?, onSave(nickname), onCancel? })`, `readNickname(): string | null` (только валидный ник), `saveNickname(value)`; экраны `HomeScreen`, `ScenarioList({ mode })`, `LearnScreen`.

- [ ] **Step 1: Создать `components/I18nProvider.tsx`**

```tsx
'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { KEYS, localKV } from '@/lib/client/storage';
import type { L10n, Locale } from '@/lib/engine/types';
import { DEFAULT_LOCALE, dictionaries, isLocale, type Dict } from '@/lib/i18n';

interface I18n {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  d: Dict;
  l: (text: L10n) => string;
}

const I18nContext = createContext<I18n | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  useEffect(() => {
    const saved = localKV.get(KEYS.locale);
    if (isLocale(saved)) setLocaleState(saved);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    localKV.set(KEYS.locale, next);
  }, []);

  const value = useMemo<I18n>(
    () => ({ locale, setLocale, d: dictionaries[locale], l: (text) => text[locale] }),
    [locale, setLocale],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside <I18nProvider>');
  return ctx;
}
```

- [ ] **Step 2: Создать `components/Providers.tsx`**

```tsx
'use client';

import { useEffect, type ReactNode } from 'react';
import { browserOutbox } from '@/lib/client/outbox';
import { I18nProvider } from './I18nProvider';

export function Providers({ children }: { children: ReactNode }) {
  useEffect(() => {
    const flush = () => void browserOutbox.flush();
    flush();
    window.addEventListener('online', flush);
    return () => window.removeEventListener('online', flush);
  }, []);
  return <I18nProvider>{children}</I18nProvider>;
}
```

- [ ] **Step 3: Создать `components/LocaleSwitch.tsx` и `components/ui.tsx`**

`components/LocaleSwitch.tsx`:

```tsx
'use client';

import { LOCALES } from '@/lib/engine/types';
import { useI18n } from './I18nProvider';

export function LocaleSwitch() {
  const { locale, setLocale, d } = useI18n();
  return (
    <div className="flex overflow-hidden rounded-lg border border-[var(--line)] text-sm" role="group" aria-label={d.common.language}>
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          aria-pressed={locale === l}
          onClick={() => setLocale(l)}
          className={`px-2.5 py-1 font-medium ${locale === l ? 'bg-[var(--brand)] text-white' : 'bg-white'}`}
        >
          {l === 'ru' ? 'RU' : 'KZ'}
        </button>
      ))}
    </div>
  );
}
```

`components/ui.tsx`:

```tsx
'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useI18n } from './I18nProvider';
import { LocaleSwitch } from './LocaleSwitch';

export function Page({ title, back, wide, children }: { title?: string; back?: string; wide?: boolean; children: ReactNode }) {
  const { d } = useI18n();
  return (
    <div className={`mx-auto min-h-dvh px-4 pb-10 ${wide ? 'max-w-6xl' : 'max-w-xl md:max-w-4xl'}`}>
      <header className="flex items-center gap-3 py-3">
        {back ? (
          <Link href={back} className="rounded-lg py-1 pr-2 font-medium text-[var(--brand)]">
            ← {d.common.back}
          </Link>
        ) : (
          <Link href="/" className="font-bold text-[var(--brand)]">
            PIS
          </Link>
        )}
        <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">{title}</h1>
        <LocaleSwitch />
      </header>
      <main>{children}</main>
      <footer className="mt-10 text-center text-xs text-[var(--muted)]">{d.disclaimer}</footer>
    </div>
  );
}

export function LinkButton({ href, variant = 'primary', children }: { href: string; variant?: 'primary' | 'secondary'; children: ReactNode }) {
  return (
    <Link href={href} className={`btn ${variant === 'primary' ? 'btn-primary' : 'btn-secondary'}`}>
      {children}
    </Link>
  );
}

export function Card({ className = '', children }: { className?: string; children: ReactNode }) {
  return <section className={`card ${className}`}>{children}</section>;
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (value: T) => void }) {
  return (
    <div className="grid auto-cols-fr grid-flow-col gap-1 rounded-xl bg-[var(--line)] p-1" role="group">
      {options.map(([option, label]) => (
        <button
          key={option}
          type="button"
          aria-pressed={value === option}
          onClick={() => onChange(option)}
          className={`rounded-lg px-3 py-2 text-sm font-medium ${value === option ? 'bg-white shadow' : ''}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Создать `components/NicknameDialog.tsx`**

```tsx
'use client';

import { useState, type FormEvent } from 'react';
import { KEYS, localKV } from '@/lib/client/storage';
import { validateNickname } from '@/lib/nickname';
import { useI18n } from './I18nProvider';

/** The saved nickname, or null when there is none or it no longer passes validation. */
export function readNickname(): string | null {
  const saved = localKV.get(KEYS.nickname);
  if (!saved) return null;
  const check = validateNickname(saved);
  return check.ok ? check.value : null;
}

export function saveNickname(value: string): void {
  localKV.set(KEYS.nickname, value);
}

export function NicknameDialog({ initial = '', onSave, onCancel }: { initial?: string; onSave: (nickname: string) => void; onCancel?: () => void }) {
  const { d } = useI18n();
  const [value, setValue] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const check = validateNickname(value);
    if (!check.ok) {
      setError(d.nickname.errors[check.reason]);
      return;
    }
    saveNickname(check.value);
    onSave(check.value);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="nickname-title">
      <form onSubmit={submit} className="card w-full max-w-sm space-y-3">
        <h2 id="nickname-title" className="text-lg font-semibold">
          {d.nickname.title}
        </h2>
        <label htmlFor="nickname" className="block text-sm font-medium">
          {d.nickname.label}
        </label>
        <input
          id="nickname"
          className="field"
          value={value}
          maxLength={20}
          autoFocus
          autoComplete="nickname"
          placeholder={d.nickname.placeholder}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
        />
        {error ? (
          <p className="text-sm text-[var(--bad)]" role="alert">
            {error}
          </p>
        ) : (
          <p className="text-xs text-[var(--muted)]">{d.nickname.notice}</p>
        )}
        <div className="flex gap-2">
          {onCancel && (
            <button type="button" className="btn btn-secondary flex-1" onClick={onCancel}>
              {d.common.back}
            </button>
          )}
          <button type="submit" className="btn btn-primary flex-1">
            {d.nickname.save}
          </button>
        </div>
      </form>
    </div>
  );
}
```

- [ ] **Step 5: Создать экраны `components/screens/HomeScreen.tsx`, `ScenarioList.tsx`, `LearnScreen.tsx`**

`components/screens/HomeScreen.tsx`:

```tsx
'use client';

import { createPump, type PumpState } from '@/lib/engine/pump';
import { useI18n } from '../I18nProvider';
import { Pump } from '../Pump/Pump';
import { LinkButton, Page } from '../ui';

/** A programmed pump for the home page picture: 100 ml/h, 50 ml, 0:30. */
const DEMO: PumpState = { ...createPump(), status: 'program', rateTenths: 1000, vtbiTenths: 500 };

export function HomeScreen() {
  const { d } = useI18n();
  return (
    <Page>
      <div className="mx-auto max-w-md space-y-5 pt-2 text-center">
        <div>
          <h2 className="text-2xl font-bold">{d.appName}</h2>
          <p className="text-[var(--muted)]">{d.appSubtitle}</p>
        </div>
        <Pump state={DEMO} drugLabel="DEMO" progress={0} />
        <p className="text-sm">{d.home.tagline}</p>
        <div className="grid gap-3">
          <LinkButton href="/scenarios?mode=learning">{d.home.start}</LinkButton>
          <LinkButton href="/scenarios?mode=exam" variant="secondary">
            {d.home.exam}
          </LinkButton>
          <div className="grid grid-cols-2 gap-3">
            <LinkButton href="/learn" variant="secondary">
              {d.home.learn}
            </LinkButton>
            <LinkButton href="/results" variant="secondary">
              {d.home.results}
            </LinkButton>
          </div>
        </div>
        <p className="text-xs font-medium text-[var(--warn)]">{d.disclaimer}</p>
      </div>
    </Page>
  );
}
```

`components/screens/ScenarioList.tsx`:

```tsx
'use client';

import Link from 'next/link';
import type { Mode } from '@/lib/engine/types';
import { scenarios } from '@/lib/scenarios';
import { useI18n } from '../I18nProvider';
import { Page } from '../ui';

export function ScenarioList({ mode }: { mode: Mode }) {
  const { d, l } = useI18n();
  return (
    <Page title={d.modes[mode]} back="/">
      <h2 className="mb-3 text-xl font-semibold">{d.scenarios.title}</h2>
      <ul className="grid gap-3 md:grid-cols-2">
        {scenarios.map((s) => (
          <li key={s.id}>
            <Link href={`/sim/${s.id}?mode=${mode}`} className="card block h-full hover:border-[var(--brand)]">
              <div className="flex items-start justify-between gap-2">
                <span className="text-sm text-[var(--muted)]">
                  {d.patient.title} {s.patient.code}
                </span>
                {s.reviewStatus === 'draft' && <span className="badge">{d.draftBadge}</span>}
              </div>
              <div className="mt-1 text-lg font-semibold">
                {s.number}. {l(s.title)}
              </div>
              <div className="text-sm text-[var(--muted)]">
                {l(s.patient.age)} · {s.patient.weightKg} {d.patient.kg}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </Page>
  );
}
```

`components/screens/LearnScreen.tsx`:

```tsx
'use client';

import { useI18n } from '../I18nProvider';
import { Card, Page } from '../ui';

export function LearnScreen() {
  const { d } = useI18n();
  return (
    <Page title={d.learn.title} back="/">
      <div className="grid gap-3 md:grid-cols-2">
        {d.learn.cards.map((card) => (
          <Card key={card.title}>
            <h2 className="mb-2 font-semibold">{card.title}</h2>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {card.lines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </Page>
  );
}
```

- [ ] **Step 6: Подключить провайдеры и страницы**

`app/layout.tsx` — заменить файл целиком:

```tsx
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Providers } from '@/components/Providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'Pediatric Infusion Simulator',
  description: 'Учебный симулятор инфузомата для педиатрии',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0f766e',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

`app/page.tsx` — заменить файл целиком:

```tsx
import { HomeScreen } from '@/components/screens/HomeScreen';

export default function HomePage() {
  return <HomeScreen />;
}
```

`app/scenarios/page.tsx`:

```tsx
import { ScenarioList } from '@/components/screens/ScenarioList';

export default async function ScenariosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { mode } = await searchParams;
  return <ScenarioList mode={mode === 'exam' ? 'exam' : 'learning'} />;
}
```

`app/learn/page.tsx`:

```tsx
import { LearnScreen } from '@/components/screens/LearnScreen';

export default function LearnPage() {
  return <LearnScreen />;
}
```

- [ ] **Step 7: Проверить сборку и вид в браузере**

Run: `npm test -- --maxWorkers=4 && npm run build`
Expected: тесты проходят; в списке маршрутов есть `/`, `/scenarios`, `/learn`.

Запустить `npm run dev` (через `preview_start` или терминал), открыть `http://localhost:3000` во встроенном браузере с размером `mobile` (375×812).
Expected: на главной название, насос с `100.0 ml/h`, четыре кнопки; переключатель RU/KZ меняет тексты; `/scenarios?mode=learning` показывает 5 карточек со значком «Черновик»; `/learn` — 4 карточки. Нет горизонтальной прокрутки.

- [ ] **Step 8: Commit**

```bash
git add components app
git commit -m "feat(ui): add app shell, home, scenario list and learning cards" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 13: Экран симуляции

**Files:**
- Create: `components/sim/PatientCard.tsx`, `components/sim/FeedbackBanner.tsx`, `components/sim/StepDrug.tsx`, `components/sim/StepRoute.tsx`, `components/sim/StepCalc.tsx`, `components/sim/Checklist.tsx`, `components/sim/PumpStep.tsx`, `components/sim/InfusionControls.tsx`, `components/sim/AlarmPanel.tsx`, `components/sim/ResultSummary.tsx`, `components/sim/SimulationScreen.tsx`
- Create: `app/sim/[scenarioId]/page.tsx`

**Interfaces:**
- Consumes: `Session`, `applyEvent`, `createSession`, `nextAlarmStep`, `Feedback` (Task 5); `gradeSession`, `Grade`, `CATEGORIES`, `POINTS` (Task 6); `formatDuration`, `formatRemaining` (Task 2); `FIELD_DIGITS`, `formatTenths` (Task 3); `getScenario` (Task 4); `seededShuffle`, `addHistory`, `browserOutbox`, `localKV`, `startAlarmSound`, `stopAlarmSound`, `unlockAudio` (Task 8); `APP_VERSION` (Task 1); `Pump`, `DripLine` (Task 11); `Page`, `Card`, `useI18n`, `NicknameDialog`, `readNickname` (Task 12).
- Produces: `SimulationScreen({ scenarioId, mode })`, страница `/sim/[scenarioId]?mode=learning|exam`. Тексты, на которые опирается e2e (Task 15): кнопки препаратов и путей с полными названиями, поле `aria-label="Число"`, список `aria-label="Единица"`, кнопка «Проверить», флажки чек-листа, кнопка скорости «Быстро», заголовок «Симуляция завершена», строка «✅ Сдано», «Результат в рейтинге».

- [ ] **Step 1: Создать `components/sim/PatientCard.tsx` и `components/sim/FeedbackBanner.tsx`**

`components/sim/PatientCard.tsx`:

```tsx
'use client';

import type { Scenario } from '@/lib/engine/types';
import { useI18n } from '../I18nProvider';
import { Card } from '../ui';

export function PatientCard({ scenario }: { scenario: Scenario }) {
  const { d, l } = useI18n();
  const p = scenario.patient;
  return (
    <Card className="space-y-1 text-sm">
      <div className="flex items-start justify-between gap-2">
        <strong>
          {d.patient.title} {p.code}
        </strong>
        {scenario.reviewStatus === 'draft' && <span className="badge">{d.draftBadge}</span>}
      </div>
      <div>
        {d.patient.age}: {l(p.age)} · {d.patient.weight}: {p.weightKg} {d.patient.kg}
      </div>
      <div>
        {d.patient.condition}: {l(p.condition)}
      </div>
      <div>
        {d.patient.accesses}: {p.accesses.map((r) => d.routes[r]).join(', ')}
      </div>
      <div className="mt-2 rounded-lg bg-cyan-50 p-2">
        <strong>{d.patient.order}:</strong> {l(scenario.order)}
      </div>
    </Card>
  );
}
```

`components/sim/FeedbackBanner.tsx`:

```tsx
'use client';

import type { Feedback } from '@/lib/engine/session';
import type { ErrorCode, Mode } from '@/lib/engine/types';
import { useI18n } from '../I18nProvider';

export function FeedbackBanner({ feedback, mode }: { feedback: Feedback; mode: Mode }) {
  const { d, l } = useI18n();
  if (!feedback) return null;
  if (feedback.kind === 'reveal') {
    return (
      <p className="rounded-lg bg-sky-50 p-3 text-sm" role="status">
        🔎 {l(feedback.text)}
      </p>
    );
  }
  if (mode === 'exam') return null;
  if (feedback.kind === 'correct') {
    return (
      <p className="rounded-lg bg-green-50 p-3 text-sm text-[var(--ok)]" role="status">
        {d.feedback.correct}
      </p>
    );
  }
  const text = (code: ErrorCode) =>
    feedback.kind === 'blocked' && code in d.blocked ? d.blocked[code as keyof typeof d.blocked] : d.errors[code];
  return (
    <div className="space-y-1 rounded-lg bg-red-50 p-3 text-sm text-[var(--bad)]" role="alert">
      {feedback.kind === 'wrong' && <p>{d.feedback.wrong}</p>}
      {feedback.codes.map((code) => (
        <p key={code}>{text(code)}</p>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Создать шаги `StepDrug.tsx`, `StepRoute.tsx`, `StepCalc.tsx`**

`components/sim/StepDrug.tsx`:

```tsx
'use client';

import { useMemo } from 'react';
import { seededShuffle } from '@/lib/client/shuffle';
import type { Session } from '@/lib/engine/session';
import { useI18n } from '../I18nProvider';
import { Card } from '../ui';

export function StepDrug({ session, onSelect }: { session: Session; onSelect: (optionId: string) => void }) {
  const { d, l } = useI18n();
  const { scenario, mode, drug } = session;
  const options = useMemo(() => seededShuffle(scenario.drugOptions, `${scenario.id}:drugs`), [scenario]);
  const reveal = mode === 'learning' && drug.attempts >= 3 && drug.correctAt === null;
  return (
    <Card className="space-y-2">
      <h2 className="font-semibold">{d.steps.drug}</h2>
      {options.map((o) => {
        const wrong = mode === 'learning' && drug.selectedId === o.id && o.id !== scenario.correctDrugId;
        const hinted = reveal && o.id === scenario.correctDrugId;
        return (
          <button
            key={o.id}
            type="button"
            className={`choice ${wrong ? 'is-wrong' : ''} ${hinted ? 'is-reveal' : ''}`}
            onClick={() => onSelect(o.id)}
          >
            {l(o.name)}
          </button>
        );
      })}
    </Card>
  );
}
```

`components/sim/StepRoute.tsx`:

```tsx
'use client';

import type { Session } from '@/lib/engine/session';
import { ROUTE_IDS, type RouteId } from '@/lib/engine/types';
import { useI18n } from '../I18nProvider';
import { Card } from '../ui';

export function StepRoute({ session, onSelect }: { session: Session; onSelect: (routeId: RouteId) => void }) {
  const { d } = useI18n();
  const { scenario, mode, route } = session;
  const correct = scenario.acceptableRoutes.find((r) => scenario.patient.accesses.includes(r));
  const reveal = mode === 'learning' && route.attempts >= 3 && route.correctAt === null;
  return (
    <Card className="space-y-2">
      <h2 className="font-semibold">{d.steps.route}</h2>
      {ROUTE_IDS.map((id) => {
        const wrong = mode === 'learning' && route.selectedId === id && id !== correct;
        return (
          <button
            key={id}
            type="button"
            className={`choice ${wrong ? 'is-wrong' : ''} ${reveal && id === correct ? 'is-reveal' : ''}`}
            onClick={() => onSelect(id)}
          >
            {d.routes[id]}
          </button>
        );
      })}
    </Card>
  );
}
```

`components/sim/StepCalc.tsx`:

```tsx
'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { seededShuffle } from '@/lib/client/shuffle';
import type { Session } from '@/lib/engine/session';
import type { UnitId } from '@/lib/engine/types';
import { useI18n } from '../I18nProvider';

export function StepCalc({ session, onAnswer }: { session: Session; onAnswer: (value: number, unit: UnitId) => void }) {
  const { d, l } = useI18n();
  const { scenario, mode } = session;
  const step = scenario.calcSteps[session.calcIndex];
  const units = useMemo(() => seededShuffle(step.unitOptions, `${scenario.id}:${step.id}:units`), [scenario.id, step]);
  const [raw, setRaw] = useState('');
  const [unit, setUnit] = useState<UnitId | ''>('');
  const [incomplete, setIncomplete] = useState(false);
  const record = session.calc[step.id];
  const expected = session.expected[step.quantity];
  const reveal = mode === 'learning' && record.attempts >= 3 && record.correctAt === null;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const value = Number(raw.replace(',', '.').trim());
    if (raw.trim() === '' || !Number.isFinite(value) || unit === '') {
      setIncomplete(true);
      return;
    }
    setIncomplete(false);
    onAnswer(value, unit);
  };

  return (
    <form onSubmit={submit} className="card space-y-3">
      <h2 className="font-semibold">
        {d.steps.calc} ({session.calcIndex + 1}/{scenario.calcSteps.length})
      </h2>
      <p>{l(step.prompt)}</p>
      {mode === 'learning' && (
        <p className="rounded-lg bg-amber-50 p-2 text-sm">
          💡 {d.feedback.hint}: {l(step.hint)}
        </p>
      )}
      <div className="flex gap-2">
        <input
          aria-label={d.steps.value}
          className="field flex-1"
          inputMode="decimal"
          autoComplete="off"
          placeholder={d.steps.value}
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
        />
        <select
          aria-label={d.steps.unit}
          className="field w-36"
          value={unit}
          onChange={(e) => setUnit(e.target.value as UnitId | '')}
        >
          <option value="">{d.steps.chooseUnit}</option>
          {units.map((u) => (
            <option key={u} value={u}>
              {d.units[u]}
            </option>
          ))}
        </select>
      </div>
      {incomplete && <p className="text-sm text-[var(--bad)]">{d.steps.needValue}</p>}
      {reveal && expected !== null && (
        <p className="text-sm text-[var(--ok)]">
          {d.feedback.reveal}: {String(expected).replace('.', ',')} {d.units[step.unit]}
        </p>
      )}
      <button type="submit" className="btn btn-primary w-full">
        {d.common.check}
      </button>
    </form>
  );
}
```

- [ ] **Step 3: Создать `Checklist.tsx`, `PumpStep.tsx`, `InfusionControls.tsx`, `AlarmPanel.tsx`**

`components/sim/Checklist.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useI18n } from '../I18nProvider';

export function Checklist({ done, onComplete }: { done: boolean; onComplete: () => void }) {
  const { d } = useI18n();
  const [checked, setChecked] = useState<boolean[]>(() => d.checklist.items.map(() => done));

  const toggle = (index: number) => {
    const next = checked.map((value, i) => (i === index ? !value : value));
    setChecked(next);
    if (!done && next.every(Boolean)) onComplete();
  };

  return (
    <fieldset className="card space-y-2">
      <legend className="px-1 font-semibold">{d.checklist.title}</legend>
      {d.checklist.items.map((item, i) => (
        <label key={i} className="flex min-h-11 items-center gap-3 text-sm">
          <input type="checkbox" className="h-5 w-5" checked={done || checked[i]} disabled={done} onChange={() => toggle(i)} />
          {item}
        </label>
      ))}
    </fieldset>
  );
}
```

`components/sim/PumpStep.tsx`:

```tsx
'use client';

import { formatDuration } from '@/lib/engine/calc';
import { FIELD_DIGITS, formatTenths } from '@/lib/engine/pump';
import type { Session } from '@/lib/engine/session';
import type { PumpButton } from '@/lib/engine/types';
import { useI18n } from '../I18nProvider';
import { DripLine } from '../Pump/DripLine';
import { Pump } from '../Pump/Pump';
import { Checklist } from './Checklist';

interface PumpStepProps {
  session: Session;
  progress: number;
  onPress?: (button: PumpButton) => void;
  onChecklist: () => void;
}

export function PumpStep({ session, progress, onPress, onChecklist }: PumpStepProps) {
  const { d } = useI18n();
  const { scenario, mode, pump, step, expected } = session;
  const drug = scenario.drugOptions.find((o) => o.id === session.drug.selectedId) ?? null;
  const showExpected = mode === 'learning' && step === 'pump' && session.start.attempts >= 3;
  return (
    <section className="space-y-3">
      <h2 className="font-semibold">{step === 'pump' ? d.steps.pump : d.steps.infusion}</h2>
      <DripLine progress={progress} running={pump.status === 'running'} rateMlH={pump.rateTenths / 10} />
      <Pump state={pump} drugLabel={drug?.pumpLabel ?? null} progress={progress} onPress={onPress} />
      {step === 'pump' && mode === 'learning' && (
        <ol className="card space-y-1 text-sm">
          {d.pumpGuide.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ol>
      )}
      {showExpected && (
        <p className="rounded-lg bg-green-50 p-3 text-sm text-[var(--ok)]">
          {d.blocked.expected}: RATE {formatTenths(Math.round(expected.rateMlH * 10), FIELD_DIGITS.rate)} ml/h · VTBI{' '}
          {formatTenths(Math.round(expected.vtbiMl * 10), FIELD_DIGITS.vtbi)} ml · TIME {formatDuration(expected.durationMin / 60)}
        </p>
      )}
      {step === 'pump' && <Checklist done={session.checklistDone} onComplete={onChecklist} />}
    </section>
  );
}
```

`components/sim/InfusionControls.tsx`:

```tsx
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
```

`components/sim/AlarmPanel.tsx`:

```tsx
'use client';

import { useMemo } from 'react';
import { seededShuffle } from '@/lib/client/shuffle';
import { nextAlarmStep, type Session } from '@/lib/engine/session';
import { useI18n } from '../I18nProvider';

export function AlarmPanel({ session, onAction }: { session: Session; onAction: (actionId: string) => void }) {
  const { d, l } = useI18n();
  const { scenario, mode, alarm } = session;
  const spec = scenario.alarm;
  const actions = useMemo(() => (spec ? seededShuffle(spec.actions, `${scenario.id}:alarm`) : []), [spec, scenario.id]);
  if (!spec || !alarm || alarm.resolved) return null;

  const next = mode === 'learning' ? nextAlarmStep(session) : null;
  const showHint = next !== null && (alarm.wrongCount > 0 || next === 'START');
  const hint = next === 'START' ? d.infusion.restartHint : spec.actions.find((a) => a.id === next);

  return (
    <section className="card space-y-2 border-[var(--bad)]" aria-live="assertive">
      <h3 className="font-semibold text-[var(--bad)]">🚨 {d.infusion.alarmTitle}</h3>
      {actions.map((a) => {
        const done = alarm.performed.includes(a.id);
        return (
          <button
            key={a.id}
            type="button"
            className={`choice ${done ? 'is-right' : ''}`}
            disabled={done}
            onClick={() => onAction(a.id)}
          >
            {done ? '✓ ' : ''}
            {l(a.label)}
          </button>
        );
      })}
      {showHint && hint && (
        <p className="text-sm">
          💡 {d.infusion.nextHint}: {typeof hint === 'string' ? hint : l(hint.label)}
        </p>
      )}
    </section>
  );
}
```

- [ ] **Step 4: Создать `components/sim/ResultSummary.tsx`**

```tsx
'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import type { FlushOutcome } from '@/lib/client/outbox';
import { formatRemaining } from '@/lib/engine/calc';
import { CATEGORIES, POINTS, type Grade } from '@/lib/engine/grading';
import type { ErrorCode, Mode } from '@/lib/engine/types';
import { useI18n } from '../I18nProvider';

export type SubmitState = 'idle' | 'sending' | FlushOutcome;

const formatPoints = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ','));

interface ResultSummaryProps {
  grade: Grade;
  mode: Mode;
  submit: SubmitState;
  onRetry: () => void;
}

export function ResultSummary({ grade, mode, submit, onRetry }: ResultSummaryProps) {
  const { d } = useI18n();
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const counts = new Map<ErrorCode, number>();
  for (const e of grade.errors) counts.set(e.code, (counts.get(e.code) ?? 0) + 1);
  const status: Record<SubmitState, string> = {
    idle: '',
    sending: d.result.sending,
    sent: d.result.sent,
    queued: d.result.queued,
    rejected: d.result.rejected,
  };

  return (
    <section ref={ref} className="card space-y-3" aria-labelledby="result-title">
      <h2 id="result-title" className="text-xl font-bold">
        {d.result.title}
      </h2>
      <div className="flex items-baseline gap-2">
        <span className="text-4xl font-bold tabular-nums" data-testid="score">
          {grade.score}
        </span>
        <span className="text-[var(--muted)]">/ 100 · {d.result.score}</span>
      </div>
      <p className={`font-semibold ${grade.passed ? 'text-[var(--ok)]' : 'text-[var(--bad)]'}`}>
        {grade.passed ? `✅ ${d.result.passed}` : `⛔ ${d.result.failed}`}
      </p>
      {!grade.passed && <p className="text-sm">{d.result.criticalNote}</p>}
      <table className="w-full text-sm">
        <tbody>
          {CATEGORIES.map((c) => (
            <tr key={c} className="border-t border-[var(--line)]">
              <td className="py-1">{d.categories[c]}</td>
              <td className="py-1 text-right tabular-nums">
                {formatPoints(grade.breakdown[c])} / {POINTS[c]}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div>
        <h3 className="font-semibold">{d.result.errors}</h3>
        {counts.size === 0 ? (
          <p className="text-sm">{d.result.noErrors}</p>
        ) : (
          <ol className="list-decimal space-y-0.5 pl-5 text-sm">
            {[...counts].map(([code, n]) => (
              <li key={code}>
                {d.errors[code]}
                {n > 1 ? ` ×${n}` : ''}
              </li>
            ))}
          </ol>
        )}
      </div>
      <p className="text-sm">
        {d.result.time}: {formatRemaining(grade.durationSec)}
      </p>
      {status[submit] && (
        <p className="text-sm text-[var(--muted)]" role="status">
          {status[submit]}
        </p>
      )}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className="btn btn-primary" onClick={onRetry}>
          {d.result.again}
        </button>
        <Link href={`/scenarios?mode=${mode}`} className="btn btn-secondary">
          {d.result.other}
        </Link>
        <Link href="/results" className="btn btn-secondary col-span-2">
          {d.result.toResults}
        </Link>
      </div>
    </section>
  );
}
```

- [ ] **Step 5: Создать `components/sim/SimulationScreen.tsx`**

```tsx
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
  }, [grade, attemptId, scenario.id, mode, nickname, locale, state.events]);

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
```

- [ ] **Step 6: Создать `app/sim/[scenarioId]/page.tsx`**

```tsx
import { notFound } from 'next/navigation';
import { SimulationScreen } from '@/components/sim/SimulationScreen';
import { getScenario } from '@/lib/scenarios';

export default async function SimulationPage({
  params,
  searchParams,
}: {
  params: Promise<{ scenarioId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { scenarioId } = await params;
  const { mode } = await searchParams;
  if (!getScenario(scenarioId)) notFound();
  return <SimulationScreen scenarioId={scenarioId} mode={mode === 'exam' ? 'exam' : 'learning'} />;
}
```

- [ ] **Step 7: Проверить сборку и пройти сценарии вручную**

Run: `npm test -- --maxWorkers=4 && npm run build`
Expected: тесты проходят, сборка успешна, есть маршрут `ƒ /sim/[scenarioId]`.

Запустить `npm run dev`, во встроенном браузере (размер `mobile`) пройти:
1. Сценарий 1, режим с подсказками, всё верно (парацетамол → ПВК → 210 мг → 21 мл → POWER, RATE 84.0, MENU, VTBI 21.0, чек-лист, START, START → «Быстро»). Expected: итог 100 баллов, «✅ Сдано», «Результат в рейтинге».
2. Сценарий 2, тестовый режим: при 40 % — OCCLUSION, насос стоит; «Осмотреть линию» показывает причину; «Открыть роликовый зажим» → START → инфузия продолжается. Expected: итог 100.
3. Сценарий 1, режим с подсказками: RATE 840.0 → предупреждение библиотеки → ENTER → START, START. Expected: блокировка «ОШИБКА НАСТРОЙКИ…», в итоге «⛔ Не сдано».
4. Сценарий 4: LOW BATTERY при 30 %, насос продолжает работать; без подключения к сети при 70 % — BATTERY EMPTY.
Консоль браузера без ошибок `Ignored simulation event`.

- [ ] **Step 8: Commit**

```bash
git add components/sim app/sim
git commit -m "feat(ui): add the simulation screen with steps, pump, alarms and results" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 14: Рейтинг, результаты, экран стенда, модерация

**Files:**
- Create: `components/Leaderboard.tsx`, `components/screens/ResultsScreen.tsx`, `components/screens/StandScreen.tsx`, `components/screens/AdminScreen.tsx`
- Create: `app/results/page.tsx`, `app/stand/page.tsx`, `app/admin/page.tsx`

**Interfaces:**
- Consumes: `LeaderboardRow` (тип, Task 9); `GET /api/leaderboard`, `GET /api/admin/results`, `POST /api/admin/hide` (Task 10); `readHistory`, `localKV` (Task 8); `getScenario`, `scenarios` (Task 4); `formatRemaining` (Task 2); `Page`, `Card`, `Segmented`, `useI18n`, `NicknameDialog`, `readNickname` (Task 12); `toDataURL` из `qrcode`.
- Produces: `<Leaderboard mode period="today" | "all" refreshMs? large? />` (период «сегодня» считается по часам устройства), страницы `/results`, `/stand`, `/admin`.

- [ ] **Step 1: Создать `components/Leaderboard.tsx`**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { formatRemaining } from '@/lib/engine/calc';
import type { Mode } from '@/lib/engine/types';
import { getScenario } from '@/lib/scenarios';
import type { LeaderboardRow } from '@/lib/server/repo';
import { useI18n } from './I18nProvider';

export type Period = 'today' | 'all';

interface LeaderboardProps {
  mode: Mode;
  period: Period;
  refreshMs?: number;
  large?: boolean;
}

export function Leaderboard({ mode, period, refreshMs, large = false }: LeaderboardProps) {
  const { d } = useI18n();
  const [rows, setRows] = useState<LeaderboardRow[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const params = new URLSearchParams({ mode });
      if (period === 'today') {
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        params.set('since', start.toISOString());
      }
      try {
        const res = await fetch(`/api/leaderboard?${params}`, { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { rows: LeaderboardRow[] };
        if (!cancelled) {
          setRows(data.rows);
          setFailed(false);
        }
      } catch {
        if (!cancelled) setFailed(true);
      }
    };
    setRows(null);
    void load();
    const id = refreshMs ? window.setInterval(load, refreshMs) : undefined;
    return () => {
      cancelled = true;
      if (id) window.clearInterval(id);
    };
  }, [mode, period, refreshMs]);

  if (!rows) {
    return <p className="text-sm text-[var(--muted)]">{failed ? d.results.failedToLoad : d.common.loading}</p>;
  }
  if (rows.length === 0) return <p className="text-sm text-[var(--muted)]">{d.results.empty}</p>;

  return (
    <table className={`w-full table-fixed ${large ? 'text-2xl' : 'text-sm'}`}>
      <thead>
        <tr className="text-left text-[var(--muted)]">
          <th className="w-[2.5em] py-1">#</th>
          <th className="py-1">{d.results.colNick}</th>
          <th className="w-[4em] py-1 text-right">{d.results.colScore}</th>
          <th className="w-[4.5em] py-1 text-right">{d.results.colTime}</th>
          <th className="w-[3em] py-1 text-right">№</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={`${r.nickname}-${r.createdAt}`} className="border-t border-[var(--line)]">
            <td className="py-1">{i + 1}</td>
            <td className="truncate py-1">
              {r.passed ? '' : '⛔ '}
              {r.nickname}
            </td>
            <td className="py-1 text-right font-semibold tabular-nums">{r.score}</td>
            <td className="py-1 text-right tabular-nums">{formatRemaining(r.durationSec)}</td>
            <td className="py-1 text-right" title={d.results.colScenario}>
              {getScenario(r.scenarioId)?.number ?? '–'}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 2: Создать `components/screens/ResultsScreen.tsx`**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { readHistory, type HistoryItem } from '@/lib/client/history';
import { localKV } from '@/lib/client/storage';
import type { Mode } from '@/lib/engine/types';
import { getScenario } from '@/lib/scenarios';
import { useI18n } from '../I18nProvider';
import { Leaderboard, type Period } from '../Leaderboard';
import { NicknameDialog, readNickname } from '../NicknameDialog';
import { Card, Page, Segmented } from '../ui';

export function ResultsScreen() {
  const { d, l, locale } = useI18n();
  const [mounted, setMounted] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [nickname, setNickname] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [mode, setMode] = useState<Mode>('learning');
  const [period, setPeriod] = useState<Period>('today');

  useEffect(() => {
    setMounted(true);
    setHistory(readHistory(localKV));
    setNickname(readNickname());
  }, []);

  const dateLocale = locale === 'kk' ? 'kk-KZ' : 'ru-RU';

  return (
    <Page title={d.results.title} back="/">
      <div className="space-y-4">
        <Card className="flex items-center justify-between gap-3">
          <strong className="truncate">{nickname ?? '—'}</strong>
          <button type="button" className="btn btn-secondary" onClick={() => setEditing(true)}>
            {d.nickname.change}
          </button>
        </Card>

        <Card className="space-y-3">
          <h2 className="font-semibold">{d.results.leaderboard}</h2>
          <Segmented value={mode} onChange={setMode} options={[['learning', d.modes.learning], ['exam', d.modes.exam]]} />
          <Segmented value={period} onChange={setPeriod} options={[['today', d.results.today], ['all', d.results.allTime]]} />
          <Leaderboard mode={mode} period={period} refreshMs={15000} />
        </Card>

        <Card className="space-y-2">
          <h2 className="font-semibold">{d.results.mine}</h2>
          {mounted && history.length === 0 && <p className="text-sm text-[var(--muted)]">{d.results.none}</p>}
          <ul className="space-y-1 text-sm">
            {history.map((h) => {
              const scenario = getScenario(h.scenarioId);
              return (
                <li key={h.id} className="flex justify-between gap-2 border-t border-[var(--line)] pt-1">
                  <span className="min-w-0 truncate">
                    {new Date(h.createdAt).toLocaleString(dateLocale, { dateStyle: 'short', timeStyle: 'short' })} ·{' '}
                    {scenario ? `${scenario.number}. ${l(scenario.title)}` : h.scenarioId} · {d.modes[h.mode]}
                  </span>
                  <span className="font-semibold tabular-nums">
                    {h.passed ? '' : '⛔ '}
                    {h.score}
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>
      {editing && (
        <NicknameDialog
          initial={nickname ?? ''}
          onSave={(value) => {
            setNickname(value);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      )}
    </Page>
  );
}
```

- [ ] **Step 3: Создать `components/screens/StandScreen.tsx`**

```tsx
'use client';

import { toDataURL } from 'qrcode';
import { useEffect, useState } from 'react';
import { useI18n } from '../I18nProvider';
import { Leaderboard } from '../Leaderboard';
import { Card, Page } from '../ui';

export function StandScreen() {
  const { d } = useI18n();
  const [origin, setOrigin] = useState('');
  const [qr, setQr] = useState<string | null>(null);

  useEffect(() => {
    const url = window.location.origin;
    setOrigin(url);
    toDataURL(url, { width: 640, margin: 1 })
      .then(setQr)
      .catch(() => setQr(null));
  }, []);

  return (
    <Page wide title={d.appName}>
      <div className="grid gap-6 lg:grid-cols-[minmax(280px,1fr)_2fr]">
        <Card className="flex flex-col items-center gap-3 text-center">
          <p className="text-xl font-semibold">{d.stand.scan}</p>
          {qr && <img src={qr} alt={origin} className="w-full max-w-sm" />}
          <p className="break-all font-mono text-sm">{origin}</p>
          {qr && (
            <a href={qr} download="pediatric-infusion-simulator-qr.png" className="btn btn-secondary">
              {d.stand.download}
            </a>
          )}
        </Card>
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <h2 className="mb-2 text-xl font-semibold">{d.modes.exam}</h2>
            <Leaderboard mode="exam" period="today" refreshMs={10000} large />
          </Card>
          <Card>
            <h2 className="mb-2 text-xl font-semibold">{d.modes.learning}</h2>
            <Leaderboard mode="learning" period="today" refreshMs={10000} large />
          </Card>
        </div>
      </div>
    </Page>
  );
}
```

- [ ] **Step 4: Создать `components/screens/AdminScreen.tsx`**

```tsx
'use client';

import { useState, type FormEvent } from 'react';
import type { Mode } from '@/lib/engine/types';
import { useI18n } from '../I18nProvider';
import { Page } from '../ui';

interface AdminRow {
  id: string;
  nickname: string;
  scenarioId: string;
  mode: Mode;
  score: number;
  passed: boolean;
  hidden: boolean;
  createdAt: string;
}

export function AdminScreen() {
  const { d } = useI18n();
  const [token, setToken] = useState('');
  const [rows, setRows] = useState<AdminRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const auth = { Authorization: `Bearer ${token}` };

  const load = async (e?: FormEvent) => {
    e?.preventDefault();
    setError(null);
    try {
      const res = await fetch('/api/admin/results?limit=50', { headers: auth, cache: 'no-store' });
      if (res.status === 401) {
        setRows(null);
        setError(d.admin.unauthorized);
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setRows(((await res.json()) as { rows: AdminRow[] }).rows);
    } catch {
      setError(d.results.failedToLoad);
    }
  };

  const hide = async (id: string) => {
    const res = await fetch('/api/admin/hide', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...auth },
      body: JSON.stringify({ id }),
    });
    if (res.ok) setRows((list) => list?.map((r) => (r.id === id ? { ...r, hidden: true } : r)) ?? null);
  };

  return (
    <Page title={d.admin.title} back="/">
      <form onSubmit={load} className="card mb-4 flex gap-2">
        <input
          type="password"
          aria-label={d.admin.token}
          placeholder={d.admin.token}
          className="field flex-1"
          autoComplete="off"
          value={token}
          onChange={(e) => setToken(e.target.value)}
        />
        <button type="submit" className="btn btn-primary">
          {d.admin.load}
        </button>
      </form>
      {error && <p className="mb-3 text-[var(--bad)]">{error}</p>}
      {rows && (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.id} className="card flex items-center justify-between gap-2 text-sm">
              <span className="min-w-0">
                <strong>{r.nickname}</strong> · {r.score} {r.passed ? '' : '⛔'} · {r.mode} · {r.scenarioId} ·{' '}
                {new Date(r.createdAt).toLocaleString('ru-RU')}
              </span>
              {r.hidden ? (
                <span className="badge">{d.admin.hidden}</span>
              ) : (
                <button type="button" className="btn btn-secondary" onClick={() => void hide(r.id)}>
                  {d.admin.hide}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}
```

- [ ] **Step 5: Создать страницы**

`app/results/page.tsx`:

```tsx
import { ResultsScreen } from '@/components/screens/ResultsScreen';

export default function ResultsPage() {
  return <ResultsScreen />;
}
```

`app/stand/page.tsx`:

```tsx
import { StandScreen } from '@/components/screens/StandScreen';

export default function StandPage() {
  return <StandScreen />;
}
```

`app/admin/page.tsx`:

```tsx
import type { Metadata } from 'next';
import { AdminScreen } from '@/components/screens/AdminScreen';

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function AdminPage() {
  return <AdminScreen />;
}
```

- [ ] **Step 6: Проверить**

Run: `npm test -- --maxWorkers=4 && npm run build`
Expected: тесты проходят; есть маршруты `/results`, `/stand`, `/admin`.

В `npm run dev` (`MemoryRepo`, т.к. `DATABASE_URL` не задан): пройти сценарий 1, открыть `/results` — ник в рейтинге «С подсказками» за сегодня и прохождение в «Моих прохождениях»; `/stand` на размере `desktop` — QR-код, адрес, два рейтинга, кнопка «Скачать QR (PNG)»; `/admin` с неверным ключом — «Неверный ключ». Для проверки скрытия локально: `ADMIN_TOKEN=local-test npm run dev`, ввести `local-test`, нажать «Скрыть» — запись исчезает из рейтинга после обновления.

- [ ] **Step 7: Commit**

```bash
git add components/Leaderboard.tsx components/screens app/results app/stand app/admin
git commit -m "feat(ui): add leaderboard, results page, stand screen with QR and moderation" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 15: Сквозной тест (Playwright)

**Files:**
- Create: `playwright.config.ts`, `tests/e2e/scenario1.spec.ts`

**Interfaces:**
- Consumes: `programPump` (Task 3); все экраны и маршруты (Tasks 10–14); тексты из Task 13.
- Produces: `npm run e2e` — локально собирает приложение и запускает `next start` на порту 3100 с хранилищем в памяти (`DATABASE_URL=''`, `ALLOW_MEMORY_STORE=1`, чтобы не трогать реальную базу, даже если появится `.env.local`). С `E2E_BASE_URL=<адрес>` тест идёт против уже задеплоенного сайта; с `E2E_ADMIN_TOKEN` он после проверки скрывает свою запись из рейтинга.

- [ ] **Step 1: Создать `playwright.config.ts`**

```ts
import { defineConfig, devices } from '@playwright/test';

const PORT = 3100;
const external = process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 120_000,
  expect: { timeout: 15_000 },
  use: {
    ...devices['Pixel 7'],
    baseURL: external ?? `http://localhost:${PORT}`,
    locale: 'ru-RU',
  },
  webServer: external
    ? undefined
    : {
        command: `npm run build && npx next start -p ${PORT}`,
        url: `http://localhost:${PORT}`,
        timeout: 240_000,
        reuseExistingServer: false,
        env: { DATABASE_URL: '', ALLOW_MEMORY_STORE: '1' },
      },
});
```

- [ ] **Step 2: Создать `tests/e2e/scenario1.spec.ts`**

```ts
import { expect, test } from '@playwright/test';
import { programPump } from '../../lib/engine/testing';

const NICK = `E2E ${Date.now() % 100000}`;

test('scenario 1 in learning mode: from the home page to the leaderboard', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Начать симуляцию' }).click();
  await page.getByRole('link', { name: /Лихорадка/ }).click();

  await page.getByLabel('Ник').fill(NICK);
  await page.getByRole('button', { name: 'Сохранить' }).click();

  await page.getByRole('button', { name: 'Парацетамол 10 мг/мл' }).click();
  await page.getByRole('button', { name: 'Периферический венозный катетер (ПВК)' }).click();

  for (const [value, unit] of [['210', 'мг'], ['21', 'мл']] as const) {
    await page.getByLabel('Число').fill(value);
    await page.getByLabel('Единица').selectOption({ label: unit });
    await page.getByRole('button', { name: 'Проверить' }).click();
  }

  for (const button of programPump(840, 210)) {
    await page.getByRole('button', { name: button, exact: true }).click();
  }
  for (const box of await page.getByRole('checkbox').all()) await box.check();
  await page.getByRole('button', { name: 'START', exact: true }).click();
  await page.getByRole('button', { name: 'START', exact: true }).click();

  await page.getByRole('button', { name: 'Быстро' }).click();
  await expect(page.getByRole('heading', { name: 'Симуляция завершена' })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('score')).toHaveText('100');
  await expect(page.getByText('✅ Сдано', { exact: true })).toBeVisible();
  await expect(page.getByText('Результат в рейтинге')).toBeVisible();

  await page.getByRole('link', { name: 'Рейтинг' }).click();
  await expect(page.getByRole('cell', { name: NICK })).toBeVisible();

  const token = process.env.E2E_ADMIN_TOKEN;
  if (token) {
    const headers = { Authorization: `Bearer ${token}` };
    const list = await page.request.get('/api/admin/results?limit=50', { headers });
    expect(list.ok()).toBe(true);
    const { rows } = (await list.json()) as { rows: Array<{ id: string; nickname: string }> };
    for (const row of rows.filter((r) => r.nickname === NICK)) {
      const hidden = await page.request.post('/api/admin/hide', { headers, data: { id: row.id } });
      expect(hidden.ok()).toBe(true);
    }
  }
});
```

- [ ] **Step 3: Установить браузер для Playwright**

Run: `npx playwright install chromium`
Expected: Chromium скачан (около 150 МБ). Если загрузка запрещена окружением — записать это, пройти тот же сценарий вручную во встроенном браузере (Task 13, Step 7, п. 1) и перейти к Step 5.

- [ ] **Step 4: Запустить e2e**

Run: `npm run e2e`
Expected: `1 passed`.

- [ ] **Step 5: Commit**

```bash
git add playwright.config.ts tests/e2e
git commit -m "test(e2e): cover scenario 1 from home page to leaderboard" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 16: README и деплой на Vercel

**Files:**
- Create: `README.md`
- Создаются CLI (в `.gitignore`): `.vercel/project.json`, `.env.local`

**Interfaces:**
- Consumes: всё приложение; `npm run db:migrate` (Task 10); e2e с `E2E_BASE_URL` / `E2E_ADMIN_TOKEN` (Task 15).
- Produces: проект Vercel `pediatric-infusion-simulator`, база Neon с таблицей `results`, переменные `DATABASE_URL` и `ADMIN_TOKEN`, preview- и production-деплой, QR-код на `/stand`.

**Точки, где нужен пользователь:** (1) согласие на создание бесплатной базы Neon и принятие условий Neon; (2) проверка preview-ссылки и разрешение на production-деплой. Без явного «да» в чате эти шаги не выполняются.

- [ ] **Step 1: Создать `README.md`**

````markdown
# Pediatric Infusion Simulator

Учебный мобильный симулятор педиатрического инфузомата: 5 клинических сценариев, расчёт дозы,
программирование насоса, тревоги, баллы и рейтинг. **Учебный тренажёр. Не для клинического применения.**

## Запуск

```bash
npm install
npm run dev
```

Открыть http://localhost:3000. Без `DATABASE_URL` результаты хранятся в памяти и пропадают при перезапуске.

## Проверки

```bash
npm test -- --maxWorkers=4
npx playwright install chromium
npm run e2e
```

## Где что лежит

- `lib/scenarios` — сценарии: все клинические данные и источники. После проверки преподавателем замените
  `reviewStatus: 'draft'` на `'reviewed'` — значок «Черновик» исчезнет.
- `lib/i18n/kk.ts` — казахские тексты (нужна вычитка носителем языка).
- `lib/engine` — логика: формулы, насос, журнал действий, баллы.
- `/stand` — экран для стенда: QR-код и рейтинг. `/admin` — скрыть запись из рейтинга (нужен `ADMIN_TOKEN`).

## Деплой

- `vercel deploy` — тестовая (preview) версия, `vercel deploy --prod` — рабочая.
- База — Neon из Vercel Marketplace. Таблица создаётся командой `npm run db:migrate`
  (`DATABASE_URL` берётся из `.env.local`, файл создаёт `vercel env pull .env.local`).
- `ADMIN_TOKEN` хранится в переменных Vercel и в `.env.local`. Не публикуйте его.
- `npm run e2e` всегда использует хранилище в памяти, даже если есть `.env.local`.
````

- [ ] **Step 2: Commit README**

```bash
git add README.md
git commit -m "docs: add README with run, test and deploy notes" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 3: Проверить вход и справку CLI** (флаги сверить по справке, не угадывать)

Run: `vercel whoami && vercel link --help && vercel project --help && vercel integration --help && vercel env add --help`
Expected: `dias0092`; справка по командам. Если какой-то флаг ниже отличается в установленной версии CLI — использовать вариант из справки.

- [ ] **Step 4: Создать и привязать проект**

Run: `vercel project add pediatric-infusion-simulator && vercel link --yes --project pediatric-infusion-simulator`
Expected: проект создан в скоупе `dias0092s-projects`, появился `.vercel/project.json`.

- [ ] **Step 5: База Neon (нужно согласие пользователя)**

Спросить пользователя: «Создать бесплатную базу Neon Postgres через Vercel Marketplace и подключить её к проекту? Для этого нужно принять условия Neon». После явного «да»:

Run: `vercel integration add neon`
Expected: CLI создаёт ресурс Neon и подключает его к проекту; если CLI просит принять условия в браузере — это делает пользователь. Если команда недоступна, пользователь делает то же в панели: Project → Storage → Create Database → Neon → Free → Connect (все окружения).

Run: `vercel env ls`
Expected: `DATABASE_URL` есть в Production, Preview и Development.

- [ ] **Step 6: `ADMIN_TOKEN` без вывода значения**

```bash
TOKEN="$(openssl rand -hex 24)"; for env in production preview development; do printf %s "$TOKEN" | vercel env add ADMIN_TOKEN "$env"; done; unset TOKEN
```

Expected: три сообщения `Added Environment Variable ADMIN_TOKEN`. Если для `preview` CLI спрашивает ветку — оставить пустой (все ветки) по справке из Step 3.

- [ ] **Step 7: Локальные переменные и таблица**

Run: `vercel env pull .env.local --yes && npm run db:migrate`
Expected: `.env.local` создан (не выводить его содержимое); `Applied 2 statements.`

- [ ] **Step 8: Preview-деплой**

Run: `vercel deploy`
Expected: сборка успешна, в конце — preview-ссылка. Передать ссылку пользователю для проверки на телефоне (preview защищён входом в Vercel). Дождаться ответа.

- [ ] **Step 9: Production-деплой (после «да» пользователя)**

Run: `vercel deploy --prod`
Expected: production-адрес (обычно `https://pediatric-infusion-simulator.vercel.app`).

- [ ] **Step 10: Сквозная проверка рабочего сайта**

```bash
set -a; . ./.env.local; set +a; E2E_BASE_URL="https://pediatric-infusion-simulator.vercel.app" E2E_ADMIN_TOKEN="$ADMIN_TOKEN" npx playwright test
```

Expected: `1 passed` — сценарий 1 пройден на рабочем сайте, результат записан в Neon, появился в рейтинге и затем скрыт тестом. (Подставить фактический production-адрес из Step 9.)

- [ ] **Step 11: Экран стенда**

Открыть `<production-адрес>/stand` во встроенном браузере (размер `desktop`).
Expected: QR-код ведёт на production-адрес, рейтинги загружаются. Сообщить пользователю, где лежит `ADMIN_TOKEN` (`.env.local`), и что осталось сделать: проверка сценариев преподавателем и вычитка казахских текстов.
