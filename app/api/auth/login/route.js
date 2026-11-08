import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { connectDB, User } from '@/lib/db';
import { attach, limited, clearLimit, ip } from '@/lib/auth';

export async function POST(req) {
  const { username = '', password = '' } = await req.json().catch(() => ({}));
  const name = String(username).toLowerCase();
  const key = `login:${ip(req)}:${name}`;
  if (limited(key)) return NextResponse.json({ error: 'Too many attempts, try again later' }, { status: 429 });

  await connectDB();
  const user = await User.findOne({ username: name });
  const ok = user && (await bcrypt.compare(String(password), user.passwordHash));
  if (!ok) return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });

  clearLimit(key);
  return attach(NextResponse.json({ user: { id: String(user._id), username: name, role: user.role } }), user);
}
