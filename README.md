# Dockside Chat

Next.js 14 (App Router) + Socket.IO + MongoDB. Installable PWA, JWT cookie auth, room-based authorization, file sharing.

## Dev (Docker Compose)
```bash
docker compose up
# open http://localhost:3000  — the first account you register becomes admin
```
Code is bind-mounted, so edits hot-reload. Local MongoDB runs in the `mongo` service.
Test on your phone over the same Wi-Fi at `http://<your-LAN-ip>:3000` (service worker/install needs HTTPS, see prod).

## Prod (single VM + MongoDB Atlas)
1. **Atlas**: create a free M0 cluster → Database Access: add a user → Network Access: allow your VM's public IP → Connect → Drivers → copy the `mongodb+srv://` URI.
2. **DNS**: point an A record for your domain at the VM (ports 80/443 open).
3. On the VM (Docker installed):
```bash
cp .env.example .env     # fill MONGODB_URI, JWT_SECRET (openssl rand -base64 48), DOMAIN
docker compose -f docker-compose.prod.yml up -d --build
```
Caddy fetches the TLS certificate automatically. Open `https://your-domain`, then on your phone: **Share → Add to Home Screen** (iOS) or **Install app** (Android/Chrome).

## What's in it
- **Auth**: bcrypt passwords, 7-day JWT in an httpOnly cookie, login/register rate limiting; Socket.IO handshake uses the same cookie.
- **Authorization**: only room members can read history, join the live channel, upload, or download files. Private rooms need an owner/admin to add you. Owner/admin can delete a room.
- **Files**: stored on the VM volume `uploads` (max `MAX_UPLOAD_MB`, default 25). Served only to room members, with byte-range support (iOS video). Non-media types always download; SVG/HTML are never rendered inline.

## Limits to know
- Single instance only. To scale out you need the Socket.IO Redis adapter + object storage (S3/R2) instead of local disk.
- Back up the `uploads` volume; Atlas backs up the database.
- Push notifications are not included.

## Deploy on Render
1. Push this folder to a GitHub repo.
2. Atlas: create the cluster/user, then Network Access. Render's outbound IPs are listed in the service's Connect menu; allow those, or `0.0.0.0/0` with a strong DB password.
3. Render: **New + > Blueprint**, select the repo (it reads `render.yaml`), paste `MONGODB_URI` when asked.
4. Open the `https://<name>.onrender.com` URL; HTTPS is automatic, so the PWA installs.

Uploads live on the attached disk (`/data/uploads`), which requires a paid instance (Starter). On the Free instance the filesystem is wiped on every restart, deploy, and idle spin-down, so uploaded files would vanish.