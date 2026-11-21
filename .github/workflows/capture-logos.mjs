/**
 * Ambil logo asli tiap tempat kerja untuk diagram Experience.
 *
 * Dijalankan di GitHub Actions (Chromium + internet penuh). Untuk tiap sumber,
 * script mengumpulkan kandidat logo (logo header, favicon, apple-touch-icon,
 * og:image), mengunduh yang terbaik, lalu menyimpan versinya sendiri.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const OUT = path.resolve(".recon/logos");
const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

/** Satu entitas = satu logo. Beberapa sumber dicoba berurutan. */
const ENTITIES = [
  {
    slug: "lakuki",
    sources: [
      "https://www.instagram.com/lakukifrozen/",
      "https://www.youtube.com/@LakukiFrozen/shorts",
    ],
  },
  { slug: "jnt", sources: ["https://www.jnt.co.id/", "https://www.jet.co.id/"] },
  { slug: "akasha", sources: ["https://akashainternational.com/"] },
  { slug: "jajosteak", sources: ["https://jajosteak.vercel.app/"] },
  { slug: "abra", sources: ["https://abrabriket.com/"] },
];

const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
await fs.mkdir(OUT, { recursive: true });

const manifest = [];

/** Ubah URL gambar Next.js (_next/image?url=...) menjadi URL file aslinya. */
function unwrapNextImage(raw) {
  try {
    const u = new URL(raw);
    if (u.pathname.includes("/_next/image")) {
      const inner = u.searchParams.get("url");
      if (inner) {
        const base = `${u.origin}${u.pathname.split("/_next")[0]}`;
        return new URL(inner, base).toString();
      }
    }
  } catch {
    /* bukan URL valid */
  }
  return raw;
}

for (const entity of ENTITIES) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: UA,
    locale: "id-ID",
  });
  const page = await context.newPage();
  let saved = false;

  for (const source of entity.sources) {
    if (saved) break;
    try {
      const res = await page.goto(source, { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.waitForTimeout(5000);

      const candidates = await page.evaluate(() => {
        const out = [];
        const push = (src, kind, alt, w, h) => {
          if (!src || !/^https?:|^data:/.test(src)) return;
          out.push({ src, kind, alt: alt || "", w: w || 0, h: h || 0 });
        };

        // Logo di header/nav = kandidat terkuat (bukan foto produk).
        for (const img of document.querySelectorAll("header img, nav img, [class*='header'] img")) {
          push(
            img.currentSrc || img.src,
            "header",
            img.getAttribute("alt"),
            img.naturalWidth,
            img.naturalHeight,
          );
        }
        // Gambar dengan alt yang menyebut logo.
        for (const img of document.querySelectorAll("img[alt*='logo' i], img[alt*='Logo']")) {
          push(
            img.currentSrc || img.src,
            "alt-logo",
            img.getAttribute("alt"),
            img.naturalWidth,
            img.naturalHeight,
          );
        }
        // Favicon & apple-touch-icon.
        for (const link of document.querySelectorAll("link[rel*='icon' i]")) {
          push(link.href, "icon", link.getAttribute("rel"));
        }
        // og:image / twitter:image (biasanya logo untuk halaman profil).
        for (const meta of document.querySelectorAll("meta[property='og:image'], meta[name='twitter:image']")) {
          push(meta.content, "og", meta.getAttribute("property") || meta.getAttribute("name"));
        }
        return out;
      });

      // Dedup + skoring.
      const seen = new Set();
      const scored = candidates
        .filter((c) => {
          const key = c.src.split("?")[0];
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .map((c) => {
          let score = 0;
          if (c.kind === "header") score += 50;
          if (c.kind === "alt-logo") score += 60;
          if (c.kind === "icon") score += 30;
          if (c.kind === "og") score += 20;
          if (/logo/i.test(c.alt)) score += 25;
          // Foto produk/hero biasanya besar -> kurang cocok sebagai logo.
          if (c.w >= 600 && c.h >= 600) score -= 35;
          if (c.w && c.h && c.w <= 512 && c.h <= 512) score += 15;
          return { ...c, score };
        })
        .sort((a, b) => b.score - a.score);

      console.log(`--- ${entity.slug} @ ${source} (${res?.status()}) ---`);
      for (const c of scored.slice(0, 6)) {
        console.log(`   [${c.score}] ${c.kind} ${c.w}x${c.h} ${c.alt} :: ${c.src.slice(0, 120)}`);
      }

      // Unduh kandidat terbaik sampai berhasil.
      for (const c of scored) {
        if (c.score <= 0) break;
        try {
          const url = unwrapNextImage(c.src);
          const resp = await page.request.get(url, { timeout: 30000 });
          if (!resp.ok()) continue;
          const buf = await resp.body();
          if (buf.length < 800) continue;
          const type = resp.headers()["content-type"] || "";
          if (!/image/.test(type)) continue;
          const ext = /svg/.test(type) ? "svg" : /png/.test(type) ? "png" : "jpg";
          const file = path.join(OUT, `${entity.slug}.${ext}`);
          await fs.writeFile(file, buf);
          console.log(`SAVED ${entity.slug}.${ext} ${buf.length}B from ${c.kind} (${c.src.slice(0, 90)})`);
          manifest.push({ slug: entity.slug, file: `${entity.slug}.${ext}`, kind: c.kind, url, bytes: buf.length });
          saved = true;
          break;
        } catch {
          /* coba kandidat berikutnya */
        }
      }
    } catch (error) {
      console.log(`FAIL ${entity.slug} @ ${source} -> ${error.message}`);
    }
  }

  if (!saved) console.log(`GIVEUP ${entity.slug}`);
  await page.close().catch(() => {});
  await context.close().catch(() => {});
}

await browser.close();
await fs.writeFile(path.join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log("DONE");
