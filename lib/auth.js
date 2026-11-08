const jwt = require('jsonwebtoken');
const COOKIE = 'token';
const MAX_AGE = 7 * 24 * 3600;

const secret = () => {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is not set');
  return process.env.JWT_SECRET;
};
const sign = (u) => jwt.sign({ id: String(u._id), username: u.username, role: u.role }, secret(), { expiresIn: MAX_AGE });
const verify = (t) => { try { return t ? jwt.verify(t, secret()) : null; } catch { return null; } };

// Works with NextRequest
const getSession = (req) => verify(req.cookies.get(COOKIE)?.value);

// Set the session cookie on a NextResponse
function attach(res, user) {
  res.cookies.set(COOKIE, sign(user), {
    httpOnly: true, sameSite: 'lax', path: '/', maxAge: MAX_AGE,
    secure: process.env.COOKIE_SECURE === 'true',
  });
  return res;
}

// Tiny in-memory sliding-window rate limiter (single instance)
const hits = global._hits || (global._hits = new Map());
function limited(key, max = 10, windowMs = 15 * 60 * 1000) {
  const now = Date.now();
  const a = (hits.get(key) || []).filter((t) => now - t < windowMs);
  a.push(now);
  hits.set(key, a);
  return a.length > max;
}
const clearLimit = (key) => hits.delete(key);
const ip = (req) => req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'local';

module.exports = { COOKIE, sign, verify, getSession, attach, limited, clearLimit, ip };
