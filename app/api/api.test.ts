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
