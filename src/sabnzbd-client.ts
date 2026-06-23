import { logger } from "./logger.js";

export interface SabnzbdConfig {
  baseUrl: string;
  apiKey: string;
}

export class SabnzbdClient {
  constructor(private config: SabnzbdConfig) {}

  async request<T>(mode: string, params: Record<string, string | number | boolean> = {}): Promise<T> {
    const url = new URL(`${this.config.baseUrl}/api`);
    url.searchParams.set("mode", mode);
    url.searchParams.set("apikey", this.config.apiKey);
    url.searchParams.set("output", "json");

    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, String(value));
    }

    // Log without exposing the API key
    logger.debug(`SABnzbd → mode=${mode}`, Object.keys(params).length ? params : undefined);

    const start = Date.now();
    let res: Response;

    try {
      res = await fetch(url.toString());
    } catch (err) {
      logger.error(`SABnzbd request failed (mode=${mode})`, err);
      throw err;
    }

    const elapsed = Date.now() - start;

    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      logger.error(`SABnzbd HTTP ${res.status} (mode=${mode}, ${elapsed}ms)`, text);
      throw new Error(`${res.status} ${res.statusText}: ${text}`);
    }

    const data = await res.json() as Record<string, unknown>;

    if (data.status === false) {
      const msg = `SABnzbd error: ${data.error ?? "unknown error"}`;
      logger.error(`SABnzbd API error (mode=${mode}, ${elapsed}ms)`, data.error);
      throw new Error(msg);
    }

    logger.debug(`SABnzbd ← mode=${mode} (${elapsed}ms)`);
    return data as T;
  }

  get<T>(mode: string, params?: Record<string, string | number | boolean>) {
    return this.request<T>(mode, params);
  }

  post<T>(mode: string, params?: Record<string, string | number | boolean>) {
    return this.request<T>(mode, params);
  }
}
