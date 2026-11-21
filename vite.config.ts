import fs from "node:fs";
import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Folder `assets/` berisi tangkapan layar asli website project.
 * Folder ini berada di root repo (bukan di `public/`), jadi perlu disalin
 * manual ke output build supaya gambar ikut ter-deploy.
 */
function copyAssetsFolder(): Plugin {
  const source = path.resolve(__dirname, "assets");
  return {
    name: "myverse-copy-assets",
    apply: "build",
    closeBundle() {
      if (!fs.existsSync(source)) return;
      const target = path.resolve(__dirname, "dist/assets");
      fs.cpSync(source, target, { recursive: true });
      console.log(`\n[myverse] ${path.relative(__dirname, source)} -> dist/assets\n`);
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), copyAssetsFolder(), viteSingleFile()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
