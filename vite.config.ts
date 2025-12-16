import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    allowedHosts: process.env.ALLOWED_HOSTS?.split(',') || [],
    proxy: {
      '/api': {
        target: 'http://deluxe-internet-300914418.us-east-1.elb.amazonaws.com:8000',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, '/api')
      },
      '/confluence-api': {
        target: 'https://siriusai-team-test.atlassian.net',
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
