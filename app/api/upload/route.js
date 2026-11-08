import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { connectDB, Upload, isMember } from '@/lib/db';
import { getSession, limited } from '@/lib/auth';

const MAX = (parseInt(process.env.MAX_UPLOAD_MB, 10) || 25) * 1024 * 1024;
const dir = () => process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
const err = (m, status) => NextResponse.json({ error: m }, { status });

export async function POST(req) {
  const s = getSession(req);
  if (!s) return err('Unauthorized', 401);
  if (limited(`up:${s.id}`, 20, 60 * 1000)) return err('Too many uploads', 429);

  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  const roomId = form?.get('room');
  if (!file || typeof file === 'string' || !roomId) return err('Bad request', 400);
  if (file.size > MAX) return err(`File too large (max ${MAX / 1024 / 1024} MB)`, 413);

  await connectDB();
  if (!(await isMember(roomId, s.id))) return err('Forbidden', 403);

  const ext = path.extname(file.name || '').toLowerCase().replace(/[^a-z0-9.]/g, '').slice(0, 10);
  const stored = crypto.randomUUID() + ext;
  await fs.mkdir(dir(), { recursive: true });
  await fs.writeFile(path.join(dir(), stored), Buffer.from(await file.arrayBuffer()));

  const name = (file.name || 'file').replace(/[\r\n"\\/]/g, '_').slice(0, 120);
  const up = await Upload.create({ owner: s.id, room: roomId, stored, name, mime: file.type || 'application/octet-stream', size: file.size });
  return NextResponse.json({ id: String(up._id), name, mime: up.mime, size: up.size });
}
