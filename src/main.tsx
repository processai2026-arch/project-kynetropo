import ReactDOM from "react-dom/client";
import App from "./App";
import { registerServiceWorker } from "./registerSW";
// Imported first so the browser's one-off install offer is caught before the header mounts.
import "./hooks/useInstallApp";
import { isInstalledApp } from "./hooks/useInstallApp";
import "./index.css";
import "./styles/enterprise.css";
import { applySkin, followSkinOnResize } from "./lib/uiSkin";

// The enterprise look, set before the first paint (off for the Sales app on a phone).
applySkin(window.location.pathname);
followSkinOnResize();

// The installed app does not pinch-zoom, like any other app (Diamond Fencing's). A browser tab still can.
if (isInstalledApp()) {
  for (const ev of ["gesturestart", "gesturechange"]) document.addEventListener(ev, (e) => e.preventDefault(), { passive: false });
}

ReactDOM.createRoot(document.getElementById("root")!).render(<App />);

// Makes the app installable to a phone home screen. No-op in dev.
registerServiceWorker();
