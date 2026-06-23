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

    const res = await fetch(url.toString());
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      throw new Error(`${res.status} ${res.statusText}: ${text}`);
    }

    const data = await res.json() as Record<string, unknown>;

    if (data.status === false) {
      throw new Error(`SABnzbd error: ${data.error ?? "unknown error"}`);
    }

    return data as T;
  }

  get<T>(mode: string, params?: Record<string, string | number | boolean>) {
    return this.request<T>(mode, params);
  }

  post<T>(mode: string, params?: Record<string, string | number | boolean>) {
    return this.request<T>(mode, params);
  }
}
