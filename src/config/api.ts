// Get base URL from environment variable (Vite requires VITE_ prefix)
// In production, use empty string to use same origin (nginx will proxy /api/* to backend)
// In development, use http://localhost:8000
const BASE_URL_ENDPOINT = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? "http://localhost:8000" : "")

if (!import.meta.env.VITE_API_BASE_URL && !import.meta.env.DEV) {
  console.info("[API] VITE_API_BASE_URL not set in production, using relative paths (nginx will proxy)");
}

// API Configuration
export const API_CONFIG = {
  // Base URL for all API endpoints (direct to backend, no /api/v1 prefix)
  BASE_URL: BASE_URL_ENDPOINT,

  // Chat API URL
  CHATBOT_API_URL: `${BASE_URL_ENDPOINT}/chat/`,

  // Analyst API URL
  ANALYST_API_URL: `${BASE_URL_ENDPOINT}/analyst-chat/`,

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