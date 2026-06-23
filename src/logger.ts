// All output goes to stderr — stdout is reserved for the MCP protocol (stdio transport).

export type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";

const LEVELS: Record<LogLevel, number> = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };

const configured = (process.env.LOG_LEVEL ?? "INFO").toUpperCase() as LogLevel;
const minLevel = LEVELS[configured] ?? LEVELS.INFO;

function write(level: LogLevel, message: string, meta?: unknown) {
  if (LEVELS[level] < minLevel) return;

  const ts = new Date().toISOString();
  const base = `[${ts}] [${level}] ${message}`;

  if (meta !== undefined) {
    const detail = meta instanceof Error
      ? `${meta.message}${meta.stack ? `\n${meta.stack}` : ""}`
      : JSON.stringify(meta);
    process.stderr.write(`${base} ${detail}\n`);
  } else {
    process.stderr.write(`${base}\n`);
  }
}

export const logger = {
  debug: (msg: string, meta?: unknown) => write("DEBUG", msg, meta),
  info:  (msg: string, meta?: unknown) => write("INFO",  msg, meta),
  warn:  (msg: string, meta?: unknown) => write("WARN",  msg, meta),
  error: (msg: string, meta?: unknown) => write("ERROR", msg, meta),
};
