/**
 * Pass ketiga: logo JNT (dari jet.co.id), varian logo Akasha, dan verifikasi
 * akhir tiap aset (ukuran, alpha, mime).
 */
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const OUT = path.resolve(".recon/logos3");
const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

await fs.mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  userAgent: UA,
  ignoreHTTPSErrors: true,
  locale: "id-ID",
});
const page = await context.newPage();
const report = {};

/* ---------------------------------------------------------- JNT / jet.co.id */
for (const url of [
  "https://www.jet.co.id/static/images/logo.png?t=1",
  "https://www.jet.co.id/static/images/logo.png",
  "https://www.jet.co.id/static/favicon.ico",
]) {
  try {
    const resp = await context.request.get(url, { timeout: 30000, ignoreHTTPSErrors: true });
    const buf = await resp.body();
    const type = resp.headers()["content-type"] || "";
    report[url] = { status: resp.status(), type, bytes: buf.length };
    if (resp.ok() && buf.length > 500) {
      const name = "jnt-" + url.split("/").pop().split("?")[0];
      await fs.writeFile(path.join(OUT, name), buf);
    }
  } catch (error) {
    report[url] = { error: error.message.slice(0, 120) };
  }
}

/* ------------------------------------------- jnt.co.id (SPA) -> cari logo */
try {
  await page.goto("https://www.jnt.co.id/", { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(10000);
  const cands = await page.evaluate(() => {
    const out = [];
    const push = (src, kind, alt, w, h) => src && out.push({ src, kind, alt: alt || "", w: w || 0, h: h || 0 });
    for (const img of document.querySelectorAll("img")) {
      const s = img.currentSrc || img.src;
      if (!s) continue;
      if (/logo|jnt|jand|j&t|brand/i.test(s + " " + (img.getAttribute("alt") || ""))) {
        push(s, "match", img.getAttribute("alt"), img.naturalWidth, img.naturalHeight);
      }
    }
    for (const link of document.querySelectorAll("link[rel*='icon' i]")) push(link.href, "icon", link.getAttribute("rel"));
    for (const meta of document.querySelectorAll("meta[property='og:image']")) push(meta.content, "og", "og");
    return out;
  });
  report.jntCoId = { count: cands.length, cands: cands.slice(0, 12) };
  for (const c of cands) {
    if (c.kind === "icon" && cands.length > 1) continue;
    try {
      const resp = await context.request.get(c.src, { timeout: 30000, ignoreHTTPSErrors: true });
      if (!resp.ok()) continue;
      const buf = await resp.body();
      if (buf.length < 500) continue;
      await fs.writeFile(path.join(OUT, `jntco-${c.kind}-${c.src.split("/").pop().split("?")[0] || "x"}`), buf);
    } catch {
      /* lanjut */
    }
  }
} catch (error) {
  report.jntCoId = { error: error.message.slice(0, 160) };
}

/* ------------------------------------------------- Akasha: semua logo-ish */
try {
  await page.goto("https://akashainternational.com/", { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(6000);
  const assets = await page.evaluate(() => {
    const found = new Set();
    for (const img of document.querySelectorAll("img")) {
      const s = img.currentSrc || img.src;
      if (s) found.add(s);
    }
    for (const link of document.querySelectorAll("link[rel*='icon' i]")) found.add(link.href);
    for (const meta of document.querySelectorAll("meta[property='og:image'], meta[name='twitter:image']")) {
      found.add(meta.content);
    }
    return [...found];
  });
  report.akashaAssets = assets;

  // Coba nama file umum untuk logo.
  const guesses = [
    "https://akashainternational.com/media/shared/logo.png",
    "https://akashainternational.com/media/shared/logo-black.png",
    "https://akashainternational.com/media/shared/logo-dark.png",
    "https://akashainternational.com/media/shared/logo-color.png",
    "https://akashainternational.com/media/shared/logo-blue.png",
    "https://akashainternational.com/media/shared/logo-white.png",
    "https://akashainternational.com/media/shared/icon.png",
    "https://akashainternational.com/media/shared/og.jpg",
  ];
  for (const url of guesses) {
    try {
      const resp = await context.request.get(url, { timeout: 30000 });
      if (!resp.ok()) continue;
      const buf = await resp.body();
      if (buf.length < 500) continue;
      const name = "akasha-" + url.split("/").pop();
      await fs.writeFile(path.join(OUT, name), buf);
      report[url] = { ok: true, bytes: buf.length, type: resp.headers()["content-type"] };
    } catch (error) {
      report[url] = { error: error.message.slice(0, 100) };
    }
  }
} catch (error) {
  report.akasha = { error: error.message.slice(0, 160) };
}

await browser.close();
await fs.writeFile(path.join(OUT, "report.json"), JSON.stringify(report, null, 2) + "\n");
console.log("DONE");
