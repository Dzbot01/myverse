/**
 * Cek produksi: apakah halaman Project di situs live sudah menampilkan
 * 7 project tanpa domain yang dihapus.
 */
import fs from "node:fs/promises";
import { chromium } from "playwright";

const BASE = process.env.BASE_URL || "https://myversedev.vercel.app";
const OUT = ".recon/prod";

await fs.mkdir(OUT, { recursive: true });

const res = await fetch(BASE, { headers: { "user-agent": "Mozilla/5.0" } });
const html = await res.text();
await fs.writeFile(`${OUT}/index.html`, html);

const lines = [`page status: ${res.status}`, `bytes: ${html.length}`];
lines.push(`domain portofolio-me ada: ${html.includes("portofolio-me")}`);
lines.push(`domain vtdownloader ada: ${html.includes("vtdownloader")}`);
const refs = [...new Set(html.match(/assets\/projects\/[a-z0-9.-]+/g) || [])].sort();
lines.push(`project screenshot refs: ${refs.length}`);
for (const ref of refs) {
  const r = await fetch(`${BASE}/${ref}`, { headers: { "user-agent": "Mozilla/5.0" } });
  const buf = Buffer.from(await r.arrayBuffer());
  lines.push(`  ${ref} -> ${r.status} ${r.headers.get("content-type")} ${buf.length}B`);
}
for (const gone of ["08-portofolio-me.jpg", "09-vtdown.jpg"]) {
  const r = await fetch(`${BASE}/assets/projects/${gone}`, { headers: { "user-agent": "Mozilla/5.0" } });
  lines.push(`  ${gone} -> ${r.status} (harus 404)`);
}

const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, locale: "id-ID" });
const page = await context.newPage();
await page.goto(BASE, { waitUntil: "networkidle", timeout: 90000 });
const menu = page.getByRole("button", { name: /buka menu/i }).first();
if (await menu.count()) {
  await menu.click();
  await page.waitForTimeout(600);
}
await page.getByRole("button", { name: /^project$/i }).first().click();
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/live-project.png`, fullPage: true });

const live = await page.evaluate(() => ({
  cards: [...document.querySelectorAll("article h3")].map((h) => h.textContent.trim()),
  images: [...document.querySelectorAll('img[src*="assets/projects/"]')].map((i) => ({
    src: i.getAttribute("src"),
    ok: i.complete && i.naturalWidth > 0,
  })),
  bodyHas: {
    portofolioMe: document.body.innerText.includes("portofolio-me"),
    vtdownloader: document.body.innerText.includes("vtdownloader"),
  },
}));
lines.push(`live cards (${live.cards.length}): ${JSON.stringify(live.cards)}`);
lines.push(`live images ok: ${live.images.every((i) => i.ok)} (${live.images.length} gambar)`);
lines.push(`live teks portofolio-me: ${live.bodyHas.portofolioMe}`);
lines.push(`live teks vtdownloader: ${live.bodyHas.vtdownloader}`);

// Halaman Experience: pastikan diagram + logo ikut ter-deploy.
const expRefs = [...new Set(html.match(/assets\/experience\/[a-z0-9.-]+/g) || [])].sort();
lines.push(`experience logo refs: ${expRefs.length}`);
for (const ref of expRefs) {
  const r = await fetch(`${BASE}/${ref}`, { headers: { "user-agent": "Mozilla/5.0" } });
  const buf = Buffer.from(await r.arrayBuffer());
  lines.push(`  ${ref} -> ${r.status} ${r.headers.get("content-type")} ${buf.length}B`);
}
// Buka menu lagi (drawer tertutup setelah memilih Project).
const menu2 = page.getByRole("button", { name: /buka menu/i }).first();
if (await menu2.count()) {
  await menu2.click();
  await page.waitForTimeout(600);
}
await page.getByRole("button", { name: /^experience$/i }).first().click();
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/live-experience.png`, fullPage: true });
const expLive = await page.evaluate(() => ({
  logos: [...document.querySelectorAll('img[alt*="Logo" i]')].map((i) => ({
    alt: i.getAttribute("alt"),
    ok: i.complete && i.naturalWidth > 0,
  })),
  root: document.body.innerText.includes("25 Mei 2026"),
}));
lines.push(`live logo experience: ${JSON.stringify(expLive.logos)}`);
lines.push(`live teks "25 Mei 2026": ${expLive.root}`);
await browser.close();

await fs.writeFile(`${OUT}/prod.txt`, lines.join("\n") + "\n");
console.log(lines.join("\n"));
