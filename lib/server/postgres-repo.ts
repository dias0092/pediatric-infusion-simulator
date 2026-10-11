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
  // The driver parses the URL twice (as given, then behind an `http:` scheme) and, if either parse fails, echoes the
  // whole string, password included, on the first query. Run the same two parses here and throw a fresh Error without
  // `cause` (the parser's own TypeError carries the raw string too), so the value never appears.
  try {
    const { protocol } = new URL(databaseUrl);
    new URL('http:' + databaseUrl.slice(protocol.length));
  } catch {
    throw new Error('DATABASE_URL is not a valid connection URL');
  }
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
