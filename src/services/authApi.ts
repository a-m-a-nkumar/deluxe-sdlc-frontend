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

/**
 * Fetch the authoritative user profile + allowed modules from the backend.
 * The backend:
 *   - handles Azure AD groups-claim overage via Microsoft Graph fallback
 *   - upserts the user row in the DB so admins can see every authenticated user
 */
export async function fetchBackendUserInfo(accessToken: string): Promise<BackendUserInfo> {
  const response = await axios.get(`${API_BASE_URL}/api/user/info`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return response.data as BackendUserInfo;
}
