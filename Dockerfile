FROM node:22-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD sh -c '[ "$MCP_TRANSPORT" != "http" ] || wget -q -O- "http://127.0.0.1:${MCP_PORT:-3001}/health"'

CMD ["node", "dist/index.js"]
