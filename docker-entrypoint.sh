#!/bin/sh
# Mounted disks/volumes are often root-owned; fix ownership, then drop to the unprivileged user.
echo "[entrypoint] starting: $*"
mkdir -p "${UPLOAD_DIR:-/data/uploads}"
chown -R node:node "${UPLOAD_DIR:-/data/uploads}" 2>/dev/null || true
exec su-exec node "$@"