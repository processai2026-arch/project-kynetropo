import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";
import crypto from "crypto";

export default defineConfig({
  plugins: [
    react(),
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
  ],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
