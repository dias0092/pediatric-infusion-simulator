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
