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
