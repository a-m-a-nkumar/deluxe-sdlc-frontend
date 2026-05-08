import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  // Build ID baked into the bundle. Used at runtime to detect stale
  // localStorage state (old MSAL accounts, old session metadata) after
  // a deploy and force a one-time clear+reload. Each build gets a fresh
  // value, so any client carrying a different ID knows its state is
  // out of date.
  define: {
    __BUILD_ID__: JSON.stringify(process.env.BUILD_ID || `${Date.now()}`),
  },
  server: {
    host: "::",
    port: 8080,
    allowedHosts: process.env.ALLOWED_HOSTS?.split(',') || [],
    proxy: {
      '/api': {
        target: process.env.VITE_PROXY_API_TARGET || 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, '/api')
      },
      '/confluence-api': {
        target: process.env.VITE_PROXY_CONFLUENCE_TARGET || 'https://deluxe.atlassian.net',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/confluence-api/, '')
      }
    }
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
