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
