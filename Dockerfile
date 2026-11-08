FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache su-exec
ENV NODE_ENV=production PORT=3000 UPLOAD_DIR=/data/uploads
COPY --from=build /app ./
RUN mkdir -p /data/uploads && chown -R node:node /app
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://localhost:${PORT}/api/health || exit 1
ENTRYPOINT ["sh", "/app/docker-entrypoint.sh"]
CMD ["node", "server.js"]