import { NextResponse } from 'next/server';
import { connectDB, User } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET(req) {
  const s = getSession(req);
  if (!s) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await connectDB();
  const u = await User.findById(s.id).lean();
  if (!u) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json({ user: { id: String(u._id), username: u.username, role: u.role } });
}
