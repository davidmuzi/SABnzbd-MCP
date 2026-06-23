# SABnzbd MCP — development notes

## Stack
- TypeScript (ES2022, Node16 modules)
- `@modelcontextprotocol/sdk` for MCP server
- `zod` for input validation
- Docker multi-stage build (node:22-alpine)

## Commands
```bash
npm install       # install dependencies
npm run dev       # run with tsx (hot-reload, reads .env)
npm run build     # compile to dist/
npm start         # run compiled output
```

## Project structure
```
src/
  index.ts            # MCP server, tool registration, transport setup
  sabnzbd-client.ts   # SABnzbd HTTP API client
```

## SABnzbd API
All calls go to `GET /api?mode=<mode>&apikey=<key>&output=json`.
The client lives in `src/sabnzbd-client.ts` and wraps this pattern.

## Adding tools
Register new tools in `src/index.ts` inside `buildServer()` using `server.tool(name, description, zodSchema, handler)`.
Check the SABnzbd API docs at https://sabnzbd.org/wiki/advanced/api for available modes.

## Transports
- `MCP_TRANSPORT=stdio` — default, for Claude Desktop
- `MCP_TRANSPORT=http` — persistent server on `MCP_HOST:MCP_PORT/mcp`, health at `/health`
