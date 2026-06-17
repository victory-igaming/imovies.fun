// src/app/api/debug-proxy/route.ts
// Visit /api/debug-proxy to diagnose proxy + playwright

import { NextResponse } from "next/server";
import { chromium } from "playwright";
import * as net from "net";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const TARGET_URL = "https://vidlink.pro/movie/931285";
const SERVER_IP = "62.171.169.111";

const BROWSER_ARGS = [
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-dev-shm-usage",
  "--disable-gpu",
  "--disable-blink-features=AutomationControlled",
  "--disable-web-security",
  "--ignore-certificate-errors",
  `--user-agent=${UA}`,
];

type ParsedProxy = {
  url: string;
  server: string;
  host: string;
  port: number;
  user?: string;
  pass?: string;
};

type TunnelResult = {
  ok: boolean;
  tunnelMs: number;
  fetchMs?: number;
  ip?: string;
  error?: string;
  providerReason?: string;
};

type PlaywrightResult = {
  ok: boolean;
  title?: string;
  videoElements?: number;
  cloudflare?: boolean;
  error?: string;
  durationMs: number;
  executablePath: string;
};

function maskValue(value: string) {
  if (!value) return "";

  if (!value.startsWith("http://") && !value.startsWith("https://")) {
    return value
      .split(/[\n,]+/)
      .map((entry) => {
        const parts = entry.trim().split(":");

        if (parts.length === 4) {
          const [host, port, user] = parts;
          return `${host}:${port}:${user}:***`;
        }

        return entry.trim();
      })
      .join(",");
  }

  try {
    const u = new URL(value);
    if (u.password) u.password = "***";
    return u.toString();
  } catch {
    return "***";
  }
}

function parseFirstProxy(raw: string): ParsedProxy | null {
  const entry = raw
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean)[0];

  if (!entry) return null;

  if (entry.startsWith("http://") || entry.startsWith("https://")) {
    try {
      const u = new URL(entry);

      const host = u.hostname;
      const port = Number(u.port || 80);
      const user = decodeURIComponent(u.username || "");
      const pass = decodeURIComponent(u.password || "");

      return {
        url: entry,
        server: `${u.protocol}//${host}:${port}`,
        host,
        port,
        user: user || undefined,
        pass: pass || undefined,
      };
    } catch {
      return null;
    }
  }

  const parts = entry.split(":");

  // Supports local proxy / IP-auth proxy:
  // PROXY_LIST=127.0.0.1:8888
  // PROXY_LIST=p.webshare.io:80
  if (parts.length === 2) {
    const [host, portRaw] = parts;
    const port = Number(portRaw);

    if (!host || !port) return null;

    return {
      url: `http://${host}:${port}`,
      server: `http://${host}:${port}`,
      host,
      port,
    };
  }

  // Supports username/password proxy:
  // PROXY_LIST=p.webshare.io:80:user:pass
  if (parts.length === 4) {
    const [host, portRaw, user, pass] = parts;
    const port = Number(portRaw);

    if (!host || !port || !user || !pass) return null;

    return {
      url: `http://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${host}:${port}`,
      server: `http://${host}:${port}`,
      host,
      port,
      user,
      pass,
    };
  }

  return null;
}

function detectCloudflare(title: string) {
  const t = title.toLowerCase();

  return (
    t.includes("cloudflare") ||
    t.includes("just a moment") ||
    t.includes("attention required") ||
    t.includes("checking your browser")
  );
}

function extractHeaderValue(rawHeaders: string, headerName: string) {
  const lines = rawHeaders.split(/\r?\n/);
  const target = headerName.toLowerCase();

  for (const line of lines) {
    const index = line.indexOf(":");
    if (index === -1) continue;

    const name = line.slice(0, index).trim().toLowerCase();
    const value = line.slice(index + 1).trim();

    if (name === target) return value;
  }

  return undefined;
}

function testProxyTunnel(proxy: ParsedProxy): Promise<TunnelResult> {
  return new Promise((resolve) => {
    const start = Date.now();

    const socket = net.createConnection(proxy.port, proxy.host, () => {
      const headers = [
        "CONNECT api.ipify.org:443 HTTP/1.1",
        "Host: api.ipify.org:443",
      ];

      if (proxy.user && proxy.pass) {
        const auth = Buffer.from(`${proxy.user}:${proxy.pass}`).toString("base64");
        headers.push(`Proxy-Authorization: Basic ${auth}`);
      }

      headers.push("Connection: close", "", "");

      socket.write(headers.join("\r\n"));
    });

    socket.setTimeout(10_000);

    let firstResponse = "";
    let tunnelOpened = false;
    let body = "";
    let fetchStart = 0;
    let resolved = false;

    const safeResolve = (result: TunnelResult) => {
      if (resolved) return;
      resolved = true;
      resolve(result);
    };

    socket.on("data", (chunk) => {
      const text = chunk.toString();

      if (!tunnelOpened) {
        firstResponse += text;

        if (!firstResponse.includes("\r\n\r\n")) return;

        const firstLine = firstResponse.split("\r\n")[0] ?? "";
        const status = Number(firstLine.split(" ")[1] ?? 0);
        const tunnelMs = Date.now() - start;
        const providerReason = extractHeaderValue(firstResponse, "X-Webshare-Reason");

        if (status !== 200) {
          socket.destroy();

          safeResolve({
            ok: false,
            tunnelMs,
            providerReason,
            error: providerReason
              ? `CONNECT returned ${status} — ${firstLine} — ${providerReason}`
              : `CONNECT returned ${status} — ${firstLine}`,
          });

          return;
        }

        tunnelOpened = true;
        fetchStart = Date.now();

        socket.write(
          [
            "GET /?format=json HTTP/1.1",
            "Host: api.ipify.org",
            "Connection: close",
            "",
            "",
          ].join("\r\n")
        );

        return;
      }

      body += text;
    });

    socket.on("end", () => {
      if (!tunnelOpened) return;

      const fetchMs = Date.now() - fetchStart;
      const tunnelMs = Date.now() - start;

      try {
        const jsonStart = body.indexOf("{");
        const parsed = jsonStart >= 0 ? JSON.parse(body.slice(jsonStart)) : null;

        safeResolve({
          ok: true,
          tunnelMs,
          fetchMs,
          ip: parsed?.ip ?? parsed?.origin ?? "(unknown)",
        });
      } catch {
        safeResolve({
          ok: true,
          tunnelMs,
          fetchMs,
          ip: "(parse error)",
        });
      }
    });

    socket.on("timeout", () => {
      socket.destroy();

      safeResolve({
        ok: false,
        tunnelMs: Date.now() - start,
        error: "Timeout connecting to proxy",
      });
    });

    socket.on("error", (err) => {
      safeResolve({
        ok: false,
        tunnelMs: Date.now() - start,
        error: err.message,
      });
    });
  });
}

async function testPlaywright(proxy?: ParsedProxy): Promise<PlaywrightResult> {
  const start = Date.now();
  const executablePath =
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? "bundled";

  let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;

  try {
    const launchOpts: Parameters<typeof chromium.launch>[0] = {
      headless: true,
      args: BROWSER_ARGS,
    };

    if (executablePath !== "bundled") {
      launchOpts.executablePath = executablePath;
    }

    if (proxy) {
      launchOpts.proxy =
        proxy.user && proxy.pass
          ? {
              server: proxy.server,
              username: proxy.user,
              password: proxy.pass,
            }
          : {
              server: proxy.server,
            };
    }

    browser = await chromium.launch(launchOpts);

    const context = await browser.newContext({
      userAgent: UA,
      viewport: { width: 1920, height: 1080 },
      locale: "en-US",
      ignoreHTTPSErrors: true,
    });

    const page = await context.newPage();

    await page.goto(TARGET_URL, {
      timeout: 30_000,
      waitUntil: "domcontentloaded",
    });

    const title = await page.title();
    const videoElements = await page.locator("video").count();
    const cloudflare = detectCloudflare(title);

    await browser.close();

    return {
      ok: true,
      title,
      videoElements,
      cloudflare,
      executablePath,
      durationMs: Date.now() - start,
    };
  } catch (err) {
    if (browser) {
      await browser.close().catch(() => {});
    }

    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      executablePath,
      durationMs: Date.now() - start,
    };
  }
}

function getResultMeaning(params: {
  proxyEnabled: boolean;
  proxyConfigured: boolean;
  tunnelResult: TunnelResult;
  playwrightDirect: PlaywrightResult;
  playwrightProxy: PlaywrightResult;
}) {
  const {
    proxyEnabled,
    proxyConfigured,
    tunnelResult,
    playwrightDirect,
    playwrightProxy,
  } = params;

  if (!playwrightDirect.ok) {
    return {
      status: "❌ Playwright broken",
      meaning: "Chromium/Playwright failed before proxy testing.",
      action:
        "Run: npx playwright install chromium, or verify PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH.",
    };
  }

  if (!proxyEnabled) {
    return {
      status: "ℹ️ Proxy disabled",
      meaning: "PROXY_ENABLED is false, so proxy testing is not active.",
      action: "Set PROXY_ENABLED=true to test proxy.",
    };
  }

  if (!proxyConfigured) {
    return {
      status: "❌ Proxy missing",
      meaning: "No valid proxy found in PROXY_LIST or PROXY_URL.",
      action: "Set PROXY_LIST=host:port:user:pass or PROXY_LIST=host:port in .env.",
    };
  }

  if (!tunnelResult.ok) {
    const error = tunnelResult.error ?? "";
    const lowerError = error.toLowerCase();
    const providerReason = tunnelResult.providerReason?.toLowerCase() ?? "";

    if (
      lowerError.includes("bandwidthlimit") ||
      providerReason.includes("bandwidthlimit")
    ) {
      return {
        status: "❌ Proxy bandwidth limit reached",
        meaning:
          "Webshare accepted your proxy endpoint/credentials but refused the request because bandwidth is finished.",
        action:
          "Go to Webshare Dashboard → Usage/Billing and renew, upgrade, or add more bandwidth.",
      };
    }

    if (error.includes("402")) {
      return {
        status: "❌ Proxy tunnel failed",
        meaning:
          "Webshare rejected the CONNECT request. This usually means IP whitelist, billing, bandwidth, or plan issue.",
        action: `Webshare IP whitelist — add ${SERVER_IP} to dashboard. Also check payment/bandwidth.`,
      };
    }

    if (lowerError.includes("timeout")) {
      return {
        status: "❌ Proxy timeout",
        meaning: "Your server could not connect to the proxy in time.",
        action: "Check proxy host, port, firewall, and Webshare proxy status.",
      };
    }

    return {
      status: "❌ Proxy tunnel failed",
      meaning: "Proxy could not open a raw CONNECT tunnel.",
      action: `Fix proxy connection error: ${error}`,
    };
  }

  if (tunnelResult.ok && !playwrightProxy.ok) {
    return {
      status: "⚠️ Proxy connects but Playwright fails",
      meaning:
        "Raw proxy tunnel works, but Playwright/Chromium cannot browse through it.",
      action:
        "Webshare may block HTTPS CONNECT to streaming domains, or the proxy type is not suitable for Chromium.",
    };
  }

  if (tunnelResult.ok && playwrightProxy.ok && playwrightProxy.cloudflare) {
    return {
      status: "⚠️ Still hitting Cloudflare",
      meaning:
        "Proxy works technically, but the proxy IP is still flagged by Cloudflare.",
      action: "Proxy IPs are flagged — use residential or cleaner rotating proxies.",
    };
  }

  if (tunnelResult.ok && playwrightProxy.ok && !playwrightProxy.cloudflare) {
    return {
      status: "✅ Everything working",
      meaning:
        "Proxy connects, Playwright loads through it, and Cloudflare is not blocking.",
      action: "Proxy bypasses CF — streams should work.",
    };
  }

  return {
    status: "ℹ️ Unknown result",
    meaning: "The diagnostic result does not match a known state.",
    action: "Check proxyTunnel, playwright.direct, and playwright.throughProxy.",
  };
}

export async function GET() {
  const proxyEnabled = process.env.PROXY_ENABLED !== "false";
  const proxyRaw = process.env.PROXY_LIST ?? process.env.PROXY_URL ?? "";
  const proxy = parseFirstProxy(proxyRaw);

  const [tunnelResult, playwrightDirect] = await Promise.all([
    proxyEnabled && proxy
      ? testProxyTunnel(proxy)
      : Promise.resolve({
          ok: false,
          tunnelMs: 0,
          error: proxyEnabled ? "No proxy configured" : "Proxy disabled",
        }),
    testPlaywright(),
  ]);

  const playwrightProxy: PlaywrightResult =
    proxyEnabled && proxy && tunnelResult.ok
      ? await testPlaywright(proxy)
      : {
          ok: false,
          error: tunnelResult.ok ? "No proxy" : `Skipped — tunnel failed: ${tunnelResult.error}`,
          durationMs: 0,
          executablePath: "",
          };

  const resultMeaning = getResultMeaning({
    proxyEnabled,
    proxyConfigured: Boolean(proxy),
    tunnelResult,
    playwrightDirect,
    playwrightProxy,
  });

  const recommendation = `${resultMeaning.status} — ${resultMeaning.action}`;

  return NextResponse.json({
    env: {
      PROXY_ENABLED: proxyEnabled,
      PROXY_LIST: proxyRaw ? maskValue(proxyRaw) : "(not set)",
      parsedProxy: proxy
        ? proxy.user
          ? `${proxy.host}:${proxy.port} (user: ${proxy.user}, pass: ***)`
          : `${proxy.host}:${proxy.port} (no username/password)`
        : "(none)",
      PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH:
        process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? "(not set)",
      PLAYWRIGHT_BROWSERS_PATH:
        process.env.PLAYWRIGHT_BROWSERS_PATH ?? "(not set)",
      SUBDL_API_KEY: process.env.SUBDL_API_KEY ? "✓ set" : "✗ missing",
      OPENSUBTITLES_API_KEY: process.env.OPENSUBTITLES_API_KEY
        ? "✓ set"
        : "✗ missing",
    },

    proxyTunnel: tunnelResult,

    playwright: {
      direct: playwrightDirect,
      throughProxy: playwrightProxy,
    },

    resultMeaning,

    resultMeaningTable: [      {
        result: "❌ Proxy bandwidth limit reached",
        meaning: "Webshare bandwidth is finished. Renew/upgrade/add bandwidth.",
      },
      {
        result: "❌ Proxy tunnel failed",
        meaning: `Webshare IP whitelist — add ${SERVER_IP} to dashboard, or check billing/bandwidth.`,
      },
      {
        result: "⚠️ Proxy connects but Playwright fails",
        meaning: "Proxy works, but Chromium cannot browse through it properly.",
      },
      {
        result: "⚠️ Still hitting Cloudflare",
        meaning: "Proxy IPs are flagged — need residential proxies.",
      },
      {
        result: "✅ Everything working",
        meaning: "Proxy bypasses CF — streams will work.",
      },
    ],

    summary: {
      proxyTunnelOk: tunnelResult.ok,
      playwrightOk: playwrightDirect.ok,
      cloudflareBlocked: playwrightDirect.cloudflare ?? false,
      proxyBypassesCF: playwrightProxy.ok && !playwrightProxy.cloudflare,
      recommendation,
    },
  });
}