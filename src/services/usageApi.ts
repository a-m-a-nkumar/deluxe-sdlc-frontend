import { apiGet } from "./api";
import { API_CONFIG } from "@/config/api";

/**
 * Per-module slice of a user's activity. Optional today — backend will
 * populate `modules` once event-level telemetry lands. The UI handles
 * absence gracefully (empty/awaiting state).
 */
export interface ModuleUsage {
  id: string;            // matches sidebar module id: brd, confluence, jira, design, figma, pair-programming, testing, harness
  label: string;
  tokens: number;
  events_count: number;
  last_event_at: string | null;
}

export interface UsageEvent {
  id: string;
  module: string;        // module id
  action: string;        // human-readable, e.g. "BRD draft generated"
  timestamp: string;     // ISO
}

export interface UserUsage {
  user_id: string;
  email: string;
  name: string | null;
  created_at: string | null;
  last_login: string | null;
  token_usage: number;
  is_active?: boolean;
  /** Future: per-module breakdown for this user. */
  modules?: ModuleUsage[];
  /** Future: most recent events for this user. */
  recent_events?: UsageEvent[];
}

export interface OrganizationUsage {
  users: UserUsage[];
  total_users: number;
  total_tokens: number;
  /** Future: org-wide module rollup. */
  modules?: ModuleUsage[];
}

export async function fetchMyUsage(): Promise<UserUsage> {
  const res = await apiGet(`${API_CONFIG.BASE_URL}/api/user/me/usage`);
  if (!res.ok) {
    throw new Error(`Failed to load usage (${res.status})`);
  }
  return (await res.json()) as UserUsage;
}

export async function fetchOrganizationUsage(): Promise<OrganizationUsage> {
  const res = await apiGet(`${API_CONFIG.BASE_URL}/api/users/usage`);
  if (!res.ok) {
    throw new Error(`Failed to load organization usage (${res.status})`);
  }
  return (await res.json()) as OrganizationUsage;
}
