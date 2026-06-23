# SABnzbd MCP

An MCP (Model Context Protocol) server for [SABnzbd](https://sabnzbd.org/) — manage your Usenet downloader through Claude or any MCP-compatible client.

## Features

- **Queue management** — view, pause, resume, delete, reorder and reprioritize downloads
- **History** — browse, search, retry and delete completed/failed downloads
- **Add downloads** — add NZBs by URL with optional category, priority and script
- **Speed control** — set download speed limits on the fly
- **Status & info** — server status, version, warnings, categories and scripts
- **Two transports** — stdio (Claude Desktop) or HTTP (remote clients)

## Tools

| Tool | Description |
|------|-------------|
| `get_status` | Full server status (speed, disk space, queue summary) |
| `get_version` | SABnzbd version |
| `get_warnings` | Current warnings and log messages |
| `get_categories` | All configured categories |
| `get_scripts` | All configured post-processing scripts |
| `get_queue` | Download queue with pagination |
| `pause_queue` | Pause all downloads |
| `resume_queue` | Resume all downloads |
| `pause_post_processing` | Pause post-processing |
| `resume_post_processing` | Resume post-processing |
| `set_speed_limit` | Set download speed limit |
| `delete_from_queue` | Delete items from the queue |
| `set_priority` | Set download priority |
| `change_category` | Change category of a queue item |
| `move_in_queue` | Move item to a specific queue position |
| `add_nzb_url` | Add NZB by URL |
| `get_history` | Download history with search and filtering |
| `retry_download` | Retry a failed download |
| `retry_all_failed` | Retry all failed downloads |
| `delete_history` | Delete history items |
| `purge_history` | Purge all history |

## Quick start

### Docker (HTTP mode)

```bash
docker run -d \
  -e SABNZBD_URL=http://your-sabnzbd:8080 \
  -e SABNZBD_API_KEY=your_api_key \
  -e MCP_TRANSPORT=http \
  -p 3000:3000 \
  ghcr.io/ltmarx/sabnzbd-mcp:latest
```

### Docker Compose

```bash
cp .env.example .env
# edit .env with your SABnzbd URL and API key
docker compose --profile http up -d
```

### Claude Desktop (stdio)

```json
{
  "mcpServers": {
    "sabnzbd": {
      "command": "docker",
      "args": [
        "run", "--rm", "-i",
        "-e", "SABNZBD_URL=http://your-sabnzbd:8080",
        "-e", "SABNZBD_API_KEY=your_api_key",
        "ghcr.io/ltmarx/sabnzbd-mcp:latest"
      ]
    }
  }
}
```

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SABNZBD_URL` | `http://localhost:8080` | SABnzbd base URL |
| `SABNZBD_API_KEY` | *(required)* | SABnzbd API key (Settings → General → API Key) |
| `MCP_TRANSPORT` | `stdio` | Transport mode: `stdio` or `http` |
| `MCP_PORT` | `3000` | HTTP port (only used when `MCP_TRANSPORT=http`) |
| `MCP_HOST` | `0.0.0.0` | HTTP bind host (only used when `MCP_TRANSPORT=http`) |

## Development

```bash
npm install
cp .env.example .env
# edit .env
npm run dev
```
