/**
 * Parse PROXY_LIST / PROXY_URL from env.
 * Supports comma OR newline separated entries.
 * Webshare format: host:port:user:pass  OR  http://user:pass@host:port
 */

export function parseProxyList(raw: string): string[] {
  if (!raw) return [];
  return raw
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((entry) => {
      if (entry.startsWith("http://") || entry.startsWith("https://")) return entry;
      const parts = entry.split(":");
      if (parts.length === 4) {
        const [host, port, user, pass] = parts;
        return `http://${user}:${pass}@${host}:${port}`;
      }
      if (parts.length === 2) return `http://${entry}`;
      return entry;
    });
}

let _lastProxyIdx = -1;

export function pickProxy(pool: string[], avoidRandom = false): string {
  if (pool.length === 0) return "";
  if (pool.length === 1) return pool[0]!;
  if (!avoidRandom) return pool[Math.floor(Math.random() * pool.length)]!;

  let idx: number;
  do { idx = Math.floor(Math.random() * pool.length); }
  while (idx === _lastProxyIdx && pool.length > 1);
  _lastProxyIdx = idx;
  return pool[idx]!;
}

export function maskProxy(url: string): string {
  return url.replace(/:([^@]+)@/, ":***@");
}
