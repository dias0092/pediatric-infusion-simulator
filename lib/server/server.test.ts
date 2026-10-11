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
