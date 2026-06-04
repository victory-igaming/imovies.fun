import { NextRequest } from "next/server";

const CMS_URL = process.env.NEXT_PUBLIC_CMS_URL?.replace(/\/$/, "");

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");

  if (!url) {
    return new Response("Missing video URL", { status: 400 });
  }

  if (!CMS_URL || !url.startsWith(CMS_URL)) {
    return new Response("Invalid video URL", { status: 403 });
  }

  const range = req.headers.get("range");

  const res = await fetch(url, {
    headers: range ? { Range: range } : {},
  });

  return new Response(res.body, {
    status: res.status,
    headers: {
      "Content-Type": res.headers.get("content-type") || "video/mp4",
      "Accept-Ranges": "bytes",
      ...(res.headers.get("content-length")
        ? { "Content-Length": res.headers.get("content-length")! }
        : {}),
      ...(res.headers.get("content-range")
        ? { "Content-Range": res.headers.get("content-range")! }
        : {}),
      "Cache-Control": "no-store",
    },
  });
}
