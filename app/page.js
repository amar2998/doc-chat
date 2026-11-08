'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Chat from '@/components/Chat';

export default function Home() {
  const router = useRouter();
  const [me, setMe] = useState(null);
  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => (d ? setMe(d.user) : router.replace('/login')))
      .catch(() => router.replace('/login'));
  }, [router]);
  return me ? <Chat me={me} /> : <div className="empty">Loading…</div>;
}
