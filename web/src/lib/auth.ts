/**
 * Server-side authorization helpers for admin actions.
 *
 * Two layers of protection:
 *  1. The admin *page* lives at a secret URL segment (ADMIN_SECRET).
 *  2. The write *API* (create/update/delete/upload) additionally requires the
 *     ADMIN_API_KEY in an `x-admin-key` header, so discovering the URL alone
 *     is not enough to modify data.
 */

import { NextRequest } from 'next/server';

export function getAdminSecret(): string {
  return process.env.ADMIN_SECRET ?? '';
}

export function getAdminApiKey(): string {
  return process.env.ADMIN_API_KEY ?? '';
}

/** Timing-safe-ish string compare (constant length-independent). */
function safeEqual(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

/** True if the given path secret matches ADMIN_SECRET. */
export function isValidAdminSecret(secret: string): boolean {
  const expected = getAdminSecret();
  return expected.length > 0 && safeEqual(secret, expected);
}

/** True if a write request carries the correct admin API key. */
export function isAuthorizedWrite(req: NextRequest): boolean {
  const expected = getAdminApiKey();
  if (!expected) return false;
  const provided = req.headers.get('x-admin-key') ?? '';
  return safeEqual(provided, expected);
}
