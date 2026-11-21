/**
 * Capture screenshot asli setiap website project.
 *
 * Script ini menghasilkan file di `assets/projects/*.jpg` yang dipakai oleh
 * halaman Project di `src/App.tsx`. Dijalankan di GitHub Actions (runner
 * Ubuntu menyediakan Chromium + akses internet penuh), lalu hasilnya di-commit.
 *
 *   node .github/workflows/capture-screenshots.mjs
 */
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const OUT_DIR = path.resolve("assets/projects");
const VIEWPORT = { width: 1440, height: 900 };
const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

/**
 * Domain setiap project (sesuai daftar PROJECTS di src/App.tsx) dan URL
 * tempat screenshot diambil.
 */
const TARGETS = [
  { file: "01-boosteryuk.jpg", url: "https://boosteryuk.com" },
  { file: "02-job-gmail.jpg", url: "https://job-gmail.vercel.app" },
  { file: "03-bdps.jpg", url: "https://bdpsukses.my.id" },
  { file: "04-jajosteak.jpg", url: "https://jajosteak.vercel.app" },
  { file: "05-cekidku.jpg", url: "https://cekidku.my.id" },
  { file: "06-gemasstudio.jpg", url: "https://gemasstudio.vercel.app" },
  { file: "07-mr-toolbox.jpg", url: "https://mr-toolbox.vercel.app" },
  { file: "08-portofolio-me.jpg", url: "https://portofolio-me.vercel.app", click: "Dark Mode" },
  { file: "09-vtdown.jpg", url: "https://vtdownloader.vercel.app" },
];

/** Selector tombol penutup overlay (cookie/terms/pengumuman) bila muncul. */
const DISMISS_SELECTORS = [
  'button[aria-label*="Close" i]',
  'button[aria-label*="Tutup" i]',
  '[role="dialog"] button:has(svg)',
  '[role="dialog"] button >> nth=0',
  "button:has-text('Decline')",
  "button:has-text('Tutup')",
];

const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
await fs.mkdir(OUT_DIR, { recursive: true });

const report = [];

for (const target of TARGETS) {
  const context = await browser.newContext({
    viewport: VIEWPORT,
    userAgent: UA,
    locale: "id-ID",
    timezoneId: "Asia/Jakarta",
    extraHTTPHeaders: { "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7" },
  });
  const page = await context.newPage();
  const file = path.join(OUT_DIR, target.file);

  try {
    const res = await page.goto(target.url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(4000);

    // Tutup overlay agar screenshot menampilkan konten utama situs.
    for (const selector of DISMISS_SELECTORS) {
      try {
        const el = page.locator(selector).first();
        if ((await el.count()) && (await el.isVisible({ timeout: 1200 }))) {
          await el.click({ timeout: 2500 });
          await page.waitForTimeout(1000);
          break;
        }
      } catch {
        /* lanjut ke strategi berikutnya */
      }
    }
    try {
      await page.keyboard.press("Escape");
      await page.waitForTimeout(600);
    } catch {
      /* abaikan */
    }

    // Beberapa project punya tema gelap; ambil versi yang sesuai.
    if (target.click) {
      try {
        await page.getByText(target.click, { exact: false }).first().click({ timeout: 4000 });
        await page.waitForTimeout(1200);
      } catch {
        /* tombol tidak tersedia -> tetap pakai tampilan default */
      }
    }
    await page.waitForTimeout(1200);

    await page.screenshot({ path: file, type: "jpeg", quality: 82 });
    const title = await page.title();
    const status = res?.status() ?? 0;
    report.push({ file: target.file, url: target.url, status, title });
    console.log(`OK ${target.file} ${target.url} status=${status} "${title}"`);
  } catch (error) {
    report.push({ file: target.file, url: target.url, status: 0, title: "", error: error.message });
    console.log(`FAIL ${target.file} ${target.url} ${error.message}`);
  }

  await page.close().catch(() => {});
  await context.close().catch(() => {});
}

await browser.close();
await fs.writeFile(
  path.join(OUT_DIR, "capture-report.json"),
  JSON.stringify(report, null, 2) + "\n",
);
console.log("DONE");
