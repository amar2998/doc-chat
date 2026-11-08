import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { connectDB, User, Room } from '@/lib/db';
import { attach, limited, ip } from '@/lib/auth';

export async function POST(req) {
  if (limited(`reg:${ip(req)}`, 10, 60 * 60 * 1000)) return NextResponse.json({ error: 'Too many attempts' }, { status: 429 });
  const { username = '', password = '' } = await req.json().catch(() => ({}));
  if (!/^[a-z0-9_]{3,20}$/i.test(username) || String(password).length < 8 || String(password).length > 100)
    return NextResponse.json({ error: 'Username: 3-20 letters/digits/_. Password: 8+ characters.' }, { status: 400 });

  await connectDB();
  const name = username.toLowerCase();
  if (await User.exists({ username: name })) return NextResponse.json({ error: 'Username taken' }, { status: 409 });

  const isFirst = (await User.estimatedDocumentCount()) === 0; // first user becomes admin
  const user = await User.create({ username: name, passwordHash: await bcrypt.hash(password, 12), role: isFirst ? 'admin' : 'user' });

  const general = await Room.findOneAndUpdate(
    { name: 'general' },
    { $setOnInsert: { name: 'general', owner: user._id }, $addToSet: { members: user._id } },
    { upsert: true, new: true },
  );
  return attach(NextResponse.json({ user: { id: String(user._id), username: name, role: user.role }, room: String(general._id) }), user);
}
