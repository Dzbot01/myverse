/**
 * Verifikasi halaman Experience: buka di browser sungguhan, cek diagram
 * bercabang dari bawah, urutan kartu, dan keberadaan logo.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const OUT = path.resolve(".recon/experience");
const BASE = process.env.BASE_URL || "http://localhost:4173";

await fs.mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const report = { base: BASE, viewports: [] };

for (const viewport of [
  { name: "desktop", width: 1440, height: 1100 },
  { name: "mobile", width: 390, height: 844 },
]) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1,
    locale: "id-ID",
  });
  const page = await context.newPage();
  const imageErrors = [];
  const failedRequests = [];

  page.on("requestfailed", (request) => failedRequests.push(request.url()));
  page.on("response", (response) => {
    if (response.status() >= 400) failedRequests.push(`${response.status()} ${response.url()}`);
  });

  await page.goto(BASE, { waitUntil: "networkidle", timeout: 60000 });

  // Buka menu -> Experience
  const menu = page.getByRole("button", { name: /buka menu/i }).first();
  if (await menu.count()) {
    await menu.click();
    await page.waitForTimeout(600);
  }
  await page.getByRole("button", { name: /^experience$/i }).first().click();
  await page.waitForTimeout(1200);

  // Cek semua <img> yang termuat.
  const images = await page.evaluate(() =>
    [...document.querySelectorAll("img")].map((img) => ({
      src: img.getAttribute("src"),
      alt: img.getAttribute("alt"),
      nw: img.naturalWidth,
      nh: img.naturalHeight,
      w: Math.round(img.getBoundingClientRect().width),
      h: Math.round(img.getBoundingClientRect().height),
      top: Math.round(img.getBoundingClientRect().top + window.scrollY),
      complete: img.complete,
    })),
  );
  const broken = images.filter((i) => !i.complete || i.nw === 0);

  // Urutan kartu + posisi vertikal (untuk memastikan diagram tumbuh ke atas).
  const cards = await page.evaluate(() => {
    const titles = [...document.querySelectorAll("h3")].map((h) => ({
      text: h.textContent.trim(),
      top: Math.round(h.getBoundingClientRect().top + window.scrollY),
    }));
    return titles;
  });

  const diagram = await page.evaluate(() => {
    const logos = [...document.querySelectorAll('img[alt*="Logo" i]')].map((img) => {
      const r = img.getBoundingClientRect();
      return {
        alt: img.getAttribute("alt"),
        src: img.getAttribute("src"),
        top: Math.round(r.top + window.scrollY),
        left: Math.round(r.left),
        w: Math.round(r.width),
        h: Math.round(r.height),
        nw: img.naturalWidth,
      };
    });
    const root = [...document.querySelectorAll("h3")].find((h) => h.textContent.trim() === "Lulus");
    return {
      logos,
      rootTop: root ? Math.round(root.getBoundingClientRect().top + window.scrollY) : null,
      rootDate: document.body.innerText.includes("25 Mei 2026"),
      bodyHas: {
        lakuki: document.body.innerText.includes("Lakuki Store 2"),
        timGudang: document.body.innerText.includes("Tim Gudang"),
        dw: document.body.innerText.includes("DW"),
        akasha: document.body.innerText.includes("PT AKHASA WIRA INTERNATIONAL"),
        loader: document.body.innerText.includes("Loader (muat barang)"),
        jajo: document.body.innerText.includes("Jajo Steak"),
        crew: document.body.innerText.includes("Crew Store"),
        abra: document.body.innerText.includes("PT ABRA BIONERGI NUSANTARA"),
        briket: document.body.innerText.includes("Operator Produksi Briket"),
        picsum: document.body.innerHTML.includes("picsum.photos"),
      },
    };
  });

  await page.screenshot({ path: path.join(OUT, `${viewport.name}.png`), fullPage: true });

  report.viewports.push({
    viewport: viewport.name,
    imageCount: images.length,
    brokenImages: broken,
    failedRequests,
    cards,
    diagram,
  });

  await context.close();
}

await browser.close();
await fs.writeFile(path.join(OUT, "report.json"), JSON.stringify(report, null, 2) + "\n");
console.log("DONE");
