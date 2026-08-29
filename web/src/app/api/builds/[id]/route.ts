/**
 * /api/builds/[id]
 *   GET    → public: single build
 *   PUT    → admin: update a build (requires x-admin-key)
 *   DELETE → admin: delete a build (requires x-admin-key)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getBuild, updateBuild, deleteBuild } from '@/lib/store';
import { isAuthorizedWrite } from '@/lib/auth';
import type { BuildInput } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const build = await getBuild(params.id);
  if (!build) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  return NextResponse.json({ build });
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isAuthorizedWrite(req)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  try {
    const body = (await req.json()) as BuildInput;
    const build = await updateBuild(params.id, body);
    if (!build) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
    return NextResponse.json({ build });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to update build.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isAuthorizedWrite(req)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  const ok = await deleteBuild(params.id);
  if (!ok) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
