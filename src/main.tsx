import ReactDOM from "react-dom/client";
import App from "./App";
import { registerServiceWorker } from "./registerSW";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(<App />);

// Makes the app installable to a phone home screen. No-op in dev.
registerServiceWorker();
