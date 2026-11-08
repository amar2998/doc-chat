import { NextResponse } from 'next/server';
import { connectDB, Room } from '@/lib/db';
import { getSession } from '@/lib/auth';

const out = (r, s) => ({
  _id: String(r._id), name: r.name, isPrivate: r.isPrivate,
  joined: r.members.some((m) => String(m) === s.id),
  canManage: String(r.owner) === s.id || s.role === 'admin',
});

export async function GET(req) {
  const s = getSession(req);
  if (!s) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await connectDB();
  const rooms = await Room.find({ $or: [{ isPrivate: false }, { members: s.id }] }).sort({ name: 1 }).lean();
  return NextResponse.json({ rooms: rooms.map((r) => out(r, s)) });
}

export async function POST(req) {
  const s = getSession(req);
  if (!s) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { name = '', isPrivate = false } = await req.json().catch(() => ({}));
  const n = String(name).toLowerCase().trim();
  if (!/^[a-z0-9-]{2,30}$/.test(n)) return NextResponse.json({ error: 'Room name: 2-30 chars, a-z 0-9 -' }, { status: 400 });
  await connectDB();
  try {
    const r = await Room.create({ name: n, owner: s.id, isPrivate: !!isPrivate, members: [s.id] });
    return NextResponse.json({ room: out(r.toObject(), s) });
  } catch (e) {
    if (e.code === 11000) return NextResponse.json({ error: 'Room already exists' }, { status: 409 });
    throw e;
  }
}
