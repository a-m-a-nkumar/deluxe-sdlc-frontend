import axios from "axios";
import { API_CONFIG } from "@/config/api";

const API_BASE_URL = API_CONFIG.BASE_URL;

export interface BackendUserInfo {
  user_id: string;
  email: string;
  name: string;
  identity_arn?: string | null;
  groups: string[];
  allowed_modules: string[];
}

/** Thrown when the backend returns 503 — Microsoft Graph fallback couldn't
 *  resolve groups for an overage user. Transient; the caller should retry. */
export class GraphUnavailableError extends Error {
  constructor(message = "Permission check temporarily unavailable") {
    super(message);
    this.name = "GraphUnavailableError";
  }
}

/**
 * Fetch the authoritative user profile + allowed modules from the backend.
 *
 * The backend:
 *   - handles Azure AD groups-claim overage via Microsoft Graph fallback
 *   - upserts the user row in the DB so admins can see every authenticated user
 *
 * Retries up to 3 times on 503 (Graph fallback transient failure) with
 * exponential backoff (1s, 2s, 4s). After exhausting retries, throws
 * GraphUnavailableError so the caller can render a "temporarily unavailable"
 * page rather than the permanent AccessDenied page — these are different
 * states and shouldn't share UI.
 */
export async function fetchBackendUserInfo(accessToken: string): Promise<BackendUserInfo> {
  const delays = [1000, 2000, 4000];
  let lastError: unknown = null;
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/user/info`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        // Treat 4xx/5xx as response — let us handle 503 vs others
        validateStatus: (s) => s >= 200 && s < 600,
      });
      if (response.status === 200) {
        return response.data as BackendUserInfo;
      }
      if (response.status === 503) {
        lastError = new GraphUnavailableError(
          response.data?.detail || "Permission check temporarily unavailable",
        );
        if (attempt < delays.length) {
          await new Promise((r) => setTimeout(r, delays[attempt]));
          continue;
        }
        throw lastError;
      }
      // 4xx or other non-200 — fall through to caller (axios-shaped error)
      throw Object.assign(new Error(`Backend /api/user/info returned ${response.status}`), {
        response,
      });
    } catch (err) {
      if (err instanceof GraphUnavailableError) {
        // Already a transient — keep retrying via loop if attempts left
        lastError = err;
        if (attempt < delays.length) {
          await new Promise((r) => setTimeout(r, delays[attempt]));
          continue;
        }
        throw err;
      }
      // Other errors (network failure, 401, etc.) — don't retry, surface
      throw err;
    }
  }
  throw lastError ?? new Error("Failed to fetch user info");
}
