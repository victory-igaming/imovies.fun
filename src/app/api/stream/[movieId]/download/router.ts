import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const M3U8_RE  = /https?:\/\/[^\s"'\\<>]+\.m3u8(?:[^\s"'\\<>]*)/gi;
const MP4_RE   = /https?:\/\/[^\s"'\\<>]+\.(mp4|mkv|webm)(?:[^\s"'\\<>]*)/gi;
const SKIP_RE  = /google|facebook|doubleclick|gstatic|fonts\.|analytics|tracking|recaptcha|cloudflare/i;

function buildSources(mid: string) {
  return [
    { title: "Videasy",   url: `https://player.videasy.net/movie/${mid}` },
    { title: "VidLink",   url: `https://vidlink.pro/movie/${mid}?autoplay=1&player=jw&primaryColor=006fee` },
    { title: "VidSrc v2", url: `https://vidsrc.cc/v2/embed/movie/${mid}?autoPlay=true` },
  ];
}

function extractStreamUrls(text: string): string[] {
  const hits: string[] = [];
  let m: RegExpExecArray | null;
  M3U8_RE.lastIndex = 0;
  while ((m = M3U8_RE.exec(text)) !== null) {
    const url = m[0].replace(/['"\\]+$/, "");
    if (!SKIP_RE.test(url)) hits.push(url);
  }
  if (hits.length === 0) {
    MP4_RE.lastIndex = 0;
    while ((m = MP4_RE.exec(text)) !== null) {
      const url = m[0].replace(/['"\\]+$/, "");
      if (!SKIP_RE.test(url)) hits.push(url);
    }
  }
  return [...new Set(hits)];
}

async function scrapeForStream(url: string, referer: string): Promise<{ streamUrl: string; referer: string } | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, "Referer": referer },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const text = await res.text();
    const hits = extractStreamUrls(text);
    if (hits.length > 0) return { streamUrl: hits[0]!, referer: url };
  } catch { /* ignore */ }
  return null;
}

/**
 * POST /api/stream/[movieId]/download
 * Body: { output?: string }
 *
 * Streams back NDJSON progress events from yt-dlp.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ movieId: string }> },
) {
  const { movieId } = await params;
  const body = await request.json().catch(() => ({})) as { output?: string };
  const output = body.output ?? `${movieId}.mp4`;
  const sources = buildSources(movieId);

  let streamUrl: string | null = null;
  let referer = "";
  let foundSource = "";

  for (const src of sources) {
    const result = await scrapeForStream(src.url, src.url);
    if (result) {
      streamUrl = result.streamUrl;
      referer   = result.referer;
      foundSource = src.title;
      break;
    }
  }

  if (!streamUrl) {
    return NextResponse.json(
      { error: "No raw stream found — try a different source or use the iframe player." },
      { status: 404 },
    );
  }

  const parsedRef  = new URL(referer);
  const origin     = `${parsedRef.protocol}//${parsedRef.host}`;
  const encoder    = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const write = (data: Record<string, unknown>) =>
        controller.enqueue(encoder.encode(JSON.stringify(data) + "\n"));

      write({ type: "log", message: `Source: ${foundSource}` });
      write({ type: "log", message: `Stream: ${streamUrl}` });
      write({ type: "log", message: `Output: ${output}` });

      const proc = spawn("yt-dlp", [
        "--referer",    referer,
        "--add-header", `Origin:${origin}`,
        "-f",           "bestvideo+bestaudio/best",
        "--merge-output-format", "mp4",
        "--concurrent-fragments", "4",
        "--no-warnings",
        "-o", output,
        streamUrl!,
      ]);

      proc.stdout.on("data", (chunk: Buffer) =>
        write({ type: "log", message: chunk.toString() }));
      proc.stderr.on("data", (chunk: Buffer) =>
        write({ type: "log", message: chunk.toString() }));
      proc.on("close", (code) => {
        write({ type: code === 0 ? "done" : "error", code, output });
        controller.close();
      });
      proc.on("error", (err) => {
        write({ type: "error", message: err.message });
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Transfer-Encoding": "chunked",
      "X-Accel-Buffering": "no",
    },
  });
}
