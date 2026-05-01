/**
 * Design-Session API client.
 *
 * A `DesignSession` is the top-level container that spans the Diagram phase
 * (mxGraph XML + rendered SVG) and the SAD phase (sad_structure.json,
 * facts.json, etc.). Mirrors the analyst's session client but is aware of
 * the multi-phase lifecycle (NEW → DIAGRAM_GATHERING → DIAGRAM_READY →
 * SAD_GATHERING → SAD_GENERATING → SAD_REFINING).
 */

import { API_CONFIG } from "@/config/api";
import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from "./api";

const BASE = `${API_CONFIG.BASE_URL}/api/design/sessions`;

export type DesignStage =
  | "NEW"
  | "DIAGRAM_GATHERING"
  | "DIAGRAM_READY"
  | "SAD_GATHERING"
  | "SAD_GENERATING"
  | "SAD_REFINING";

export interface DesignSession {
  id: string;
  project_id: string;
  user_id: string;
  name: string;
  stage: DesignStage;
  diagram_s3_key: string | null;
  diagram_svg_s3_key: string | null;
  sad_id: string | null;
  confluence_page_id: string | null;
  is_deleted: boolean;
  created_at: number;
  last_activity_ts: number;
}

export interface HistoryMessage {
  role: "user" | "assistant" | string;
  content: string;
  ts?: number | null;
}

// ---- localStorage namespace (mirrors AnalystSessionManager) ----
const CURRENT_SESSION_KEY = "design_current_session_id";
const CURRENT_PROJECT_KEY = "design_current_project_id";

export const DesignSessionLocal = {
  getSessionId(): string | null {
    return localStorage.getItem(CURRENT_SESSION_KEY);
  },
  setSessionId(id: string | null) {
    if (id) localStorage.setItem(CURRENT_SESSION_KEY, id);
    else localStorage.removeItem(CURRENT_SESSION_KEY);
  },
  getProjectId(): string | null {
    return localStorage.getItem(CURRENT_PROJECT_KEY);
  },
  setProjectId(id: string | null) {
    if (id) localStorage.setItem(CURRENT_PROJECT_KEY, id);
    else localStorage.removeItem(CURRENT_PROJECT_KEY);
  },
  clear() {
    localStorage.removeItem(CURRENT_SESSION_KEY);
    localStorage.removeItem(CURRENT_PROJECT_KEY);
  },
};

// ---- HTTP wrappers ----

export async function listDesignSessions(projectId: string): Promise<DesignSession[]> {
  const r = await apiGet(`${BASE}/?project_id=${encodeURIComponent(projectId)}`);
  if (!r.ok) throw new Error(`listDesignSessions failed: ${r.status}`);
  return r.json();
}

export async function createDesignSession(
  projectId: string,
  name?: string,
  stage?: DesignStage,
): Promise<DesignSession> {
  const r = await apiPost(`${BASE}/`, { project_id: projectId, name, stage });
  if (!r.ok) throw new Error(`createDesignSession failed: ${r.status}`);
  return r.json();
}

export async function getDesignSession(sessionId: string): Promise<DesignSession> {
  const r = await apiGet(`${BASE}/${encodeURIComponent(sessionId)}`);
  if (!r.ok) throw new Error(`getDesignSession failed: ${r.status}`);
  return r.json();
}

export async function patchDesignSession(
  sessionId: string,
  fields: Partial<Pick<DesignSession, "name" | "stage" | "diagram_s3_key" | "diagram_svg_s3_key" | "sad_id" | "confluence_page_id">>,
): Promise<DesignSession> {
  const r = await apiPatch(`${BASE}/${encodeURIComponent(sessionId)}`, fields);
  if (!r.ok) throw new Error(`patchDesignSession failed: ${r.status}`);
  return r.json();
}

export async function deleteDesignSession(sessionId: string): Promise<void> {
  const r = await apiDelete(`${BASE}/${encodeURIComponent(sessionId)}`);
  if (!r.ok) throw new Error(`deleteDesignSession failed: ${r.status}`);
}

export async function getDesignSessionHistory(sessionId: string): Promise<HistoryMessage[]> {
  const r = await apiGet(`${BASE}/${encodeURIComponent(sessionId)}/history`);
  if (!r.ok) throw new Error(`getDesignSessionHistory failed: ${r.status}`);
  return r.json();
}

// ---- Phase-helper convenience (UI uses this to gate tabs) ----

export function isDiagramPhaseStage(stage: DesignStage): boolean {
  return stage === "NEW" || stage === "DIAGRAM_GATHERING" || stage === "DIAGRAM_READY";
}

export function isSadPhaseAvailable(stage: DesignStage): boolean {
  return stage !== "NEW";
}

export function isSadDraftReady(stage: DesignStage): boolean {
  return stage === "SAD_REFINING";
}

// =====================================================================
// Per-type diagram slots (SAD-redesign)
// =====================================================================
//
// Each session now carries three independent slots — Logical, Infrastructure,
// Security — backed by the `design_sessions.diagram_slots` JSONB column.
// The redesign hub reads these on mount and PATCHes them when the user
// skips/un-skips. Save-of-actual-artifact still goes through
// /api/design/save-diagram, which marks the slot as Done atomically.

export type SlotStatus =
  | "pending"
  | "in_progress"
  | "done"
  | "skipped"
  | "skipped_saved"
  | "failed";

export type AuthoringTool = "drawio" | "lucid";

export interface DiagramSlot {
  status: SlotStatus;
  tool?: AuthoringTool;
  artifact_key?: string;
  saved_at?: number; // epoch SECONDS (server) — frontend converts as needed
  error?: string;
}

export interface DiagramSlotsState {
  tool: AuthoringTool | null;
  slots: {
    logical: DiagramSlot;
    infrastructure: DiagramSlot;
    security: DiagramSlot;
  };
}

export type DiagramType = "logical" | "infrastructure" | "security";

export async function getDiagramSlots(sessionId: string): Promise<DiagramSlotsState> {
  const r = await apiGet(`${BASE}/${encodeURIComponent(sessionId)}/diagram-slots`);
  if (!r.ok) throw new Error(`getDiagramSlots failed: ${r.status}`);
  return r.json();
}

export async function patchDiagramSlot(
  sessionId: string,
  diagramType: DiagramType,
  patch: { status?: SlotStatus; tool?: AuthoringTool },
): Promise<DiagramSlot> {
  const r = await apiPatch(
    `${BASE}/${encodeURIComponent(sessionId)}/diagram-slots/${diagramType}`,
    patch,
  );
  if (!r.ok) {
    const err = await r.json().catch(() => ({ detail: r.statusText }));
    throw new Error(err.detail || `patchDiagramSlot failed: ${r.status}`);
  }
  return r.json();
}

export async function setDesignSessionTool(
  sessionId: string,
  tool: AuthoringTool | null,
): Promise<DiagramSlotsState> {
  const r = await apiPut(`${BASE}/${encodeURIComponent(sessionId)}/tool`, { tool });
  if (!r.ok) throw new Error(`setDesignSessionTool failed: ${r.status}`);
  return r.json();
}
