import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import { createReadStream } from 'fs';
import { Readable } from 'stream';
import path from 'path';
import { connectDB, Upload, isMember } from '@/lib/db';
import { getSession } from '@/lib/auth';

const dir = () => process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
// Only render these inline; everything else downloads (blocks stored-XSS via html/svg)
const INLINE = /^(image\/(png|jpe?g|gif|webp|avif)|video\/(mp4|webm|quicktime)|audio\/|application\/pdf)/;

export async function GET(req, { params }) {
  const s = getSession(req);
  if (!s) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await connectDB();
  let up = null;
  try { up = await Upload.findById(params.id).lean(); } catch {}
  if (!up) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!(await isMember(up.room, s.id))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const p = path.join(dir(), up.stored);
  let stat;
  try { stat = await fs.stat(p); } catch { return NextResponse.json({ error: 'File missing' }, { status: 404 }); }

  const inline = INLINE.test(up.mime);
  const headers = {
    'Content-Type': inline ? up.mime : 'application/octet-stream',
    'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(up.name)}`,
    'X-Content-Type-Options': 'nosniff',
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'private, max-age=3600',
  };

  // Byte ranges: iOS Safari needs these to play video/audio
  let start = 0, end = stat.size - 1, status = 200;
  const m = /bytes=(\d*)-(\d*)/.exec(req.headers.get('range') || '');
  if (m && (m[1] || m[2])) {
    if (m[1]) { start = parseInt(m[1], 10); if (m[2]) end = Math.min(parseInt(m[2], 10), end); }
    else { start = Math.max(stat.size - parseInt(m[2], 10), 0); }
    if (start > end || start >= stat.size) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${stat.size}` } });
    status = 206;
    headers['Content-Range'] = `bytes ${start}-${end}/${stat.size}`;
  }
  headers['Content-Length'] = String(end - start + 1);
  return new Response(Readable.toWeb(createReadStream(p, { start, end })), { status, headers });
}
