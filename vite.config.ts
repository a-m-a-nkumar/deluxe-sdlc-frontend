import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const basePath = process.env.VITE_BASE_PATH || env.VITE_BASE_PATH || '/';
  console.log('[vite.config] VITE_BASE_PATH from process.env:', process.env.VITE_BASE_PATH);
  console.log('[vite.config] VITE_BASE_PATH from loadEnv:', env.VITE_BASE_PATH);
  console.log('[vite.config] Using base:', basePath);
  return {
  base: basePath,
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
};
});
