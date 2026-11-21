/**
 * Pass kedua pengambilan logo: JNT (sertifikat jnt.co.id bermasalah),
 * Lakuki Frozen (profil Instagram/YouTube) dan Jajo Steak (potongan logo terpotong).
 */
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const OUT = path.resolve(".recon/logos2");
const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
await fs.mkdir(OUT, { recursive: true });

const report = [];
const manifest = [];

/* ------------------------------------------------------------------ JNT -- */
async function captureJnt() {
  const sources = [
    "https://www.jnt.co.id/",
    "https://jnt.co.id/",
    "https://www.jtexpress.id/",
    "https://jnt-express.co.id/",
    "https://www.jet.co.id/",
  ];
  for (const source of sources) {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      userAgent: UA,
      ignoreHTTPSErrors: true,
      locale: "id-ID",
    });
    const page = await context.newPage();
    try {
      const res = await page.goto(source, { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.waitForTimeout(6000);
      const info = { source, status: res?.status() };

      const cands = await page.evaluate(() => {
        const out = [];
        const push = (src, kind, alt, w, h) => {
          if (src) out.push({ src, kind, alt: alt || "", w: w || 0, h: h || 0 });
        };
        for (const img of document.querySelectorAll("header img, nav img, [class*='header'] img, [class*='logo'] img")) {
          push(img.currentSrc || img.src, "header", img.getAttribute("alt"), img.naturalWidth, img.naturalHeight);
        }
        for (const img of document.querySelectorAll("img[alt*='logo' i], img[alt*='jnt' i], img[alt*='j&t' i]")) {
          push(img.currentSrc || img.src, "alt", img.getAttribute("alt"), img.naturalWidth, img.naturalHeight);
        }
        for (const link of document.querySelectorAll("link[rel*='icon' i]")) push(link.href, "icon", link.getAttribute("rel"));
        for (const meta of document.querySelectorAll("meta[property='og:image'], meta[name='twitter:image']")) {
          push(meta.content, "og", meta.getAttribute("property"));
        }
        return out;
      });

      const seen = new Set();
      const scored = cands
        .filter((c) => {
          const k = c.src.split("?")[0];
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        })
        .map((c) => {
          let s = 0;
          if (c.kind === "header") s += 50;
          if (c.kind === "alt") s += 60;
          if (c.kind === "icon") s += 30;
          if (c.kind === "og") s += 20;
          if (/logo|jnt|j&t/i.test(c.alt)) s += 30;
          if (c.w >= 600 && c.h >= 600) s -= 35;
          if (c.w && c.h && c.w <= 512 && c.h <= 512) s += 15;
          return { ...c, s };
        })
        .sort((a, b) => b.s - a.s);
      info.candidates = scored.slice(0, 10);

      for (const c of scored) {
        if (c.s <= 0) break;
        try {
          const resp = await context.request.get(c.src, { timeout: 30000, ignoreHTTPSErrors: true });
          if (!resp.ok()) continue;
          const buf = await resp.body();
          if (buf.length < 800) continue;
          const type = resp.headers()["content-type"] || "";
          if (!/image/.test(type)) continue;
          const ext = /svg/.test(type) ? "svg" : /png/.test(type) ? "png" : /jpg/.test(type) ? "jpg" : "webp";
          await fs.writeFile(path.join(OUT, `jnt.${ext}`), buf);
          manifest.push({ slug: "jnt", file: `jnt.${ext}`, kind: c.kind, url: c.src, bytes: buf.length });
          info.saved = `jnt.${ext}`;
          report.push(info);
          await context.close();
          return true;
        } catch {
          /* lanjut */
        }
      }
      report.push(info);
    } catch (error) {
      report.push({ source, error: error.message.slice(0, 160) });
    }
    await context.close().catch(() => {});
  }
  return false;
}

/* ---------------------------------------------------------------- Lakuki -- */
async function captureLakuki() {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: UA,
    locale: "id-ID",
  });
  const page = await context.newPage();
  const info = {};

  // 1) Instagram: ambil foto profil + og:image.
  try {
    await page.goto("https://www.instagram.com/lakukifrozen/", { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(7000);
    const ig = await page.evaluate(() => {
      const out = [];
      const push = (src, kind) => {
        if (src) out.push({ src, kind });
      };
      for (const img of document.querySelectorAll("img[alt*='profile picture' i], img[alt*='Lakuki' i]")) {
        push(img.currentSrc || img.src, "profile");
      }
      for (const meta of document.querySelectorAll("meta[property='og:image'], meta[name='twitter:image']")) {
        push(meta.content, "og");
      }
      return out;
    });
    info.instagram = ig;
    for (const c of ig) {
      try {
        const resp = await context.request.get(c.src, { timeout: 30000 });
        if (!resp.ok()) continue;
        const buf = await resp.body();
        if (buf.length < 1500) continue;
        const type = resp.headers()["content-type"] || "";
        if (!/image/.test(type)) continue;
        const ext = /png/.test(type) ? "png" : /webp/.test(type) ? "webp" : "jpg";
        await fs.writeFile(path.join(OUT, `lakuki-ig.${ext}`), buf);
        manifest.push({ slug: "lakuki-ig", file: `lakuki-ig.${ext}`, kind: c.kind, url: c.src, bytes: buf.length });
      } catch {
        /* lanjut */
      }
    }
  } catch (error) {
    info.instagramError = error.message.slice(0, 160);
  }

  // 2) YouTube: avatar channel + banner (banner sering memuat logo).
  try {
    await page.goto("https://www.youtube.com/@LakukiFrozen", { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(8000);
    const yt = await page.evaluate(() => {
      const out = [];
      const push = (src, kind) => {
        if (src) out.push({ src, kind });
      };
      for (const img of document.querySelectorAll("#avatar img, ytd-channel-profile-renderer img, img#img")) {
        push(img.currentSrc || img.src, "avatar");
      }
      for (const img of document.querySelectorAll("ytd-banner img, #header-banner img, yt-img-shadow#header-banner img")) {
        push(img.currentSrc || img.src, "banner");
      }
      for (const meta of document.querySelectorAll("meta[property='og:image'], meta[name='twitter:image']")) {
        push(meta.content, "og");
      }
      return out;
    });
    info.youtube = yt;
    for (const c of yt) {
      try {
        const resp = await context.request.get(c.src, { timeout: 30000 });
        if (!resp.ok()) continue;
        const buf = await resp.body();
        if (buf.length < 1500) continue;
        const type = resp.headers()["content-type"] || "";
        if (!/image/.test(type)) continue;
        const ext = /png/.test(type) ? "png" : /webp/.test(type) ? "webp" : "jpg";
        const name = `lakuki-yt-${c.kind}.${ext}`;
        await fs.writeFile(path.join(OUT, name), buf);
        manifest.push({ slug: name, file: name, kind: c.kind, url: c.src, bytes: buf.length });
      } catch {
        /* lanjut */
      }
    }
  } catch (error) {
    info.youtubeError = error.message.slice(0, 160);
  }

  report.push(info);
  await context.close().catch(() => {});
  return true;
}

/* ------------------------------------------------------------ JajoSteak -- */
async function captureJajo() {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: UA,
  });
  const page = await context.newPage();
  const info = {};
  try {
    await page.goto("https://jajosteak.vercel.app/", { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(5000);

    // Cari elemen logo lalu potong dengan padding.
    const selectors = [
      'header a[href="/"]',
      'header a[href="#"]',
      'nav a[href="/"]',
      "header img",
      "nav img",
      '[class*="logo"]',
      '[class*="brand"]',
    ];
    info.found = [];
    for (const sel of selectors) {
      const loc = page.locator(sel).first();
      if (!(await loc.count())) continue;
      if (!(await loc.isVisible().catch(() => false))) continue;
      const box = await loc.boundingBox().catch(() => null);
      if (!box || box.width < 40) continue;
      info.found.push({ sel, box: { w: Math.round(box.width), h: Math.round(box.height) } });
      const file = path.join(OUT, `jajosteak-${sel.replace(/[^a-z0-9]+/gi, "_")}.png`);
      await page
        .screenshot({
          path: file,
          clip: {
            x: Math.max(0, box.x - 6),
            y: Math.max(0, box.y - 6),
            width: Math.min(1440, box.width + 12),
            height: box.height + 12,
          },
        })
        .catch(() => {});
      const { size } = await fs.stat(file).catch(() => ({ size: 0 }));
      if (size > 800) {
        manifest.push({ slug: `jajosteak-${sel.replace(/[^a-z0-9]+/gi, "_")}`, file: path.basename(file), kind: "clip", bytes: size });
      }
      break;
    }
  } catch (error) {
    info.error = error.message.slice(0, 160);
  }
  report.push(info);
  await context.close().catch(() => {});
  return true;
}

await captureJnt();
await captureLakuki();
await captureJajo();

await browser.close();
await fs.writeFile(path.join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
await fs.writeFile(path.join(OUT, "report.json"), JSON.stringify(report, null, 2) + "\n");
console.log("DONE");
