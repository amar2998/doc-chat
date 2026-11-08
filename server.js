// Custom server: Next.js + Socket.IO on one port (single-VM friendly)
const { createServer } = require('http');
const next = require('next');
const { Server } = require('socket.io');
const { connectDB, Room, Message, Upload, isMember, shape } = require('./lib/db');
const { verify, limited, COOKIE } = require('./lib/auth');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

const cookieVal = (h = '', n) => {
  const p = h.split(';').map((s) => s.trim()).find((s) => s.startsWith(n + '='));
  return p ? decodeURIComponent(p.slice(n.length + 1)) : null;
};

app.prepare().then(async () => {
  await connectDB();
  const server = createServer((req, res) => handle(req, res));
  const io = new Server(server);

  // Authentication: JWT from the httpOnly cookie
  io.use((socket, nextFn) => {
    const user = verify(cookieVal(socket.handshake.headers.cookie, COOKIE));
    if (!user) return nextFn(new Error('unauthorized'));
    socket.user = user;
    nextFn();
  });

  io.on('connection', (socket) => {
    const user = socket.user;

    // Authorization: only room members can join the live channel
    socket.on('join', async (roomId, ack) => {
      if (!(await isMember(roomId, user.id))) return ack?.({ error: 'Not a member' });
      socket.join(roomId);
      ack?.({ ok: true });
    });

    socket.on('message', async ({ roomId, text = '', uploadId } = {}, ack) => {
      try {
        if (limited(`msg:${user.id}`, 30, 10000)) return ack?.({ error: 'Slow down' });
        text = String(text).trim().slice(0, 2000);
        if (!text && !uploadId) return ack?.({ error: 'Empty message' });
        if (!(await isMember(roomId, user.id))) return ack?.({ error: 'Not a member' });

        let file;
        if (uploadId) {
          const up = await Upload.findOne({ _id: uploadId, owner: user.id, room: roomId });
          if (!up) return ack?.({ error: 'Unknown upload' });
          file = { upload: up._id, name: up.name, mime: up.mime, size: up.size };
        }
        const msg = await Message.create({ room: roomId, sender: user.id, text, file });
        io.to(roomId).emit('message', shape({ ...msg.toObject(), sender: { _id: user.id, username: user.username } }));
        ack?.({ ok: true });
      } catch (e) {
        console.error(e);
        ack?.({ error: 'Failed to send' });
      }
    });
  });

  const port = parseInt(process.env.PORT || '3000', 10);
  server.listen(port, '0.0.0.0', () => console.log(`> Ready on :${port} (${dev ? 'dev' : 'prod'})`));
});
