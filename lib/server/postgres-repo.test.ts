import { describe, expect, it } from 'vitest';
import { createPostgresRepo } from './postgres-repo';

describe('createPostgresRepo', () => {
  it('rejects a malformed DATABASE_URL without echoing it', () => {
    let thrown: unknown;
    try {
      createPostgresRepo('psql postgres://user:secret@host/db');
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(Error);
    const error = thrown as Error;
    expect(error.message).toBe('DATABASE_URL is not a valid connection URL');
    expect(error.message).not.toContain('secret');
    // The URL parser's own TypeError carries the rejected string in `input`, so it must not be chained.
    expect(error.cause).toBeUndefined();
  });

  it('accepts a well-formed Neon connection URL', () => {
    const url = 'postgresql://neondb_owner:secret@ep-cool-darkness-123456-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require';
    expect(() => createPostgresRepo(url)).not.toThrow();
  });
});
