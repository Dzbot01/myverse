import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const OUT = path.resolve(".recon/recapture");
const VIEWPORT = { width: 1440, height: 900 };
const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

/** Target + strategi menutup overlay agar konten utama situs terlihat. */
const TARGETS = [
  { slug: "03-bdps", url: "https://bdpsukses.my.id" },
  { slug: "05-cekidku", url: "https://cekidku.my.id" },
];

const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
await fs.mkdir(OUT, { recursive: true });

for (const target of TARGETS) {
  const context = await browser.newContext({
    viewport: VIEWPORT,
    userAgent: UA,
    locale: "id-ID",
    timezoneId: "Asia/Jakarta",
    extraHTTPHeaders: {
      "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
      "Upgrade-Insecure-Requests": "1",
    },
  });
  const page = await context.newPage();
  try {
    const res = await page.goto(target.url, { waitUntil: "domcontentloaded", timeout: 60000 });

    // Tunggu jika ada Cloudflare challenge atau hydration.
    await page.waitForTimeout(9000);

    // Tutup overlay: tombol X di dialog, tombol penutup, tombol Decline/Tutup, atau Escape.
    const closers = [
      'button[aria-label*="Close" i]',
      'button[aria-label*="Tutup" i]',
      '[role="dialog"] button:has(svg)',
      '[role="dialog"] button >> nth=0',
      "button:has-text('Decline')",
      "button:has-text('Tutup')",
    ];
    for (const sel of closers) {
      try {
        const el = page.locator(sel).first();
        if ((await el.count()) && (await el.isVisible({ timeout: 1200 }))) {
          await el.click({ timeout: 2500 });
          await page.waitForTimeout(1200);
          console.log(`CLICKED ${sel} on ${target.slug}`);
          break;
        }
      } catch {
        /* lanjut ke strategi berikutnya */
      }
    }
    // Sebagian dialog hanya bisa ditutup dengan Escape.
    try {
      await page.keyboard.press("Escape");
      await page.waitForTimeout(800);
    } catch {
      /* abaikan */
    }
    await page.waitForTimeout(1500);

    const file = path.join(OUT, `${target.slug}.jpg`);
    await page.screenshot({ path: file, type: "jpeg", quality: 82 });
    const title = await page.title();
    console.log(`OK ${target.slug} status=${res?.status()} title="${title}"`);
  } catch (error) {
    console.log(`FAIL ${target.slug} ${error.message}`);
  }
  await page.close().catch(() => {});
  await context.close().catch(() => {});
}

await browser.close();
console.log("DONE");
