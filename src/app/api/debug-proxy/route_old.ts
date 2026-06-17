// src/app/api/debug-proxy/route.ts
// Visit /api/debug-proxy to diagnose proxy + playwright

import { NextResponse } from "next/server";
import { chromium }     from "playwright";
import * as http        from "http";
import * as https       from "https";
import * as net         from "net";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const BROWSER_ARGS = [
  "--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage",
  "--disable-gpu", "--disable-blink-features=AutomationControlled",
  "--disable-web-security", "--ignore-certificate-errors",
  `--user-agent=${UA}`,
];

// ── Parse first proxy entry from PROXY_LIST ───────────────────────────────────
function parseFirstProxy(raw: string): { url: string; host: string; port: number; user: string; pass: string } | null {
  const entry = raw.split(/[\n,]+/).map(s => s.trim()).filter(Boolean)[0] ?? "";
  if (!entry) return null;

  if (entry.startsWith("http://") || entry.startsWith("https://")) {
    try {
      const u = new URL(entry);
      return {
        url:  entry,
        host: u.hostname,
        port: parseInt(u.port) || 80,
        user: u.username,
        pass: u.password,
      };
    } catch { return null; }
  }

  const parts = entry.split(":");
  if (parts.length === 4) {
    const [host, port, user, pass] = parts;
    return {
      url:  `http://${user}:${pass}@${host}:${port}`,
      host, port: parseInt(port), user, pass,
    };
  }
  return null;
}

// ── Test proxy using raw TCP CONNECT tunnel (avoids undici compatibility) ─────
function testProxyTunnel(proxy: { host: string; port: number; user: string; pass: string }): Promise<{
  ok: boolean; tunnelMs: number; fetchMs?: number; ip?: string; error?: string;
}> {
  return new Promise((resolve) => {
    const start = Date.now();
    const auth  = Buffer.from(`${proxy.user}:${proxy.pass}`).toString("base64");

    const socket = net.createConnection(proxy.port, proxy.host, () => {
      // Send HTTP CONNECT to tunnel through to httpbin.org:80
      socket.write(
        `CONNECT httpbin.org:80 HTTP/1.1\r\nHost: httpbin.org:80\r\nProxy-Authorization: Basic ${auth}\r\n\r\n`
      );
    });

    socket.setTimeout(8_000);

    let buf = "";
    socket.on("data", (chunk) => {
      buf += chunk.toString();
      if (!buf.includes("\r\n\r\n")) return;

      const firstLine = buf.split("\r\n")[0] ?? "";
      const status    = parseInt(firstLine.split(" ")[1] ?? "0");
      const tunnelMs  = Date.now() - start;

      if (status !== 200) {
        socket.destroy();
        resolve({ ok: false, tunnelMs, error: `CONNECT returned ${status} — ${firstLine}` });
        return;
      }

      // Tunnel open — now send HTTP GET /ip through it
      const fetchStart = Date.now();
      socket.write("GET /ip HTTP/1.1\r\nHost: httpbin.org\r\nConnection: close\r\n\r\n");

      let body = "";
      socket.on("data", (d) => { body += d.toString(); });
      socket.on("end", () => {
        const fetchMs = Date.now() - fetchStart;
        try {
          const jsonStart = body.indexOf("{");
          const ip = jsonStart >= 0 ? JSON.parse(body.slice(jsonStart))?.origin : undefined;
          resolve({ ok: true, tunnelMs, fetchMs, ip });
        } catch {
          resolve({ ok: true, tunnelMs, fetchMs, ip: "(parse error)" });
        }
        socket.destroy();
      });
    });

    socket.on("timeout", () => {
      socket.destroy();
      resolve({ ok: false, tunnelMs: Date.now() - start, error: "Timeout connecting to proxy" });
    });

    socket.on("error", (err) => {
      resolve({ ok: false, tunnelMs: Date.now() - start, error: err.message });
    });
  });
}

// ── Test Playwright (direct or through proxy) ─────────────────────────────────
async function testPlaywright(proxyUrl?: string): Promise<{
  ok: boolean; title?: string; videoElements?: number;
  cloudflare?: boolean; error?: string; durationMs: number; executablePath: string;
}> {
  const start          = Date.now();
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? "bundled";
  let browser;
  try {
    const launchOpts: any = { headless: true, args: BROWSER_ARGS };
    if (executablePath !== "bundled") launchOpts.executablePath = executablePath;
    if (proxyUrl) launchOpts.proxy = { server: proxyUrl };

    browser = await chromium.launch(launchOpts);
    const context = await browser.newContext({
      userAgent: UA, viewport: { width: 1920, height: 1080 },
      locale: "en-US", ignoreHTTPSErrors: true,
    });
    const page = await context.newPage();
    await page.goto("https://vidlink.pro/movie/931285", {
      timeout: 30_000, waitUntil: "domcontentloaded",
    });
    const title     = await page.title();
    const videos    = (await page.$$("video")).length;
    const cloudflare = title.includes("Cloudflare") || title.includes("Just a moment") || title.includes("Attention Required");
    await browser.close();
    return { ok: true, title, videoElements: videos, cloudflare, executablePath, durationMs: Date.now() - start };
  } catch (err) {
    if (browser) await browser.close().catch(() => {});
    return { ok: false, error: (err as Error).message, executablePath, durationMs: Date.now() - start };
  }
}

// ── GET handler ───────────────────────────────────────────────────────────────
export async function GET() {
  const proxyEnabled = process.env.PROXY_ENABLED !== "false";
  const proxyRaw     = process.env.PROXY_LIST ?? process.env.PROXY_URL ?? "";
  const proxy        = parseFirstProxy(proxyRaw);

  // Run proxy tunnel test + playwright direct in parallel
  const [tunnelResult, playwrightDirect] = await Promise.all([
    proxy ? testProxyTunnel(proxy) : Promise.resolve({ ok: false, tunnelMs: 0, error: "No proxy configured" }),
    testPlaywright(),
  ]);

  // Only test playwright through proxy if tunnel works
  const playwrightProxy = tunnelResult.ok && proxy
    ? await testPlaywright(proxy.url)
    : { ok: false, error: tunnelResult.ok ? "No proxy" : `Skipped — tunnel failed: ${tunnelResult.error}`, durationMs: 0, executablePath: "" };

  const recommendation =
    !playwrightDirect.ok
      ? "❌ Playwright broken — run: npx playwright install chromium"
      : !tunnelResult.ok && proxyEnabled
        ? `❌ Proxy tunnel failed — ${tunnelResult.error}. Go to proxy.webshare.io → Settings → IP Authorizations and add 62.171.169.111`
        : tunnelResult.ok && playwrightDirect.cloudflare && !playwrightProxy.ok
          ? "⚠️  Proxy connects but Playwright through proxy fails — Webshare may block streaming sites. Try disabling proxy for Playwright and use direct fetch only."
          : tunnelResult.ok && playwrightProxy.ok && !playwrightProxy.cloudflare
            ? "✅ Everything working — proxy bypasses Cloudflare"
            : tunnelResult.ok && playwrightProxy.cloudflare
              ? "⚠️  Proxy works but still hitting Cloudflare — proxy IPs may be flagged. Try residential proxies."
              : "✅ Proxy not needed — direct connection works";

  return NextResponse.json({
    env: {
      PROXY_ENABLED:    proxyEnabled,
      PROXY_LIST:       proxyRaw ? proxyRaw.replace(/:[^:@\n,]+@/g, ":***@") : "(not set)",
      parsedProxy:      proxy    ? `${proxy.host}:${proxy.port} (user: ${proxy.user})` : "(none)",
      PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? "(not set)",
      SUBDL_API_KEY:         process.env.SUBDL_API_KEY         ? "✓ set" : "✗ missing",
      OPENSUBTITLES_API_KEY: process.env.OPENSUBTITLES_API_KEY ? "✓ set" : "✗ missing",
    },
    proxyTunnel:    tunnelResult,
    playwright: {
      direct:      playwrightDirect,
      throughProxy: playwrightProxy,
    },
    summary: {
      proxyTunnelOk:    tunnelResult.ok,
      playwrightOk:     playwrightDirect.ok,
      cloudflareBlocked: playwrightDirect.cloudflare ?? false,
      proxyBypassesCF:  playwrightProxy.ok && !playwrightProxy.cloudflare,
      recommendation,
    },
  });
}