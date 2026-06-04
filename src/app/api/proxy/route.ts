// app/api/proxy/route.ts

import { NextRequest, NextResponse } from "next/server";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const BLOCKED_CDN_HOSTS = ["stormvv.vodvidl.site", "vodvidl.site", "hakunaymatata.com"];

// ── Proxy on/off switch ───────────────────────────────────────────────────────
// PROXY_ENABLED=false  → direct fetch, no proxy  (local dev)
// PROXY_ENABLED=true   → route through PROXY_LIST (production server)
const PROXY_ENABLED = process.env.PROXY_ENABLED !== "false";

function isBlockedHost(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return BLOCKED_CDN_HOSTS.some((b) => host === b || host.endsWith("." + b));
  } catch { return false; }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

// ── URL parser ────────────────────────────────────────────────────────────────
function parseCdnUrl(raw: string): {
  cleanUrl: string;
  embeddedHeaders: Record<string, string>;
  embeddedProxy: string;
} {
  let embeddedHeaders: Record<string, string> = {};
  let embeddedProxy = "";

  const qIdx     = raw.indexOf("?");
  const rawPath  = qIdx === -1 ? raw : raw.slice(0, qIdx);
  const rawQuery = qIdx === -1 ? ""  : raw.slice(qIdx + 1);

  const keepParams: string[] = [];
  for (const seg of rawQuery.split("&")) {
    if (!seg) continue;
    const eq  = seg.indexOf("=");
    const key = eq === -1 ? seg : seg.slice(0, eq);
    const val = eq === -1 ? ""  : seg.slice(eq + 1);

    if (key === "headers") {
      try { embeddedHeaders = JSON.parse(decodeURIComponent(val)); } catch {
        try { embeddedHeaders = JSON.parse(val); } catch {}
      }
    } else if (key === "proxy") {
      try { embeddedProxy = decodeURIComponent(val); } catch { embeddedProxy = val; }
    } else if (key === "host") {
      // drop
    } else {
      keepParams.push(seg);
    }
  }

  const cleanPath = rawPath.replace(/%25([0-9A-Fa-f]{2})/g, "%$1");

  if (!cleanPath.startsWith("http://") && !cleanPath.startsWith("https://")) {
    return {
      cleanUrl: keepParams.length > 0 ? `${rawPath}?${keepParams.join("&")}` : rawPath,
      embeddedHeaders, embeddedProxy,
    };
  }

  const cleanUrl = keepParams.length > 0
    ? `${cleanPath}?${keepParams.join("&")}`
    : cleanPath;

  return { cleanUrl, embeddedHeaders, embeddedProxy };
}

// ── M3U8 rewriter ─────────────────────────────────────────────────────────────
function rewriteM3u8(text: string, baseUrl: string, headersJson: string, proxyParam: string): string {
  const noQuery = baseUrl.split("?")[0]!;
  const baseDir = noQuery.substring(0, noQuery.lastIndexOf("/") + 1);
  const proxyQ  = proxyParam ? `&proxy=${encodeURIComponent(proxyParam)}` : "";

  return text.split("\n").map((line) => {
    const t = line.trim();
    if (!t || t.startsWith("#")) return line;

    let abs: string;
    if (t.startsWith("http://") || t.startsWith("https://")) { abs = t; }
    else if (t.startsWith("//")) { abs = "https:" + t; }
    else { abs = baseDir + t; }

    const { cleanUrl } = parseCdnUrl(abs);
    abs = cleanUrl;

    if (isBlockedHost(abs)) return line;

    return `/api/proxy?url=${encodeURIComponent(abs)}&headers=${encodeURIComponent(headersJson)}${proxyQ}`;
  }).join("\n");
}

// ── Proxy pool ────────────────────────────────────────────────────────────────
function parseProxyPool(raw: string): string[] {
  if (!raw) return [];
  return raw.split(/[\n,]+/).map((s: string) => s.trim()).filter(Boolean).map((entry) => {
    if (entry.startsWith("http://") || entry.startsWith("https://")) return entry;
    const parts = entry.split(":");
    if (parts.length === 4) {
      const [host, port, user, pass] = parts;
      return `http://${user}:${pass}@${host}:${port}`;
    }
    return entry;
  });
}

const PROXY_POOL: string[] = PROXY_ENABLED
  ? parseProxyPool(process.env.PROXY_LIST ?? process.env.PROXY_URL ?? "")
  : [];

function pickProxy(override?: string, exclude?: string): string {
  if (!PROXY_ENABLED) return "";
  if (override && override !== exclude) return override;
  if (PROXY_POOL.length === 0) return "";
  const candidates = exclude ? PROXY_POOL.filter(p => p !== exclude) : PROXY_POOL;
  if (candidates.length === 0) return PROXY_POOL[Math.floor(Math.random() * PROXY_POOL.length)]!;
  return candidates[Math.floor(Math.random() * candidates.length)]!;
}

async function buildFetcher(
  proxyUrl: string,
): Promise<(url: string, init: RequestInit) => Promise<Response>> {
  if (!proxyUrl) return (url, init) => fetch(url, init);
  try {
    const undici = await import("undici");
    const agent  = new undici.ProxyAgent(proxyUrl);
    return (url, init) =>
      undici.fetch(url, { ...(init as any), dispatcher: agent }) as unknown as Promise<Response>;
  } catch {
    console.warn("[proxy] undici unavailable, fetching without proxy");
    return (url, init) => fetch(url, init);
  }
}

function is429Abort(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message + ((err.cause instanceof Error) ? " " + err.cause.message : "");
  return msg.includes("429") || (err as any)?.cause?.message?.includes("429");
}

const SKIP_HEADERS = new Set([
  "access-control-request-headers",
  "access-control-request-method",
  "sec-fetch-mode", "sec-fetch-site", "sec-fetch-dest",
]);

// ── GET handler ───────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const rawUrl      = req.nextUrl.searchParams.get("url") ?? "";
  const headersJson = req.nextUrl.searchParams.get("headers") ?? "{}";

  if (!rawUrl) {
    return NextResponse.json({ error: "Missing ?url=" }, { status: 400, headers: CORS });
  }

  let captured: Record<string, string> = {};
  try { captured = JSON.parse(headersJson); } catch {}

  const { cleanUrl, embeddedHeaders, embeddedProxy } = parseCdnUrl(rawUrl);

  if (!cleanUrl.startsWith("http://") && !cleanUrl.startsWith("https://")) {
    return NextResponse.json({ error: "Only http/https allowed" }, { status: 400, headers: CORS });
  }
  if (isBlockedHost(cleanUrl)) {
    return new NextResponse("CDN not proxiable", { status: 403, headers: CORS });
  }

  const referer =
    captured["referer"] ?? captured["Referer"] ??
    embeddedHeaders["referer"] ?? embeddedHeaders["Referer"] ?? "";
  const origin =
    captured["origin"] ?? captured["Origin"] ??
    embeddedHeaders["origin"] ?? embeddedHeaders["Origin"] ??
    (referer ? (() => { try { const u = new URL(referer); return `${u.protocol}//${u.host}`; } catch { return ""; } })() : "");

  const fetchHeaders: Record<string, string> = {
    "user-agent": UA, "accept": "*/*", "accept-language": "en-US,en;q=0.9",
  };
  if (referer)            fetchHeaders["referer"] = referer;
  if (origin)             fetchHeaders["origin"]  = origin;
  if (captured["cookie"]) fetchHeaders["cookie"]  = captured["cookie"];
  const rangeHeader = req.headers.get("range");
  if (rangeHeader)            fetchHeaders["range"] = rangeHeader;
  else if (captured["range"]) fetchHeaders["range"] = captured["range"];

  for (const key of Object.keys(fetchHeaders)) {
    if (SKIP_HEADERS.has(key.toLowerCase())) delete fetchHeaders[key];
  }

  const fetchInit: RequestInit = { headers: fetchHeaders, signal: AbortSignal.timeout(30_000) };

  const MAX_ATTEMPTS = PROXY_ENABLED ? 2 : 1;
  let lastProxy = "";

  if (!PROXY_ENABLED) {
    console.log("[proxy] PROXY_ENABLED=false — direct fetch (no proxy)");
  }

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const proxyUrl      = pickProxy(embeddedProxy, attempt > 1 ? lastProxy : undefined);
    lastProxy           = proxyUrl;
    const upstreamFetch = await buildFetcher(proxyUrl);

    try {
      const upstream = await upstreamFetch(cleanUrl, fetchInit);

      if (upstream.status === 429) {
        console.warn(`[proxy] 429 attempt ${attempt}`);
        if (attempt < MAX_ATTEMPTS) continue;
        return new NextResponse("Upstream 429", { status: 429, headers: CORS });
      }
      if (!upstream.ok) {
        console.error(`[proxy] ${upstream.status} for ${cleanUrl.slice(0, 100)}`);
        return new NextResponse(`Upstream ${upstream.status}`, { status: upstream.status, headers: CORS });
      }

      const ct     = upstream.headers.get("content-type") ?? "";
      const isM3u8 = ct.includes("mpegurl") || cleanUrl.includes(".m3u8") || rawUrl.includes(".m3u8");

      if (isM3u8) {
        const text = await upstream.text();
        return new NextResponse(rewriteM3u8(text, cleanUrl, headersJson, embeddedProxy), {
          status: 200,
          headers: { ...CORS, "Content-Type": "application/vnd.apple.mpegurl", "Cache-Control": "no-store" },
        });
      }

      const responseHeaders: Record<string, string> = { ...CORS };
      for (const h of ["content-type","content-length","content-range","accept-ranges","cache-control","last-modified","etag"]) {
        const v = upstream.headers.get(h);
        if (v) responseHeaders[h] = v;
      }
      if (!responseHeaders["content-type"]) responseHeaders["content-type"] = "video/mp2t";

      const status = upstream.status === 206 ? 206 : 200;
      return new NextResponse(upstream.body, { status, headers: responseHeaders });

    } catch (err) {
      if (is429Abort(err) && attempt < MAX_ATTEMPTS) { continue; }
      console.error("[proxy] fetch error:", err);
      return new NextResponse("Proxy fetch failed", { status: 502, headers: CORS });
    }
  }

  return new NextResponse("Proxy failed after retries", { status: 502, headers: CORS });
}