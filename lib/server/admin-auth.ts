import { timingSafeEqual } from 'node:crypto';

const PREFIX = 'Bearer ';

export function isAuthorizedAdmin(authorizationHeader: string | null, token: string | undefined): boolean {
  if (!token || !authorizationHeader?.startsWith(PREFIX)) return false;
  const given = Buffer.from(authorizationHeader.slice(PREFIX.length));
  const expected = Buffer.from(token);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
