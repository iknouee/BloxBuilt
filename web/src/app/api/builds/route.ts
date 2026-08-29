/**
 * /api/builds
 *   GET  → public: list all builds (newest first)
 *   POST → admin: create a build (requires x-admin-key)
 */

import { NextRequest, NextResponse } from 'next/server';
import { listBuilds, createBuild } from '@/lib/store';
import { isAuthorizedWrite } from '@/lib/auth';
import type { BuildInput } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const builds = await listBuilds();
    return NextResponse.json({ builds });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to load builds.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!isAuthorizedWrite(req)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  try {
    const body = (await req.json()) as BuildInput;
    if (!body?.name || String(body.name).trim().length === 0) {
      return NextResponse.json({ error: 'Name is required.' }, { status: 400 });
    }
    const build = await createBuild(body);
    return NextResponse.json({ build }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to create build.' }, { status: 500 });
  }
}
