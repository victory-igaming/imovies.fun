/**
 * Videasy stream extraction — Playwright path without residential proxy.
 * The player is a Next.js SPA that loads sources via api.videasy.net + WASM decrypt.
 * Residential proxies break the SPA; we hook JSON.parse to capture decrypted source URLs.
 */

import type { Browser, BrowserContext, Page } from "playwright";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const STEALTH_SCRIPT = `
(() => {
  Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  delete navigator.__proto__.webdriver;
  Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
  Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
  Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
  window.chrome = window.chrome || {};
  window.chrome.runtime = window.chrome.runtime || {};

  window.__capturedStreamUrls = window.__capturedStreamUrls || [];
  window.__videasySources = window.__videasySources || [];

  const push = (u) => {
    if (u && typeof u === 'string' && (u.includes('.m3u8') || u.includes('.mp4'))) {
      window.__capturedStreamUrls.push(u);
    }
  };

  const _parse = JSON.parse;
  JSON.parse = function(text) {
    const result = _parse.call(this, text);
    try {
      if (result && Array.isArray(result.sources)) {
        window.__videasySources = result.sources;
        for (const s of result.sources) {
          push(s.url || s.file || s.src);
        }
      }
    } catch {}
    return result;
  };

  const origFetch = window.fetch;
  window.fetch = async (...args) => {
    const res = await origFetch(...args);
    try {
      const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
      if (url.includes('.m3u8') || url.includes('.mp4')) push(url);
    } catch {}
    return res;
  };
})();
`;

function isMediaUrl(url: string): boolean {
  const lower = url.toLowerCase();
  if (lower.includes(".m3u8") || lower.includes("playlist.m3u8")) return true;
  try {
    return /\.(m3u8|mp4|mkv|webm|ts)$/i.test(new URL(url).pathname);
  } catch {
    return /\.(m3u8|mp4|mkv|webm|ts)$/i.test(url.split("?")[0]!.toLowerCase());
  }
}

async function clickVideasyPlay(page: Page): Promise<void> {
  const selectors = [
    "div.fixed.inset-0 button",
    "div.fixed.inset-0",
    "button[class*='rounded-full']",
    "button[class*='play']",
    ".vjs-big-play-button",
    "[aria-label*='Play' i]",
    "[class*='play-button']",
  ];
  for (const sel of selectors) {
    try {
      const el = await page.$(sel);
      if (el) {
        await el.click({ timeout: 1500 });
        await page.waitForTimeout(2500);
        return;
      }
    } catch { /* continue */ }
  }
  try {
    const vp = page.viewportSize();
    if (vp) {
      await page.mouse.click(vp.width / 2, vp.height / 2);
      await page.waitForTimeout(2500);
    }
  } catch { /* ignore */ }
}

async function collectFromPage(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const urls: string[] = [];
    const w = window as any;

    if (Array.isArray(w.__capturedStreamUrls)) urls.push(...w.__capturedStreamUrls);
    if (Array.isArray(w.__videasySources)) {
      for (const s of w.__videasySources) {
        if (s?.url) urls.push(s.url);
        if (s?.file) urls.push(s.file);
        if (s?.src)  urls.push(s.src);
      }
    }

    for (const entry of performance.getEntriesByType("resource")) {
      const name = (entry as PerformanceResourceTiming).name;
      if (name.includes(".m3u8") || name.includes(".mp4")) urls.push(name);
    }

    for (const v of document.querySelectorAll("video")) {
      const src = v.src || v.currentSrc;
      if (src && !src.startsWith("blob:")) urls.push(src);
    }

    return [...new Set(urls.filter(Boolean))];
  });
}

export interface VideasyResult {
  streamUrl: string;
  proxyHeaders: Record<string, string>;
  source: string;
}

export async function extractVideasyPlaywright(
  browser: Browser,
  id: string,
): Promise<VideasyResult | null> {
  let ctx: BrowserContext | null = null;
  let page: Page | null = null;
  const candidates: Array<{ url: string; headers: Record<string, string> }> = [];
  const referer = `https://player.videasy.net/movie/${id}`;
  const defaultHeaders = { referer, origin: "https://player.videasy.net" };

  const addUrl = (url: string, headers: Record<string, string> = defaultHeaders) => {
    if (!isMediaUrl(url)) return;
    if (!candidates.some((c) => c.url === url)) candidates.push({ url, headers });
  };

  try {
    ctx = await browser.newContext({
      userAgent: UA,
      viewport: { width: 1280, height: 720 },
      locale: "en-US",
      timezoneId: "America/New_York",
      extraHTTPHeaders: {
        "Accept-Language": "en-US,en;q=0.9",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });
    await ctx.addInitScript({ content: STEALTH_SCRIPT });

    ctx.on("request", (req) => {
      const url = req.url();
      if (isMediaUrl(url)) addUrl(url, { ...defaultHeaders, ...req.headers() });
    });
    ctx.on("response", (res) => {
      const url = res.url();
      const ct = res.headers()?.["content-type"] ?? "";
      if (isMediaUrl(url) || ct.includes("mpegurl") || ct.includes("m3u8")) {
        addUrl(url, { ...defaultHeaders, ...res.request().headers() });
      }
    });

    page = await ctx.newPage();

    console.log(`[stream] Videasy: loading player (no proxy)…`);
    await page.goto(referer, { timeout: 35_000, waitUntil: "domcontentloaded" });

    let apiResponded = false;
    try {
      await page.waitForResponse(
        (r) => r.url().includes("api.videasy.net") && r.url().includes("sources"),
        { timeout: 18_000 },
      );
      apiResponded = true;
      console.log("[stream] Videasy: sources API responded");
    } catch {
      console.warn("[stream] Videasy: sources API timeout");
    }

    const pollMs = 400;
    const pollUntil = Date.now() + (apiResponded ? 12_000 : 6_000);
    while (Date.now() < pollUntil) {
      for (const url of await collectFromPage(page)) addUrl(url);
      if (candidates.length > 0) break;
      await page.waitForTimeout(pollMs);
    }

    if (candidates.length === 0) {
      await clickVideasyPlay(page);
      const afterClick = Date.now() + 15_000;
      while (Date.now() < afterClick) {
        for (const url of await collectFromPage(page)) addUrl(url);
        if (candidates.length > 0) break;
        await page.waitForTimeout(pollMs);
      }
    }

    const title = await page.title().catch(() => "");
    if (candidates.length === 0) {
      console.warn(`[stream] Videasy Playwright: 0 candidates — "${title}"`);
      return null;
    }

    const sorted = [...candidates].sort((a, b) => {
      const aM = a.url.includes(".m3u8") ? 1 : 0;
      const bM = b.url.includes(".m3u8") ? 1 : 0;
      return bM - aM;
    });

    const best = sorted[0]!;
    console.log(`[stream] Videasy Playwright ✓ → ${best.url.slice(0, 80)}`);
    return { streamUrl: best.url, proxyHeaders: best.headers, source: "Videasy" };
  } catch (err) {
    console.warn("[stream] Videasy Playwright err:", (err as Error).message);
    return null;
  } finally {
    try { await page?.close(); } catch {}
    try { await ctx?.close();  } catch {}
  }
}
