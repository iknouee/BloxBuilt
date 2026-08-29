/**
 * Build storage backed by Vercel KV.
 *
 * We keep a single sorted set `builds:index` of build ids (scored by creation
 * time) and one hash-like JSON value per build at `build:<id>`. This lets us
 * list newest-first cheaply and fetch/update individual builds by id.
 *
 * All functions are server-only (imported from API routes / server
 * components). They never run in the browser.
 */

import { kv } from '@vercel/kv';
import type { Build, BuildInput } from './types';

const INDEX_KEY = 'builds:index';
const buildKey = (id: string) => `build:${id}`;

/** Generate a short, url-safe unique id used as the Build ID. */
export function generateId(): string {
  // 10 chars, uppercase alphanumerics minus ambiguous ones — easy to copy.
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 10; i += 1) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

function sanitizeInput(input: BuildInput): BuildInput {
  return {
    name: String(input.name ?? '').trim(),
    description: String(input.description ?? '').trim(),
    category: String(input.category ?? '').trim(),
    cashPrice: Number.isFinite(input.cashPrice) ? Math.max(0, Math.round(input.cashPrice)) : 0,
    blockbux: Number.isFinite(input.blockbux) ? Math.max(0, Math.round(input.blockbux)) : 0,
    gamepasses: Array.isArray(input.gamepasses)
      ? input.gamepasses.map((g) => String(g).trim()).filter(Boolean)
      : [],
    images: Array.isArray(input.images)
      ? input.images.map((u) => String(u).trim()).filter(Boolean)
      : [],
    uploader: String(input.uploader ?? '').trim() || 'BloxBuilt',
    uploaderAvatar: input.uploaderAvatar ? String(input.uploaderAvatar).trim() : undefined,
  };
}

/** List all builds, newest first. */
export async function listBuilds(): Promise<Build[]> {
  const ids = await kv.zrange<string[]>(INDEX_KEY, 0, -1, { rev: true });
  if (!ids || ids.length === 0) return [];
  const builds = await Promise.all(ids.map((id) => kv.get<Build>(buildKey(id))));
  return builds.filter((b): b is Build => Boolean(b));
}

/**
 * Normalize a user-supplied Build ID into a safe, consistent key. Keeps
 * letters/numbers/dash/underscore, trims, caps length. Returns '' if nothing
 * usable remains.
 */
export function normalizeId(raw: string): string {
  return String(raw ?? '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9._-]/g, '')
    .slice(0, 40);
}

/** Fetch a single build by id. */
export async function getBuild(id: string): Promise<Build | null> {
  const build = await kv.get<Build>(buildKey(id));
  return build ?? null;
}

/**
 * Create a new build. If `input.id` is provided it is used as the Build ID
 * (normalized); otherwise one is generated. Throws with code 'DUPLICATE' if a
 * build with that id already exists.
 */
export async function createBuild(input: BuildInput): Promise<Build> {
  const clean = sanitizeInput(input);

  let id = normalizeId(input.id ?? '');
  if (id) {
    const existing = await getBuild(id);
    if (existing) {
      const err = new Error(`A build with ID "${id}" already exists.`);
      (err as Error & { code?: string }).code = 'DUPLICATE';
      throw err;
    }
  } else {
    // Generate a unique id (avoid the tiny chance of a collision).
    do {
      id = generateId();
    } while (await getBuild(id));
  }

  const now = new Date().toISOString();
  const build: Build = {
    id,
    ...clean,
    createdAt: now,
    updatedAt: now,
  };
  await kv.set(buildKey(id), build);
  await kv.zadd(INDEX_KEY, { score: Date.now(), member: id });
  return build;
}

/** Update an existing build. Returns null if it doesn't exist. */
export async function updateBuild(id: string, input: BuildInput): Promise<Build | null> {
  const existing = await getBuild(id);
  if (!existing) return null;
  const clean = sanitizeInput(input);
  const build: Build = {
    ...existing,
    ...clean,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };
  await kv.set(buildKey(id), build);
  return build;
}

/** Delete a build by id. */
export async function deleteBuild(id: string): Promise<boolean> {
  const existing = await getBuild(id);
  if (!existing) return false;
  await kv.del(buildKey(id));
  await kv.zrem(INDEX_KEY, id);
  return true;
}
