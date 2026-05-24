// app/api/proxy/route.ts
// Proxies HLS m3u8 + segments using the exact headers captured from the browser.
// Handles ?headers=JSON and ?host= params embedded in CDN segment URLs.

import { NextRequest, NextResponse } from "next/server";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

// Strip ?headers= and ?host= from a CDN URL, return the clean URL + any embedded headers
function parseCdnUrl(raw: string): { cleanUrl: string; embeddedHeaders: Record<string, string> } {
  let embeddedHeaders: Record<string, string> = {};
  let cleanUrl = raw;
  try {
    const u = new URL(raw);
    const h = u.searchParams.get("headers");
    if (h) {
      try { embeddedHeaders = JSON.parse(decodeURIComponent(h)); } catch {
        try { embeddedHeaders = JSON.parse(h); } catch {}
      }
      u.searchParams.delete("headers");
    }
    // Remove ?host= — keep original host, don't redirect
    u.searchParams.delete("host");
    cleanUrl = u.toString();
  } catch {}
  return { cleanUrl, embeddedHeaders };
}

function rewriteM3u8(text: string, baseUrl: string, headersJson: string): string {
  const baseDir = baseUrl.substring(0, baseUrl.lastIndexOf("/") + 1);
  return text.split("\n").map((line) => {
    const t = line.trim();
    if (!t || t.startsWith("#")) return line;
    let abs = t.startsWith("http") ? t : t.startsWith("//") ? "https:" + t : baseDir + t;
    // Strip embedded params from segment URLs before proxying
    try { const u = new URL(abs); u.searchParams.delete("headers"); u.searchParams.delete("host"); abs = u.toString(); } catch {}
    return `/api/proxy?url=${encodeURIComponent(abs)}&headers=${encodeURIComponent(headersJson)}`;
  }).join("\n");
}

export async function GET(req: NextRequest) {
  const rawUrl      = req.nextUrl.searchParams.get("url") ?? "";
  const headersJson = req.nextUrl.searchParams.get("headers") ?? "{}";

  if (!rawUrl) return NextResponse.json({ error: "Missing ?url=" }, { status: 400 });

  // Parse captured browser headers
  let captured: Record<string, string> = {};
  try { captured = JSON.parse(headersJson); } catch {}

  // Parse CDN-embedded headers and clean the URL
  const { cleanUrl, embeddedHeaders } = parseCdnUrl(rawUrl);

  // Merge: captured browser headers take priority, then embedded, then defaults
  const fetchHeaders: Record<string, string> = {
    "referer":         captured["referer"]  ?? captured["Referer"]  ?? embeddedHeaders["referer"]  ?? embeddedHeaders["Referer"]  ?? "",
    "origin":          captured["origin"]   ?? captured["Origin"]   ?? embeddedHeaders["origin"]   ?? embeddedHeaders["Origin"]   ?? "",
    "user-agent":      UA,
    "accept":          "*/*",
    "accept-language": "en-US,en;q=0.9",
  };

  // Forward cookies if present
  if (captured["cookie"]) fetchHeaders["cookie"] = captured["cookie"];

  // Remove empty values and hop-by-hop headers
  (["host", "connection", "content-length", "transfer-encoding"] as const).forEach(k => delete fetchHeaders[k]);
  Object.keys(fetchHeaders).forEach(k => { if (!fetchHeaders[k]) delete fetchHeaders[k]; });

  try {
    const upstream = await fetch(cleanUrl, { headers: fetchHeaders });

    if (!upstream.ok) {
      console.error(`[proxy] ${upstream.status} ${cleanUrl}`);
      return new NextResponse(`Upstream ${upstream.status}`, { status: upstream.status });
    }

    const ct     = upstream.headers.get("content-type") ?? "";
    const isM3u8 = ct.includes("mpegurl") || cleanUrl.includes(".m3u8") || rawUrl.includes(".m3u8");

    if (isM3u8) {
      const text = await upstream.text();
      return new NextResponse(rewriteM3u8(text, cleanUrl, headersJson), {
        status: 200,
        headers: {
          "Content-Type":                "application/vnd.apple.mpegurl",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control":               "no-store",
        },
      });
    }

    const body = await upstream.arrayBuffer();
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type":                ct || "video/mp2t",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control":               "public, max-age=3600",
      },
    });

  } catch (err) {
    console.error("[proxy] fetch error:", err);
    return new NextResponse("Proxy fetch failed", { status: 502 });
  }
}