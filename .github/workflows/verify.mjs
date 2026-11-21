import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const OUT = path.resolve(".recon/verify");
const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

await fs.mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  userAgent: UA,
});
const page = await context.newPage();

const problems = [];
page.on("requestfailed", (r) => problems.push(`REQFAIL ${r.url()}`));
page.on("response", (r) => {
  if (r.status() >= 400) problems.push(`${r.status()} ${r.url()}`);
});

await page.goto("http://127.0.0.1:4173/", { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(2000);

// Navigasi ada di drawer "Menu" -> buka dulu, lalu pilih Project.
await page.getByRole("button", { name: /Buka menu/i }).click({ timeout: 10000 });
await page.waitForTimeout(900);
await page.getByRole("button", { name: "Project", exact: true }).click({ timeout: 10000 });
await page.waitForTimeout(3000);

const imgs = await page.evaluate(() =>
  [...document.querySelectorAll("img")]
    .filter((i) => (i.getAttribute("src") || "").includes("assets/projects/"))
    .map((i) => ({
      src: i.getAttribute("src"),
      complete: i.complete,
      naturalW: i.naturalWidth,
      naturalH: i.naturalHeight,
      alt: i.getAttribute("alt"),
    })),
);

console.log("project images rendered:", JSON.stringify(imgs, null, 2));
console.log(
  "count:",
  imgs.length,
  "| all decoded:",
  imgs.length > 0 && imgs.every((i) => i.complete && i.naturalW > 0 && i.naturalH > 0),
);
console.log("problems:", problems);

await page.screenshot({ path: path.join(OUT, "project-page.png"), fullPage: true });
await browser.close();
console.log("DONE");
