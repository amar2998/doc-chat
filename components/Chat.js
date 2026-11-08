'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { io } from 'socket.io-client';

const fmtSize = (n) => (n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB');
const fmtTime = (d) => new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

function Attachment({ f }) {
  const src = `/api/files/${f.id}`;
  if (/^image\/(png|jpe?g|gif|webp|avif)/.test(f.mime)) return <a href={src} target="_blank" rel="noreferrer"><img src={src} alt={f.name} loading="lazy" className="media" /></a>;
  if (/^video\/(mp4|webm|quicktime)/.test(f.mime)) return <video src={src} controls playsInline preload="metadata" className="media" />;
  if (f.mime.startsWith('audio/')) return <audio src={src} controls preload="metadata" />;
  return <a className="file" href={src} download={f.name}>📄 <span>{f.name}</span><small>{fmtSize(f.size)}</small></a>;
}

export default function Chat({ me }) {
  const router = useRouter();
  const [rooms, setRooms] = useState([]);
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [menu, setMenu] = useState(true);
  const [online, setOnline] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPrivate, setNewPrivate] = useState(false);
  const sock = useRef(null), bottom = useRef(null), fileIn = useRef(null), activeRef = useRef(null);
  activeRef.current = active;

  const loadRooms = useCallback(async () => {
    const r = await fetch('/api/rooms');
    if (r.status === 401) return router.replace('/login');
    if (r.ok) setRooms((await r.json()).rooms);
  }, [router]);

  useEffect(() => { loadRooms(); }, [loadRooms]);

  useEffect(() => {
    const s = io();
    sock.current = s;
    s.on('connect', () => { setOnline(true); if (activeRef.current) s.emit('join', activeRef.current._id); });
    s.on('disconnect', () => setOnline(false));
    s.on('connect_error', (e) => { if (e.message === 'unauthorized') router.replace('/login'); });
    s.on('message', (m) => { if (m.room === activeRef.current?._id) setMessages((p) => [...p, m]); });
    return () => s.disconnect();
  }, [router]);

  useEffect(() => { bottom.current?.scrollIntoView({ block: 'end' }); }, [messages]);

  async function pick(room) {
    if (!room.joined) {
      const r = await fetch(`/api/rooms/${room._id}`, { method: 'POST' });
      if (!r.ok) return alert((await r.json()).error);
      room = { ...room, joined: true };
      loadRooms();
    }
    setActive(room); setMenu(false); setMessages([]);
    sock.current?.emit('join', room._id);
    const r = await fetch(`/api/rooms/${room._id}`);
    if (r.ok) setMessages((await r.json()).messages);
  }

  async function createRoom(e) {
    e.preventDefault();
    const r = await fetch('/api/rooms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newName, isPrivate: newPrivate }) });
    const d = await r.json();
    if (!r.ok) return alert(d.error);
    setNewName(''); setNewPrivate(false); await loadRooms(); pick(d.room);
  }

  const emit = (p) => sock.current.emit('message', { roomId: active._id, ...p }, (res) => res?.error && alert(res.error));

  function send(e) {
    e.preventDefault();
    const t = text.trim();
    if (!t || !active) return;
    emit({ text: t }); setText('');
  }

  async function onFile(e) {
    const f = e.target.files[0]; e.target.value = '';
    if (!f || !active) return;
    setBusy(true);
    const fd = new FormData(); fd.append('room', active._id); fd.append('file', f);
    const r = await fetch('/api/upload', { method: 'POST', body: fd }).catch(() => null);
    setBusy(false);
    const d = await r?.json().catch(() => ({}));
    if (!r?.ok) return alert(d?.error || 'Upload failed');
    emit({ uploadId: d.id, text: text.trim() }); setText('');
  }

  async function addMember() {
    const u = prompt('Add member by username');
    if (!u) return;
    const r = await fetch(`/api/rooms/${active._id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ add: u }) });
    alert(r.ok ? 'Member added' : (await r.json()).error);
  }

  async function delRoom() {
    if (!confirm(`Delete #${active.name} and all its messages and files?`)) return;
    const r = await fetch(`/api/rooms/${active._id}`, { method: 'DELETE' });
    if (!r.ok) return alert((await r.json()).error);
    setActive(null); setMenu(true); loadRooms();
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace('/login');
  }

  const manage = rooms.find((r) => r._id === active?._id)?.canManage;

  return (
    <div className={`app ${menu ? 'show-menu' : ''}`}>
      <aside className="side">
        <header><b>Dockside</b><button className="ghost" onClick={logout}>Log out</button></header>
        <div className="me">@{me.username}{me.role === 'admin' && ' · admin'}</div>
        <ul className="rooms">
          {rooms.map((r) => (
            <li key={r._id} className={active?._id === r._id ? 'on' : ''} onClick={() => pick(r)}>
              <span># {r.name}{r.isPrivate && ' 🔒'}</span>{!r.joined && <em>Join</em>}
            </li>
          ))}
        </ul>
        <form className="newroom" onSubmit={createRoom}>
          <input placeholder="new-room" value={newName} onChange={(e) => setNewName(e.target.value)} required />
          <label><input type="checkbox" checked={newPrivate} onChange={(e) => setNewPrivate(e.target.checked)} /> private</label>
          <button>Create</button>
        </form>
      </aside>

      <main className="main">
        {active ? (
          <>
            <header className="top">
              <button className="ghost back" onClick={() => setMenu(true)}>←</button>
              <b># {active.name}</b><span className={`dot ${online ? 'on' : ''}`} title={online ? 'connected' : 'offline'} />
              <span className="grow" />
              {manage && active.isPrivate && <button className="ghost" onClick={addMember}>+ Member</button>}
              {manage && active.name !== 'general' && <button className="ghost" onClick={delRoom}>Delete</button>}
            </header>
            <div className="msgs">
              {messages.map((m) => (
                <div key={m._id} className={`msg ${m.sender._id === me.id ? 'mine' : ''}`}>
                  <div className="meta">{m.sender._id === me.id ? 'You' : m.sender.username} · {fmtTime(m.createdAt)}</div>
                  {m.file && <Attachment f={m.file} />}
                  {m.text && <div className="txt">{m.text}</div>}
                </div>
              ))}
              <div ref={bottom} />
            </div>
            <form className="composer" onSubmit={send}>
              <input type="file" hidden ref={fileIn} onChange={onFile} />
              <button type="button" className="ghost" disabled={busy} onClick={() => fileIn.current.click()}>{busy ? '…' : '📎'}</button>
              <input placeholder="Message" value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} />
              <button disabled={!online}>Send</button>
            </form>
          </>
        ) : <div className="empty">Pick a room to start chatting</div>}
      </main>
    </div>
  );
}
