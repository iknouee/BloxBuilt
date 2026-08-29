/**
 * /api/upload — admin image upload to Vercel Blob (requires x-admin-key).
 *
 * Accepts a single file via multipart form-data under the `file` field and
 * returns the public URL of the stored image, which the admin form then saves
 * into the build's `images` array.
 */

import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { isAuthorizedWrite } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB
const ALLOWED = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

export async function POST(req: NextRequest) {
  if (!isAuthorizedWrite(req)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No file provided.' }, { status: 400 });
    }
    if (!ALLOWED.includes(file.type)) {
      return NextResponse.json({ error: 'Unsupported image type.' }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'Image is too large (max 8 MB).' }, { status: 400 });
    }

    // Surface a clear message if Blob isn't wired up yet (most common cause).
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json(
        {
          error:
            'Image storage is not connected. Create a Vercel Blob store, connect it to this project, then redeploy.',
        },
        { status: 500 },
      );
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const blob = await put(`builds/${Date.now()}-${safeName}`, file, {
      access: 'public',
      addRandomSuffix: true,
    });

    return NextResponse.json({ url: blob.url });
  } catch (err) {
    // Return the underlying reason so failures are diagnosable in the admin UI.
    const message = err instanceof Error ? err.message : 'Upload failed.';
    return NextResponse.json({ error: `Upload failed: ${message}` }, { status: 500 });
  }
}
