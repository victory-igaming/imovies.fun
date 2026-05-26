// app/api/proxy/route.ts

import { NextRequest, NextResponse } from "next/server";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

/**
 * Decode a URL pathname that was double-encoded.
 * storm.vodvidl.site encodes its path once; when it ends up in our proxy URL
 * it gets encoded again, producing %252F instead of %2F.
 * We must decode once before fetching.
 */
function fixDoubleEncoding(pathname: string): string {
  // Keep decoding while %25 (encoded %) is present
  let prev = pathname;
  let next = decodeURIComponent(pathname);
  while (next !== prev && next.includes("%")) {
    // Stop if decoding would go too far (plain text with no more encoded chars)
    if (!next.includes("%2") && !next.includes("%3") && !next.includes("%5")) break;
    prev = next;
    try { next = decodeURIComponent(next); } catch { break; }
  }
  return prev; // use the last stable decoded form
}

function parseCdnUrl(raw: string): { cleanUrl: string; embeddedHeaders: Record<string, string> } {
  let embeddedHeaders: Record<string, string> = {};
  let cleanUrl = raw;
  try {
    const u = new URL(raw);

    // Extract ?headers= JSON baked into CDN URLs
    const h = u.searchParams.get("headers");
    if (h) {
      try { embeddedHeaders = JSON.parse(decodeURIComponent(h)); } catch {
        try { embeddedHeaders = JSON.parse(h); } catch {}
      }
      u.searchParams.delete("headers");
    }

    // Drop ?host= — never rewrite the host
    u.searchParams.delete("host");

    // Fix double-encoded pathname (storm.vodvidl.site 400 fix)
    if (u.pathname.includes("%25")) {
      u.pathname = fixDoubleEncoding(u.pathname);
    }

    cleanUrl = u.toString();
  } catch {}
  return { cleanUrl, embeddedHeaders };
}

function rewriteM3u8(text: string, baseUrl: string, headersJson: string): string {
  const baseDir = baseUrl.substring(0, baseUrl.lastIndexOf("/") + 1);
  return text.split("\n").map((line) => {
    const t = line.trim();
    if (!t || t.startsWith("#")) return line;

    let abs = t.startsWith("http") ? t
            : t.startsWith("//")   ? "https:" + t
            : baseDir + t;

    try {
      const u = new URL(abs);
      u.searchParams.delete("headers");
      u.searchParams.delete("host");
      if (u.pathname.includes("%25")) u.pathname = fixDoubleEncoding(u.pathname);
      abs = u.toString();
    } catch {}

    return `/api/proxy?url=${encodeURIComponent(abs)}&headers=${encodeURIComponent(headersJson)}`;
  }).join("\n");
}

export async function GET(req: NextRequest) {
  const rawUrl      = req.nextUrl.searchParams.get("url") ?? "";
  const headersJson = req.nextUrl.searchParams.get("headers") ?? "{}";

  if (!rawUrl) return NextResponse.json({ error: "Missing ?url=" }, { status: 400, headers: CORS });

  let captured: Record<string, string> = {};
  try { captured = JSON.parse(headersJson); } catch {}

  const { cleanUrl, embeddedHeaders } = parseCdnUrl(rawUrl);

  let target: URL;
  try { target = new URL(cleanUrl); } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400, headers: CORS });
  }
  if (!["http:", "https:"].includes(target.protocol)) {
    return NextResponse.json({ error: "Only http/https allowed" }, { status: 400, headers: CORS });
  }

  const referer =
    captured["referer"]  ?? captured["Referer"]  ??
    embeddedHeaders["referer"] ?? embeddedHeaders["Referer"] ?? "";
  const origin =
    captured["origin"]   ?? captured["Origin"]   ??
    embeddedHeaders["origin"]  ?? embeddedHeaders["Origin"]  ??
    (referer ? (() => { try { const u = new URL(referer); return `${u.protocol}//${u.host}`; } catch { return ""; } })() : "");

  const fetchHeaders: Record<string, string> = {
    "user-agent":      UA,
    "accept":          "*/*",
    "accept-language": "en-US,en;q=0.9",
  };
  if (referer) fetchHeaders["referer"] = referer;
  if (origin)  fetchHeaders["origin"]  = origin;
  if (captured["cookie"]) fetchHeaders["cookie"] = captured["cookie"];
  if (captured["range"])  fetchHeaders["range"]  = captured["range"];

  try {
    const upstream = await fetch(target.toString(), {
      headers: fetchHeaders,
      signal: AbortSignal.timeout(30_000),
    });

    if (!upstream.ok) {
      console.error(`[proxy] ${upstream.status} ${target.toString().slice(0, 80)}`);
      return new NextResponse(`Upstream ${upstream.status}`, { status: upstream.status, headers: CORS });
    }

    const ct     = upstream.headers.get("content-type") ?? "";
    const isM3u8 = ct.includes("mpegurl") || cleanUrl.includes(".m3u8") || rawUrl.includes(".m3u8");

    if (isM3u8) {
      const text = await upstream.text();
      return new NextResponse(rewriteM3u8(text, cleanUrl, headersJson), {
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

    return new NextResponse(upstream.body, { status: 200, headers: responseHeaders });

  } catch (err) {
    console.error("[proxy] fetch error:", err);
    return new NextResponse("Proxy fetch failed", { status: 502, headers: CORS });
  }
}
