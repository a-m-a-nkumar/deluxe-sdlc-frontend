import { createRoot } from "react-dom/client";
import { THEME } from "./config/theme";
import App from "./App.tsx";
import "./index.css";

// Apply theme to <html> so CSS :root[data-theme] selectors activate
document.documentElement.setAttribute("data-theme", THEME);

createRoot(document.getElementById("root")!).render(<App />);
