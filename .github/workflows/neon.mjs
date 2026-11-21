import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const OUT = path.resolve(".recon/neon");
const VIEWPORT = { width: 1440, height: 900 };
const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const context = await browser.newContext({ viewport: VIEWPORT, userAgent: UA });
await fs.mkdir(OUT, { recursive: true });

const lines = [];

async function shoot(slug, url, { clicks = [] } = {}) {
  const page = await context.newPage();
  try {
    const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(3500);
    const status = res?.status() ?? 0;
    const title = await page.title();
    const clickLog = [];
    for (const label of clicks) {
      try {
        const target = page.getByText(label, { exact: false }).first();
        await target.click({ timeout: 5000 });
        await page.waitForTimeout(1500);
        clickLog.push(`${label}:yes`);
      } catch (e) {
        clickLog.push(`${label}:no`);
      }
    }
    const info = await page.evaluate(() => {
      const css = [...document.querySelectorAll("style")]
        .map((s) => s.textContent || "")
        .join(" ");
      const all = document.documentElement.outerHTML;
      return {
        txt: (document.body?.innerText || "").slice(0, 700).replace(/\n+/g, " | "),
        links: [...new Set([...document.querySelectorAll("a[href]")]
          .map((a) => a.getAttribute("href"))
          .filter((h) => h && !h.startsWith("#")))]
          .slice(0, 25),
        hasNeon: /neon/i.test(all),
        hasPhl: /\bphl\b/i.test(all),
        colors: [...new Set(css.match(/#[0-9a-fA-F]{6}/g) || [])].slice(0, 25),
        glow: (css.match(/glow|text-shadow|box-shadow/gi) || []).length,
      };
    });
    await page.screenshot({ path: path.join(OUT, `${slug}.jpg`), type: "jpeg", quality: 82 });
    lines.push(
      `### ${slug} ${url}\nSTATUS ${status}\nTITLE ${title}\nCLICK ${clickLog.join(" ")}\nNEON ${info.hasNeon} PHL ${info.hasPhl} GLOW ${info.glow}\nCOLORS ${info.colors.join(" ")}\nLINKS ${info.links.join(" ")}\nTEXT ${info.txt}\n`,
    );
    console.log(`OK ${slug} ${status} "${title}" neon=${info.hasNeon} phl=${info.hasPhl}`);
    await page.close().catch(() => {});
  } catch (error) {
    lines.push(`### ${slug} ${url}\nERROR ${error.message}\n`);
    console.log(`FAIL ${slug} ${error.message}`);
    await page.close().catch(() => {});
  }
}

// Dark/neon variants of each portfolio candidate.
await shoot("pme-dark", "https://portofolio-me.vercel.app", { clicks: ["Dark Mode"] });
await shoot("pneon-dark", "https://portofolio-neon.vercel.app", { clicks: ["Dark"] });
await shoot("prami-dark", "https://portofolio.vercel.app", { clicks: ["Dark"] });

// Extra global-name probes for the neon-phl slot.
const UA2 = UA;
for (const name of [
  "portofolio-me-neon",
  "portofolio-neon-phl",
  "portofolio-me-phl",
  "portfolio-neon",
  "portofolio-neon-phl-me",
  "phl-portofolio",
  "portofolio-phl",
  "neon-portofolio",
]) {
  const res = await fetch(`https://${name}.vercel.app`, { redirect: "follow" });
  const body = await res.text();
  const title = (body.match(/<title[^>]*>([^<]*)<\/title>/i) || [])[1] || "";
  const is404 = /404|NOT_FOUND|doesn't exist/i.test(body.slice(0, 3000));
  lines.push(`### PROBE https://${name}.vercel.app -> ${res.status} 404ish=${is404} title="${title}"`);
  console.log(`PROBE ${name} ${res.status} 404ish=${is404} "${title}"`);
}

await browser.close();
await fs.writeFile(path.join(OUT, "neon.txt"), lines.join("\n"));
console.log("DONE");
