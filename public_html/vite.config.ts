import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";
import crypto from "crypto";

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
    /**
     * Stamp the service worker with this build's identity.
     *
     * public/sw.js is a static file, so it shipped byte-identical on every
     * deploy — and a byte-identical worker is one the browser never re-installs.
     * Its VERSION constant therefore never changed either, which meant the
     * precached shell was never rebuilt, old caches were never swept (activate
     * drops caches "not starting with VERSION", and VERSION was always the
     * same), and registerSW's promote/controllerchange reload never had an
     * update to fire on. A tab open across a deploy stayed on the old build
     * with no way back short of a manual hard reload.
     *
     * The stamp is derived from the emitted filenames rather than the clock, so
     * two builds of the same source stay identical and do not churn the worker
     * for no reason.
     */
    {
      name: "stamp-sw-version",
      writeBundle(_options, bundle) {
        const swPath = path.resolve(__dirname, "dist/sw.js");
        if (!fs.existsSync(swPath)) return;

        const stamp = crypto
          .createHash("sha256")
          .update(Object.keys(bundle).sort().join("\n"))
          .digest("hex")
          .slice(0, 12);

        const src = fs.readFileSync(swPath, "utf8");
        const out = src.replace(/const VERSION = '[^']*';/, `const VERSION = 'kyn-${stamp}';`);
        if (out === src) {
          this.warn("sw.js: VERSION constant not found — the worker will not update on deploy");
          return;
        }
        fs.writeFileSync(swPath, out);
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
