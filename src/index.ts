#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer } from "node:http";
import { z } from "zod";
import { SabnzbdClient } from "./sabnzbd-client.js";
import { logger } from "./logger.js";

const SABNZBD_URL = process.env.SABNZBD_URL ?? "http://localhost:8080";
const SABNZBD_API_KEY = process.env.SABNZBD_API_KEY ?? "";
const MCP_TRANSPORT = process.env.MCP_TRANSPORT ?? "stdio";
const MCP_PORT = parseInt(process.env.MCP_PORT ?? "3001", 10);
const MCP_HOST = process.env.MCP_HOST ?? "0.0.0.0";

if (!SABNZBD_API_KEY) {
  logger.error("SABNZBD_API_KEY is required");
  process.exit(1);
}

const client = new SabnzbdClient({ baseUrl: SABNZBD_URL, apiKey: SABNZBD_API_KEY });

function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

type ToolHandler<A extends Record<string, unknown>> = (args: A) => Promise<ReturnType<typeof ok>>;

function traced<A extends Record<string, unknown>>(name: string, fn: ToolHandler<A>): ToolHandler<A> {
  return async (args: A) => {
    logger.info(`tool:${name}`, Object.keys(args).length ? args : undefined);
    const start = Date.now();
    try {
      const result = await fn(args);
      logger.debug(`tool:${name} completed (${Date.now() - start}ms)`);
      return result;
    } catch (err) {
      logger.error(`tool:${name} failed (${Date.now() - start}ms)`, err);
      throw err;
    }
  };
}

function buildServer() {
  const server = new McpServer({
    name: "sabnzbd-mcp",
    version: "1.0.0",
  });

  // ── Status & info ──────────────────────────────────────────────────────────

  server.tool(
    "get_status",
    "Get full SABnzbd server status including queue, disk space, speed and settings",
    {},
    traced("get_status", async () => ok(await client.get("fullstatus")))
  );

  server.tool(
    "get_version",
    "Get the SABnzbd version",
    {},
    traced("get_version", async () => ok(await client.get("version")))
  );

  server.tool(
    "get_warnings",
    "Get current SABnzbd warnings and log messages",
    {},
    traced("get_warnings", async () => ok(await client.get("warnings")))
  );

  server.tool(
    "get_categories",
    "Get all configured download categories in SABnzbd",
    {},
    traced("get_categories", async () => ok(await client.get("get_cats")))
  );

  server.tool(
    "get_scripts",
    "Get all configured post-processing scripts in SABnzbd",
    {},
    traced("get_scripts", async () => ok(await client.get("get_scripts")))
  );

  // ── Queue ──────────────────────────────────────────────────────────────────

  server.tool(
    "get_queue",
    "Get the current SABnzbd download queue",
    {
      start: z.number().int().min(0).default(0).describe("Offset to start from"),
      limit: z.number().int().min(1).max(1000).default(100).describe("Max number of items to return"),
    },
    traced("get_queue", async ({ start, limit }) =>
      ok(await client.get("queue", { start, limit })))
  );

  server.tool(
    "pause_queue",
    "Pause all SABnzbd downloads",
    {},
    traced("pause_queue", async () => ok(await client.get("pause")))
  );

  server.tool(
    "resume_queue",
    "Resume all SABnzbd downloads",
    {},
    traced("resume_queue", async () => ok(await client.get("resume")))
  );

  server.tool(
    "pause_post_processing",
    "Pause SABnzbd post-processing (repair, unpack, scripts)",
    {},
    traced("pause_post_processing", async () => ok(await client.get("pause_pp")))
  );

  server.tool(
    "resume_post_processing",
    "Resume SABnzbd post-processing",
    {},
    traced("resume_post_processing", async () => ok(await client.get("resume_pp")))
  );

  server.tool(
    "set_speed_limit",
    "Set the SABnzbd download speed limit. Use 0 for unlimited, a number for KB/s, or append M for MB/s (e.g. '5M')",
    {
      limit: z.string().describe("Speed limit value, e.g. '0' (unlimited), '1000' (KB/s), '5M' (MB/s)"),
    },
    traced("set_speed_limit", async ({ limit }) => ok(await client.get("speedlimit", { name: limit })))
  );

  server.tool(
    "delete_from_queue",
    "Delete one or more items from the SABnzbd queue",
    {
      ids: z.array(z.string()).min(1).describe("List of queue item IDs (nzo_id) to delete"),
      delete_files: z.boolean().default(false).describe("Also delete downloaded files"),
    },
    traced("delete_from_queue", async ({ ids, delete_files }) =>
      ok(
        await client.get("queue", {
          name: "delete",
          value: ids.join(","),
          del_files: delete_files ? 1 : 0,
        })
      ))
  );

  server.tool(
    "set_priority",
    "Set the download priority for a queue item",
    {
      id: z.string().describe("Queue item ID (nzo_id)"),
      priority: z
        .enum(["-2", "-1", "0", "1", "2"])
        .describe("Priority: -2=paused, -1=low, 0=normal, 1=high, 2=force"),
    },
    traced("set_priority", async ({ id, priority }) =>
      ok(await client.get("queue", { name: "priority", value: id, value2: priority })))
  );

  server.tool(
    "change_category",
    "Change the category of a queue item",
    {
      id: z.string().describe("Queue item ID (nzo_id)"),
      category: z.string().describe("Category name"),
    },
    traced("change_category", async ({ id, category }) =>
      ok(await client.get("change_cat", { value: id, value2: category })))
  );

  server.tool(
    "move_in_queue",
    "Move a queue item to a specific position",
    {
      id: z.string().describe("Queue item ID (nzo_id)"),
      position: z.number().int().min(0).describe("Target position (0 = top)"),
    },
    traced("move_in_queue", async ({ id, position }) =>
      ok(await client.get("move", { name: id, value: position })))
  );

  // ── Add downloads ──────────────────────────────────────────────────────────

  server.tool(
    "add_nzb_url",
    "Add an NZB to the SABnzbd queue by URL",
    {
      url: z.string().url().describe("URL of the NZB file"),
      category: z.string().optional().describe("Category to assign"),
      priority: z
        .enum(["-2", "-1", "0", "1", "2"])
        .optional()
        .describe("Priority: -2=paused, -1=low, 0=normal, 1=high, 2=force"),
      script: z.string().optional().describe("Post-processing script name"),
    },
    traced("add_nzb_url", async ({ url, category, priority, script }) => {
      const params: Record<string, string> = { name: url };
      if (category) params.cat = category;
      if (priority) params.priority = priority;
      if (script) params.script = script;
      return ok(await client.get("addurl", params));
    })
  );

  // ── History ────────────────────────────────────────────────────────────────

  server.tool(
    "get_history",
    "Get SABnzbd download history",
    {
      start: z.number().int().min(0).default(0).describe("Offset to start from"),
      limit: z.number().int().min(1).max(1000).default(100).describe("Max number of items to return"),
      failed_only: z.boolean().default(false).describe("Only show failed downloads"),
      search: z.string().optional().describe("Search term to filter history"),
    },
    traced("get_history", async ({ start, limit, failed_only, search }) => {
      const params: Record<string, string | number> = {
        start,
        limit,
        failed_only: failed_only ? 1 : 0,
      };
      if (search) params.search = search;
      return ok(await client.get("history", params));
    })
  );

  server.tool(
    "retry_download",
    "Retry a failed download from history",
    {
      id: z.string().describe("History item ID (nzo_id)"),
      url: z.string().url().optional().describe("Optional new NZB URL to use for the retry"),
    },
    traced("retry_download", async ({ id, url }) => {
      const params: Record<string, string> = { value: id };
      if (url) params.nzbURL = url;
      return ok(await client.get("retry", params));
    })
  );

  server.tool(
    "retry_all_failed",
    "Retry all failed downloads in history",
    {},
    traced("retry_all_failed", async () => ok(await client.get("retry_all")))
  );

  server.tool(
    "delete_history",
    "Delete one or more items from history",
    {
      ids: z.array(z.string()).min(1).describe("List of history item IDs (nzo_id) to delete"),
      delete_files: z.boolean().default(false).describe("Also delete downloaded files"),
    },
    traced("delete_history", async ({ ids, delete_files }) =>
      ok(
        await client.get("history", {
          name: "delete",
          value: ids.join(","),
          del_files: delete_files ? 1 : 0,
        })
      ))
  );

  server.tool(
    "purge_history",
    "Purge all completed downloads from history",
    {
      delete_files: z.boolean().default(false).describe("Also delete the downloaded files"),
    },
    traced("purge_history", async ({ delete_files }) =>
      ok(
        await client.get("history", {
          name: "delete",
          value: "all",
          del_files: delete_files ? 1 : 0,
        })
      ))
  );

  return server;
}

async function main() {
  logger.info("Starting SABnzbd MCP server", {
    transport: MCP_TRANSPORT,
    sabnzbdUrl: SABNZBD_URL,
    logLevel: process.env.LOG_LEVEL ?? "INFO",
  });

  const server = buildServer();

  if (MCP_TRANSPORT === "http") {
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });

    const httpServer = createServer(async (req, res) => {
      if (req.url === "/health") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "ok" }));
        return;
      }

      if (req.url === "/mcp") {
        logger.debug(`HTTP ${req.method} ${req.url}`);
        await transport.handleRequest(req, res);
        return;
      }

      logger.warn(`HTTP 404 ${req.method} ${req.url}`);
      res.writeHead(404);
      res.end();
    });

    await server.connect(transport);

    httpServer.listen(MCP_PORT, MCP_HOST, () => {
      logger.info(`MCP endpoint: http://${MCP_HOST}:${MCP_PORT}/mcp`);
      logger.info(`Health check: http://${MCP_HOST}:${MCP_PORT}/health`);
    });
  } else {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    logger.info("MCP server connected via stdio");
  }
}

main().catch((err) => {
  logger.error("Fatal error", err);
  process.exit(1);
});
