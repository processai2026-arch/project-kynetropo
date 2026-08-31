import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";

/**
 * The SOURCE html entry is `app.html`, not `index.html`.
 *
 * Deploys copy the contents of `dist/` into this directory (that is where the
 * live `index.html` + `assets/` at the project root come from). When the entry
 * template was also called `index.html`, a deploy overwrote the source file and
 * the project could no longer be built. Keeping the source under a different
 * name makes that collision impossible; the build still emits `dist/index.html`
 * so nothing about deployment changes.
 */
const APP_ENTRY = "app.html";

export default defineConfig({
  plugins: [
    react(),
    // Copy pdfjs worker to dist root so browser can load it with correct MIME type
    {
      name: "copy-pdfjs-worker",
      writeBundle() {
        const src = path.resolve(__dirname, "node_modules/pdfjs-dist/build/pdf.worker.min.mjs");
        const dest = path.resolve(__dirname, "dist/pdf.worker.min.mjs");
        if (fs.existsSync(src)) fs.copyFileSync(src, dest);
      },
    },
    // Emit the entry as dist/index.html so the deploy target is unchanged.
    {
      name: "emit-index-html",
      writeBundle() {
        const from = path.resolve(__dirname, "dist", APP_ENTRY);
        const to = path.resolve(__dirname, "dist/index.html");
        if (fs.existsSync(from)) fs.renameSync(from, to);
      },
    },
    // Dev server: serve the app at "/" even though the template is app.html.
    {
      name: "dev-entry-rewrite",
      apply: "serve",
      configureServer(server) {
        server.middlewares.use((req, _res, next) => {
          if (req.url === "/" || req.url === "/index.html") req.url = `/${APP_ENTRY}`;
          next();
        });
      },
    },
  ],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  build: {
    rollupOptions: {
      input: path.resolve(__dirname, APP_ENTRY),
    },
  },
});
