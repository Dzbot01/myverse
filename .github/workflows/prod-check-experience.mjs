/**
 * Cek produksi: apakah situs live sudah menyajikan 5 logo Experience
 * dan seluruh teks diagram bercabang.
 */
import fs from "node:fs/promises";

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
lines.push(`picsum present: ${html.includes("picsum")}`);
for (const t of texts) {
  const escaped = t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  lines.push(`text "${t}": ${new RegExp(escaped).test(html)}`);
}

await fs.writeFile(`${OUT}/prod.txt`, lines.join("\n") + "\n");
console.log(lines.join("\n"));
