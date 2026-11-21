import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const OUT = path.resolve(".recon/final");
const VIEWPORT = { width: 1440, height: 900 };
const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const context = await browser.newContext({ viewport: VIEWPORT, userAgent: UA });
await fs.mkdir(OUT, { recursive: true });

async function shoot(slug, url, { click } = {}) {
  const page = await context.newPage();
  try {
    const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(3500);
    const status = res?.status() ?? 0;
    const title = await page.title();
    let clicked = "no";
    if (click) {
      try {
        await page.getByText(click, { exact: false }).first().click({ timeout: 5000 });
        await page.waitForTimeout(1500);
        clicked = "yes";
      } catch (e) {
        clicked = `no (${e.message.slice(0, 60)})`;
      }
    }
    const body = await page.evaluate(() => document.body?.innerText?.slice(0, 200) ?? "");
    await page.screenshot({ path: path.join(OUT, `${slug}.jpg`), type: "jpeg", quality: 82 });
    console.log(`OK ${slug} ${url} status=${status} title="${title}" clicked=${clicked}`);
    console.log(`   BODY ${body.replace(/\n/g, " | ").slice(0, 160)}`);
    await page.close().catch(() => {});
    return { slug, url, status, title, clicked };
  } catch (error) {
    console.log(`FAIL ${slug} ${url} ${error.message}`);
    await page.close().catch(() => {});
    return { slug, url, status: 0, title: "", error: error.message };
  }
}

const results = [];

// 1. Neon portfolio: same site but with the dark/neon theme activated.
results.push(await shoot("neon-01-portofolio-me-dark", "https://portofolio-me.vercel.app", { click: "Dark Mode" }));
results.push(await shoot("neon-02-portofolio-me-light", "https://portofolio-me.vercel.app"));
results.push(await shoot("neon-03-portofolio-neon", "https://portofolio-neon.vercel.app"));
results.push(await shoot("neon-04-portofolio", "https://portofolio.vercel.app"));

// 2. vtdown candidate.
results.push(await shoot("vtdown-01-vtdownloader", "https://vtdownloader.vercel.app"));
results.push(await shoot("vtdown-02-vtdownload", "https://vtdownload.vercel.app"));

await browser.close();
await fs.writeFile(path.join(OUT, "final.json"), JSON.stringify(results, null, 2));
console.log("DONE");
