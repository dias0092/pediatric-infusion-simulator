import { describe, expect, it } from 'vitest';
import { createPostgresRepo } from './postgres-repo';

function expectSafeRejection(url: string): void {
  let thrown: unknown;
  try {
    createPostgresRepo(url);
  } catch (e) {
    thrown = e;
  }
  expect(thrown).toBeInstanceOf(Error);
  const error = thrown as Error;
  expect(error.message).toBe('DATABASE_URL is not a valid connection URL');
  expect(error.message).not.toContain('secret');
  // The URL parser's own TypeError carries the rejected string in `input`, so it must not be chained.
  expect(error.cause).toBeUndefined();
}

describe('createPostgresRepo', () => {
  it('rejects a malformed DATABASE_URL without echoing it', () => {
    expectSafeRejection('psql postgres://user:secret@host/db');
  });

  // These pass `new URL(url)` but fail the driver's second parse (the same string behind an `http:` scheme),
  // after which the driver would echo the whole string, password included, on the first query.
  it.each([
    { label: 'numeric last host label', url: 'postgres://user:secret@db.example.123/db' },
    { label: 'percent sign in the host', url: 'postgres://user:secret@exa%mple/db' },
  ])('rejects a URL that only fails the second, http: parse ($label) without echoing it', ({ url }) => {
    expectSafeRejection(url);
  });

  it('accepts a well-formed Neon connection URL', () => {
    const url = 'postgresql://neondb_owner:secret@ep-cool-darkness-123456-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require';
    expect(() => createPostgresRepo(url)).not.toThrow();
  });
});
