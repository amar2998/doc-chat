import { NextResponse } from 'next/server';
import { Readable } from 'stream';
import { connectDB, Upload, isMember } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { get } from '@/lib/storage';

// Only render these inline; everything else downloads (blocks stored-XSS via html/svg)
const INLINE = /^(image\/(png|jpe?g|gif|webp|avif)|video\/(mp4|webm|quicktime)|audio\/|application\/pdf)/;

export async function GET(req, { params }) {
  const s = getSession(req);
  if (!s) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await connectDB();
  let up = null;
  try { up = await Upload.findById(params.id).lean(); } catch { }
  if (!up) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!(await isMember(up.room, s.id))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let f;
  try {
    f = await get(up.stored, req.headers.get('range'));
  } catch (e) {
    if (e.code === 'NOT_FOUND') return NextResponse.json({ error: 'File missing' }, { status: 404 });
    if (e.code === 'RANGE') return new Response(null, { status: 416, headers: e.total ? { 'Content-Range': `bytes */${e.total}` } : {} });
    console.error('storage get failed', e);
    return NextResponse.json({ error: 'Storage error' }, { status: 502 });
  }

  const inline = INLINE.test(up.mime);
  const headers = {
    'Content-Type': inline ? up.mime : 'application/octet-stream',
    'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(up.name)}`,
    'X-Content-Type-Options': 'nosniff',
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'private, max-age=3600',
    'Content-Length': String(f.length),
  };
  if (f.contentRange) headers['Content-Range'] = f.contentRange;
  return new Response(Readable.toWeb(f.stream), { status: f.status, headers });
}