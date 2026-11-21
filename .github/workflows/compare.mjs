import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const OUT = path.resolve(".recon/compare");
const VIEWPORT = { width: 1440, height: 900 };
const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const CANDIDATES = [
  ["01-vtdownloader-global", "https://vtdownloader.vercel.app"],
  ["02-vtdownloader-bro", "https://vtdownloader-bro-fiks-projects.vercel.app"],
  ["03-vtdownloader-dzs", "https://vtdownloader-dzs-projects-44164dee.vercel.app"],
  ["04-vtdownload-global", "https://vtdownload.vercel.app"],
  ["05-vt-downloader-global", "https://vt-downloader.vercel.app"],
  ["06-portofolio-me-global", "https://portofolio-me.vercel.app"],
  ["07-portofolio-me-dzs", "https://portofolio-me-dzs-projects-44164dee.vercel.app"],
  ["08-portofolio-global", "https://portofolio.vercel.app"],
  ["09-portofolio-dzs", "https://portofolio-dzs-projects-44164dee.vercel.app"],
  ["10-portofolio-neon-global", "https://portofolio-neon.vercel.app"],
  ["11-myversedev", "https://myversedev.vercel.app"],
  ["12-portofolio-me-neon-phl", "https://portofolio-me-neon-phl.vercel.app"],
];

const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const context = await browser.newContext({ viewport: VIEWPORT, userAgent: UA });
await fs.mkdir(OUT, { recursive: true });

const lines = [];

for (const [slug, url] of CANDIDATES) {
  const page = await context.newPage();
  try {
    const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(3500);
    const status = res?.status() ?? 0;
    const title = await page.title();
    const info = await page.evaluate(() => {
      const txt = document.body?.innerText?.slice(0, 300) ?? "";
      const links = [...document.querySelectorAll("a[href]")]
        .map((a) => a.getAttribute("href"))
        .filter((h) => h && /instagram|linkedin|github|twitter|x\.com|tiktok/i.test(h))
        .slice(0, 6);
      const css = [...document.querySelectorAll("style")]
        .map((s) => s.textContent || "")
        .join(" ")
        .slice(0, 200000);
      const neonish = (css.match(/neon|#[0-9a-f]{6}/gi) || []).slice(0, 400);
      return { txt, links, neonish: neonish.slice(0, 30) };
    });
    const file = path.join(OUT, `${slug}.jpg`);
    await page.screenshot({ path: file, type: "jpeg", quality: 78 });
    lines.push(
      `### ${slug} ${url}\nSTATUS ${status}\nTITLE ${title}\nTEXT ${info.txt.replace(/\n/g, " | ")}\nLINKS ${info.links.join(" ")}\nCOLORS ${[...new Set(info.neonish)].join(" ")}\n`,
    );
    console.log(`OK ${slug} ${status} ${title}`);
  } catch (error) {
    lines.push(`### ${slug} ${url}\nERROR ${error.message}\n`);
    console.log(`FAIL ${slug} ${error.message}`);
  }
  await page.close().catch(() => {});
}

await browser.close();
await fs.writeFile(path.join(OUT, "compare.txt"), lines.join("\n"));
console.log("DONE");
