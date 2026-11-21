import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const OUT = path.resolve(".recon/candidates");
const VIEWPORT = { width: 1440, height: 900 };
const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const CANDIDATES = [
  ["vtdownloader", "https://vtdownloader.vercel.app"],
  ["vtdownload", "https://vtdownload.vercel.app"],
  ["vt-downloader", "https://vt-downloader.vercel.app"],
  ["portofolio-me", "https://portofolio-me.vercel.app"],
  ["portofolio", "https://portofolio.vercel.app"],
  ["portofolio-neon", "https://portofolio-neon.vercel.app"],
  ["snapgram-io", "https://snapgram.io"],
  ["snapgram", "https://snapgram.vercel.app"],
  ["maxstore-my-id", "https://maxstore.my.id"],
];

const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const context = await browser.newContext({ viewport: VIEWPORT, userAgent: UA });
await fs.mkdir(OUT, { recursive: true });

for (const [slug, url] of CANDIDATES) {
  const page = await context.newPage();
  try {
    const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(3500);
    const title = await page.title();
    const file = path.join(OUT, `${slug}.jpg`);
    await page.screenshot({ path: file, type: "jpeg", quality: 82 });
    console.log(`OK ${slug} ${url} status=${res?.status()} title="${title}"`);
  } catch (error) {
    console.log(`FAIL ${slug} ${url} ${error.message}`);
  }
  await page.close().catch(() => {});
}

await browser.close();
