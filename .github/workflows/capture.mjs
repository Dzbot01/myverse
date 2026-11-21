/**
 * Capture screenshot asli tiap website project.
 *
 * Dijalankan di GitHub Actions (runner Ubuntu punya Chromium + internet penuh).
 * Hasil disimpan ke public/assets/projects/<slug>.png lalu di-commit ke branch.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const OUT_DIR = path.resolve("public/assets/projects");
const VIEWPORT = { width: 1440, height: 900 };

/** Target utama + kandidat cadangan (dipakai bila domain utama mati). */
const TARGETS = [
  { slug: "boosteryuk", url: "https://boosteryuk.com", fallbacks: [] },
  {
    slug: "job-gmail",
    url: "https://job-gmail.vercel.app",
    fallbacks: ["https://job-gmail.vercel.app/"],
  },
  { slug: "bdpsukses", url: "https://bdpsukses.my.id", fallbacks: ["https://bdpsukses.my.id/"] },
  {
    slug: "jajosteak",
    url: "https://jajosteak.vercel.app",
    fallbacks: ["https://jajosteak.vercel.app/"],
  },
  { slug: "cekidku", url: "https://cekidku.my.id", fallbacks: ["https://cekidku.my.id/"] },
  {
    slug: "gemasstudio",
    url: "https://gemasstudio.vercel.app",
    fallbacks: ["https://gemasstudio.vercel.app/"],
  },
  {
    slug: "mr-toolbox",
    url: "https://mr-toolbox.vercel.app",
    fallbacks: ["https://mr-toolbox.vercel.app/"],
  },
  {
    slug: "portofolio-me-neon-phl",
    url: "https://portofolio-me-neon-phl.vercel.app",
    fallbacks: ["https://portofolio-me-neon-phl.vercel.app/"],
  },
  {
    slug: "vtdown",
    url: "https://vtdown.vercel.app",
    fallbacks: [
      "https://vtdown.vercel.app/",
      "https://vtdown.web.app",
      "https://vtdown.netlify.app",
      "https://vtdown.pages.dev",
      "https://vtdown.my.id",
      "https://vtdown.id",
      "https://www.vtdown.id",
      "https://vtdown.co.id",
    ],
  },
];

const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

async function saveBuffer(buffer, file) {
  await fs.writeFile(file, buffer);
  const { size } = await fs.stat(file);
  console.log(`SAVED ${file} (${Math.round(size / 1024)} KB)`);
}

/** Screenshot via microlink API (fallback bila Chromium gagal memuat halaman). */
async function captureViaMicrolink(url, file) {
  const api = `https://api.microlink.io/?url=${encodeURIComponent(
    url,
  )}&screenshot=true&meta=false&viewport.width=${VIEWPORT.width}&viewport.height=${VIEWPORT.height}&screenshot.type=jpeg&screenshot.quality=82`;

  const res = await fetch(api, { headers: { "user-agent": UA } });
  if (!res.ok) throw new Error(`microlink http ${res.status}`);
  const json = await res.json();
  if (json.status !== "success" || !json.data?.screenshot?.url) {
    throw new Error(`microlink status ${json.status}`);
  }
  const img = await fetch(json.data.screenshot.url, { headers: { "user-agent": UA } });
  if (!img.ok) throw new Error(`microlink image http ${img.status}`);
  const buffer = Buffer.from(await img.arrayBuffer());
  await saveBuffer(buffer, file);
  return json.data.screenshot.url;
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
    userAgent: UA,
    locale: "id-ID",
  });

  const report = [];

  for (const target of TARGETS) {
    const file = path.join(OUT_DIR, `${target.slug}.jpg`);
    const candidates = [target.url, ...target.fallbacks];
    let done = false;

    for (const candidate of candidates) {
      const page = await context.newPage();
      try {
        const response = await page.goto(candidate, {
          waitUntil: "domcontentloaded",
          timeout: 45000,
        });
        const status = response?.status() ?? 0;
        // Beri waktu render + lazy-load + animasi awal.
        await page.waitForTimeout(3500);
        const title = await page.title();
        const bodyText = await page.evaluate(() => document.body?.innerText?.slice(0, 400) ?? "");
        const blocked =
          status >= 400 ||
          /just a moment|attention required|verify you are human|access denied|error 40/i.test(
            `${title} ${bodyText}`,
          );

        if (blocked) {
          console.log(`SKIP ${candidate} -> status ${status} title "${title}"`);
          await page.close();
          continue;
        }

        await page.screenshot({ path: file, type: "jpeg", quality: 82 });
        await saveBuffer(await fs.readFile(file), file);
        report.push({ slug: target.slug, url: candidate, status, title, via: "chromium" });
        console.log(`OK ${target.slug} <- ${candidate} (${status}) "${title}"`);
        await page.close();
        done = true;
        break;
      } catch (error) {
        console.log(`FAIL ${candidate} -> ${error.message}`);
        await page.close().catch(() => {});
      }
    }

    if (!done) {
      // Fallback terakhir: layanan screenshot pihak ketiga.
      try {
        const imageUrl = await captureViaMicrolink(target.url, file);
        report.push({ slug: target.slug, url: target.url, status: 0, title: "", via: "microlink" });
        console.log(`OK ${target.slug} <- microlink (${imageUrl})`);
      } catch (error) {
        console.log(`GIVEUP ${target.slug} -> ${error.message}`);
        report.push({ slug: target.slug, url: target.url, status: 0, title: "", via: "failed" });
      }
    }
  }

  await browser.close();
  await fs.writeFile(path.join(OUT_DIR, "capture-report.json"), JSON.stringify(report, null, 2));
  console.log("REPORT " + JSON.stringify(report));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
