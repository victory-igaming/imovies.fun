// src/app/api/debug-playwright/route.ts

import { NextResponse } from "next/server";
import { chromium } from "playwright";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const REAL_SEC_CH_UA =
  '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"';

const REAL_SEC_CH_UA_MOBILE = "?0";
const REAL_SEC_CH_UA_PLATFORM = '"Windows"';

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

export async function GET() {
  let browser;

  try {
    browser = await chromium.launch({
     // Dynamically use the system environment path, or fallback to the local path       
      headless: true,
      args: BROWSER_ARGS,
    });

    const context = await browser.newContext({
      userAgent: UA,
      viewport: { width: 1920, height: 1080 },
      locale: "en-US",
      timezoneId: "America/New_York",
      ignoreHTTPSErrors: true,
      permissions: [],
      extraHTTPHeaders: {
        "Accept-Language": "en-US,en;q=0.9",
        "sec-ch-ua": REAL_SEC_CH_UA,
        "sec-ch-ua-mobile": REAL_SEC_CH_UA_MOBILE,
        "sec-ch-ua-platform": REAL_SEC_CH_UA_PLATFORM,
      },
    });

    await context.addInitScript(() => {
      // safe casting for TS + runtime
      const w = window as any;
      const n = navigator as any;

      Object.defineProperty(n, "webdriver", {
        get: () => undefined,
      });

      Object.defineProperty(n, "languages", {
        get: () => ["en-US", "en"],
      });

      Object.defineProperty(n, "plugins", {
        get: () => [
          {
            name: "Chrome PDF Plugin",
            description: "Portable Document Format",
            filename: "internal-pdf-viewer",
            length: 1,
          },
        ],
      });

      // chrome object
      w.chrome = { runtime: {} };

      // FIXED permissions override (no TS error)
      if (n.permissions?.query) {
        const originalQuery = n.permissions.query.bind(n.permissions);

        n.permissions.query = (parameters: any) => {
          if (parameters?.name === "notifications") {
            return Promise.resolve({
              name: "notifications",
              state: Notification.permission,
              onchange: null,
              addEventListener: () => {},
              removeEventListener: () => {},
              dispatchEvent: () => false,
            } as PermissionStatus);
          }

          return originalQuery(parameters);
        };
      }

      // WebGL spoof
      const getParameter = WebGLRenderingContext.prototype.getParameter;
      WebGLRenderingContext.prototype.getParameter = function (parameter: any) {
        if (parameter === 37445) return "Intel Inc.";
        if (parameter === 37446) return "Intel Iris OpenGL Engine";
        return getParameter.call(this, parameter);
      };
    });

    const page = await context.newPage();

    await page.goto("https://vidlink.pro/movie/931285", {
      timeout: 60000,
      waitUntil: "domcontentloaded",
    });

    const title = await page.title();

    const isCloudflare =
      title.includes("Cloudflare") ||
      title.includes("Attention Required") ||
      title.includes("Just a moment");

    if (isCloudflare) {
      try {
        await page.waitForFunction(
          () =>
            !document.title.includes("Cloudflare") &&
            !document.title.includes("Attention Required") &&
            !document.title.includes("Just a moment"),
          { timeout: 30000 }
        );
      } catch {
        // ignore timeout
      }
    }

    const videoElements = await page.$$("video");

    // safer script extraction (avoid huge innerHTML load)
    const scriptHits = await page.evaluate(() => {
      return Array.from(document.scripts)
        .map((s) => s.src + " " + (s.textContent || ""))
        .filter((t) =>
          t.includes(".m3u8") ||
          t.includes(".mp4") ||
          t.includes("video")
        ).length;
    });

    await page.close();
    await context.close();
    await browser.close();

    return NextResponse.json({
      success: true,
      title,
      videoElementsCount: videoElements.length,
      scriptsWithVideo: scriptHits,
      cloudflareDetected: isCloudflare,
    });
  } catch (error) {
    if (browser) await browser.close();

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}