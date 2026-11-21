/**
 * Cek produksi: apakah situs live sudah menyajikan 5 logo Experience
 * dan seluruh teks diagram bercabang. Termasuk tangkapan layar halaman live.
 */
import fs from "node:fs/promises";
import { chromium } from "playwright";

const BASE = process.env.BASE_URL || "https://myversedev.vercel.app";
const OUT = ".recon/prod";

await fs.mkdir(OUT, { recursive: true });

const res = await fetch(BASE, { headers: { "user-agent": "Mozilla/5.0" } });
const html = await res.text();
await fs.writeFile(`${OUT}/index.html`, html);

const logos = [...new Set(html.match(/assets\/experience\/[a-z0-9.-]+/g) || [])].sort();
const lines = [`page status: ${res.status}`, `bytes: ${html.length}`, `logo refs: ${logos.length}`];

for (const ref of logos) {
  const url = `${BASE}/${ref}`;
  const r = await fetch(url, { headers: { "user-agent": "Mozilla/5.0" } });
  const buf = Buffer.from(await r.arrayBuffer());
  lines.push(`${ref} -> ${r.status} ${r.headers.get("content-type")} ${buf.length}B`);
}

const texts = [
  "Lakuki Store 2",
  "Tim Gudang",
  "Gudang JNT",
  "PT AKHASA WIRA INTERNATIONAL",
  "Loader (muat barang)",
  "Jajo Steak",
  "Crew Store",
  "PT ABRA BIONERGI NUSANTARA",
  "Operator Produksi Briket",
  "25 Mei 2026",
];
for (const t of texts) {
  const escaped = t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  lines.push(`text "${t}": ${new RegExp(escaped).test(html)}`);
}

// Tangkapan layar halaman Experience di situs live.
const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, locale: "id-ID" });
const page = await context.newPage();
await page.goto(BASE, { waitUntil: "networkidle", timeout: 90000 });
const menu = page.getByRole("button", { name: /buka menu/i }).first();
if (await menu.count()) {
  await menu.click();
  await page.waitForTimeout(600);
}
await page.getByRole("button", { name: /^experience$/i }).first().click();
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/live-experience.png`, fullPage: true });

const live = await page.evaluate(() => ({
  picsumInExperience: document.body.innerHTML.includes("picsum.photos"),
  logos: [...document.querySelectorAll('img[alt*="Logo" i]')].map((i) => ({
    alt: i.getAttribute("alt"),
    ok: i.complete && i.naturalWidth > 0,
    w: Math.round(i.getBoundingClientRect().width),
    h: Math.round(i.getBoundingClientRect().height),
  })),
}));
lines.push(`picsum di DOM Experience: ${live.picsumInExperience}`);
lines.push(`logo live: ${JSON.stringify(live.logos)}`);
await browser.close();

await fs.writeFile(`${OUT}/prod.txt`, lines.join("\n") + "\n");
console.log(lines.join("\n"));
