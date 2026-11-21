import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const OUT = path.resolve(".recon/recapture");
const VIEWPORT = { width: 1440, height: 900 };
const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

/** Target + tombol yang perlu ditutup agar konten utama terlihat. */
const TARGETS = [
  { slug: "03-bdps", url: "https://bdpsMAD.my.id", close: ["Decline", "Accept", "Tutup", "×", "✕", "X"] },
  { slug: "05-cekidku", url: "https://cekidku.my.id", close: ["Tutup", "×", "✕", "X", "Close"] },
];

const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const context = await browser.newContext({ viewport: VIEWPORT, userAgent: UA, locale: "id-ID" });
await fs.mkdir(OUT, { recursive: true });

for (const target of TARGETS) {
  const page = await context.newPage();
  try {
    const res = await page.goto(target.url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(4000);

    // Tutup modal agar screenshot menampilkan konten utama situs.
    for (const label of target.close) {
      try {
        const btn = page.getByText(label, { exact: true }).first();
        if (await btn.isVisible({ timeout: 1200 })) {
          await btn.click({ timeout: 2500 });
          await page.waitForTimeout(900);
          console.log(`CLICKED "${label}" on ${target.slug}`);
          break;
        }
      } catch {
        /* tombol tidak ada -> coba berikutnya */
      }
    }
    await page.waitForTimeout(1200);

    const file = path.join(OUT, `${target.slug}.jpg`);
    await page.screenshot({ path: file, type: "jpeg", quality: 82 });
    const title = await page.title();
    console.log(`OK ${target.slug} status=${res?.status()} title="${title}"`);
  } catch (error) {
    console.log(`FAIL ${target.slug} ${error.message}`);
  }
  await page.close().catch(() => {});
}

await browser.close();
console.log("DONE");
