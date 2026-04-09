import { createRoot } from "react-dom/client";
import { THEME } from "./config/theme";
import App from "./App.tsx";
import "./index.css";

// Apply theme to <html> so CSS :root[data-theme] selectors activate
document.documentElement.setAttribute("data-theme", THEME);

// Set favicon and page title based on theme
document.title = "Veluxe";
const favicon = document.querySelector<HTMLLinkElement>("link[rel='icon']");
if (favicon) {
    favicon.href = THEME === "siriusai" ? "/favicon_sirius.ico" : "/dlx-logo.png";
}

createRoot(document.getElementById("root")!).render(<App />);
