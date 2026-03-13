// Get base URL from environment variable (Vite requires VITE_ prefix)
// Must be origin only (e.g. empty, or https://deluxe.siriusai.com). Do NOT set to /api — paths already include /api/...
// ALB routes /api/* to backend; frontend must request /api/... once, not /api/api/...
const rawBase = import.meta.env.VITE_API_BASE_URL ?? "";
const BASE_URL_ENDPOINT =
  rawBase === "" || rawBase === "/api"
    ? import.meta.env.DEV
      ? "http://localhost:8000"
      : ""
    : rawBase.replace(/\/api\/?$/, ""); // strip trailing /api if someone set full URL with /api

if (!import.meta.env.VITE_API_BASE_URL && !import.meta.env.DEV) {
  console.info("[API] VITE_API_BASE_URL not set in production, using relative paths (ALB proxies /api/* to backend)");
}

// API Configuration
export const API_CONFIG = {
  // Base URL for all API endpoints (direct to backend, no /api/v1 prefix)
  BASE_URL: BASE_URL_ENDPOINT,

  // Chat API URL — under /api so ALB routes to backend (no trailing slash to avoid 307 redirects)
  CHATBOT_API_URL: `${BASE_URL_ENDPOINT}/api/chat`,

  // Analyst API URL — under /api so ALB routes to backend
  ANALYST_API_URL: `${BASE_URL_ENDPOINT}/api/analyst-chat`,

  // Request timeout in milliseconds
  TIMEOUT: 30000
};

// Instructions for making the API accessible:
// 1. Expose your API through a public load balancer or API Gateway
// 2. Add CORS headers to allow browser requests:
//    - Access-Control-Allow-Origin: * (or your domain)
//    - Access-Control-Allow-Methods: POST, OPTIONS
//    - Access-Control-Allow-Headers: Content-Type
// 3. Update the CHATBOT_API_URL above with your public endpoint