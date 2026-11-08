import { NextResponse } from 'next/server';
import { connectDB, Room, User, Message, Upload, isMember, shape } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { remove } from '@/lib/storage';

const err = (m, status) => NextResponse.json({ error: m }, { status });

async function load(req, id) {
  const s = getSession(req);
  if (!s) return { res: err('Unauthorized', 401) };
  await connectDB();
  let room = null;
  try { room = await Room.findById(id); } catch { }
  if (!room) return { res: err('Not found', 404) };
  return { s, room, manage: String(room.owner) === s.id || s.role === 'admin' };
}

// Message history (members only)
export async function GET(req, { params }) {
  const { s, room, res } = await load(req, params.id);
  if (res) return res;
  if (!(await isMember(room._id, s.id))) return err('Forbidden', 403);
  const before = req.nextUrl.searchParams.get('before');
  const q = { room: room._id, ...(before ? { _id: { $lt: before } } : {}) };
  const msgs = await Message.find(q).sort({ _id: -1 }).limit(50).populate('sender', 'username').lean();
  return NextResponse.json({ messages: msgs.reverse().map(shape) });
}

// Join a public room
export async function POST(req, { params }) {
  const { room, s, res } = await load(req, params.id);
  if (res) return res;
  if (room.isPrivate) return err('Private room: ask the owner to add you', 403);
  await Room.updateOne({ _id: room._id }, { $addToSet: { members: s.id } });
  return NextResponse.json({ ok: true });
}

// Owner/admin adds a member by username
export async function PUT(req, { params }) {
  const { room, manage, res } = await load(req, params.id);
  if (res) return res;
  if (!manage) return err('Forbidden', 403);
  const { add = '' } = await req.json().catch(() => ({}));
  const u = await User.findOne({ username: String(add).toLowerCase().trim() });
  if (!u) return err('User not found', 404);
  await Room.updateOne({ _id: room._id }, { $addToSet: { members: u._id } });
  return NextResponse.json({ ok: true });
}

// Owner/admin deletes the room, its messages and files
export async function DELETE(req, { params }) {
  const { room, manage, res } = await load(req, params.id);
  if (res) return res;
  if (!manage) return err('Forbidden', 403);
  if (room.name === 'general') return err('The general room cannot be deleted', 400);
  const ups = await Upload.find({ room: room._id }).lean();
  await Promise.all(ups.map((u) => remove(u.stored)));
  await Promise.all([Upload.deleteMany({ room: room._id }), Message.deleteMany({ room: room._id }), Room.deleteOne({ _id: room._id })]);
  return NextResponse.json({ ok: true });
}