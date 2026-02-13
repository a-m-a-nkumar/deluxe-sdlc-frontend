import { API_CONFIG } from "@/config/api";
import {
  getProjectSessions,
  createSession,
  getSession as getBackendSession,
  updateSession as updateBackendSession,
  deleteSession as deleteBackendSession,
  Session
} from "./sessionsApi";

export interface AnalystChatRequest {
  message: string;
  session_id: string | null;
  project_id?: string | null;
}

export interface AnalystChatResponse {
  response: string;
  session_id: string;
  brd_id?: string;
  timestamp?: string;
  message_count?: number;
  model_used?: string;
  processing_time?: number;
  message?: string;
}

// Frontend ChatSession interface (matching legacy usage but mapped from backend)
export interface ChatSession {
  id: string;                    // Unified Session ID
  backendSessionId?: string | null;  // Keep compatible
  projectId: string;
  title: string;
  brdId: string | null;
  messageCount: number;
  createdAt: number;
  lastUpdated: number;
}

export interface StoredMessage {
  id: string;
  content: string;
  isBot: boolean;
  timestamp: string;
}

// Mapper helper
const mapSession = (s: Session): ChatSession => ({
  id: s.id,
  backendSessionId: s.id, // Unified ID
  projectId: s.project_id,
  title: s.title,
  brdId: s.brd_id || null,
  messageCount: s.message_count,
  createdAt: s.created_at,
  lastUpdated: s.last_updated
});

export class AnalystSessionManager {
  private static readonly CURRENT_SESSION_KEY = "analyst_current_session_id";
  private static readonly CURRENT_PROJECT_KEY = "analyst_current_project_id";
  private static readonly MESSAGES_PREFIX = "analyst_messages_"; // Keep locally for now as fallback?

  // Get all sessions (async now)
  static async getAllSessions(projectId: string): Promise<ChatSession[]> {
    try {
      if (!projectId) return [];
      const sessions = await getProjectSessions(projectId);
      return sessions.map(mapSession);
    } catch (e) {
      console.error("Error fetching sessions:", e);
      return [];
    }
  }

  // Save all sessions - No-op (backend handles it)
  private static saveSessions(sessions: ChatSession[]): void {
    // No-op
  }

  // Get current session ID
  static getCurrentSessionId(): string | null {
    return localStorage.getItem(this.CURRENT_SESSION_KEY);
  }

  // Set current session ID
  static setCurrentSessionId(sessionId: string): void {
    localStorage.setItem(this.CURRENT_SESSION_KEY, sessionId);
  }

  // Get current project ID
  static getCurrentProjectId(): string | null {
    return localStorage.getItem(this.CURRENT_PROJECT_KEY);
  }

  // Set current project ID
  static setCurrentProjectId(projectId: string): void {
    localStorage.setItem(this.CURRENT_PROJECT_KEY, projectId);
  }

  // Create a new session (async)
  static async createSession(title: string = "New Chat", projectId?: string): Promise<ChatSession> {
    const sessionProjectId = projectId || this.getCurrentProjectId();
    if (!sessionProjectId) throw new Error("No project ID available");

    // Generate ID on frontend NOT supported by my backend API wrapper createSession? 
    // Wait, createSession in sessionsApi acts on backend.
    // Backend create_session generates ID if not provided? 
    // Let's check db_helper.py. 
    // Actually, create_session in backend takes session_id. 
    // Checked sessionsApi.ts: createSession(sessionData: CreateSessionRequest). Request has session_id, project_id.

    // Generate ID locally to ensure we have one immediately? Or let backend?
    // Backend expects session_id.
    // Generate ID locally using standard UUID (36 chars) to satisfy AgentCore min length (33 chars)
    const sessionId = crypto.randomUUID();

    const newSession = await createSession({
      session_id: sessionId,
      project_id: sessionProjectId,
      title: title
    });

    this.setCurrentSessionId(newSession.id);
    return mapSession(newSession);
  }

  // Get a specific session (async)
  static async getSession(sessionId: string): Promise<ChatSession | null> {
    try {
      const session = await getBackendSession(sessionId);
      return mapSession(session);
    } catch (e) {
      console.warn("Session not found in backend:", sessionId);
      return null;
    }
  }

  // Update session metadata (async)
  static async updateSession(sessionId: string, updates: Partial<ChatSession>): Promise<void> {
    try {
      // Map ChatSession updates to backend updates
      const backendUpdates: any = {};
      if (updates.title) backendUpdates.title = updates.title;
      if (updates.brdId !== undefined) backendUpdates.brd_id = updates.brdId; // Handle null explicitly?
      if (updates.messageCount !== undefined) backendUpdates.message_count = updates.messageCount;

      await updateBackendSession(sessionId, backendUpdates);
    } catch (e) {
      console.error("Error updating session:", e);
    }
  }

  // Delete a session (async)
  static async deleteSession(sessionId: string): Promise<void> {
    try {
      await deleteBackendSession(sessionId);

      // Clear messages for this session (local cleanup)
      localStorage.removeItem(this.MESSAGES_PREFIX + sessionId);

      // If this was the current session, clear it
      if (this.getCurrentSessionId() === sessionId) {
        localStorage.removeItem(this.CURRENT_SESSION_KEY);
      }
    } catch (e) {
      console.error("Error deleting session:", e);
    }
  }

  // Rename a session
  static async renameSession(sessionId: string, newTitle: string): Promise<void> {
    await this.updateSession(sessionId, { title: newTitle });
  }

  // Set BRD ID for a session
  static async setBrdIdForSession(sessionId: string, brdId: string): Promise<void> {
    await this.updateSession(sessionId, { brdId });
  }

  // Get messages for a session (async, prefer backend)
  static async getSessionMessages(sessionId: string): Promise<StoredMessage[]> {
    // 1. Try to fetch from backend history
    try {
      const messages = await fetchAnalystHistory(sessionId);
      if (messages && messages.length > 0) {
        return messages.map((m: any, idx: number) => ({
          id: `msg-${idx}`,
          content: m.content || m.text,
          isBot: m.role === 'assistant' || m.isBot,
          timestamp: m.timestamp || new Date().toISOString()
        }));
      }
    } catch (e) {
      console.warn("Failed to fetch history from backend, falling back to local storage", e);
    }

    // 2. Fallback to localStorage
    const messagesJson = localStorage.getItem(this.MESSAGES_PREFIX + sessionId);
    if (!messagesJson) return [];
    try {
      return JSON.parse(messagesJson);
    } catch (e) {
      console.error("Error parsing messages:", e);
      return [];
    }
  }

  // Save messages for a session (Keep strictly for local optimistic update or fallback)
  static saveSessionMessages(sessionId: string, messages: StoredMessage[]): void {
    localStorage.setItem(this.MESSAGES_PREFIX + sessionId, JSON.stringify(messages));

    // Also update message count in backend?
    // Ideally backend handles count increments when messages are sent.
    // beneficial for UI to show count.
    // this.updateSession(sessionId, { messageCount: messages.length });
  }

  // Legacy stubs
  static getBackendSessionId(sessionId: string): string | null {
    return sessionId;
  }

  static getSessionId(): string | null {
    return this.getCurrentSessionId();
  }

  static setSessionId(sessionId: string): void {
    this.setCurrentSessionId(sessionId);
  }

  static setBrdId(brdId: string): void {
    const current = this.getCurrentSessionId();
    if (current) this.setBrdIdForSession(current, brdId);
  }
}

// Stream chat message from analyst agent
export async function* streamAnalystMessage(
  message: string,
  sessionId: string | null,  // CRITICAL: Session ID from React state (database)
  projectId?: string | null
): AsyncGenerator<string, void, unknown> {
  const API_BASE_URL = API_CONFIG.ANALYST_API_URL || API_CONFIG.CHATBOT_API_URL.replace('/chat', '/analyst-chat');

  // Use the session ID from React state (database), not localStorage
  const effectiveSessionId = sessionId || "none";
  console.log(`[streamAnalystMessage] Using session_id from React state: ${effectiveSessionId}`);

  const formData = new FormData();
  formData.append("message", message);
  formData.append("session_id", effectiveSessionId);
  if (projectId) {
    formData.append("project_id", projectId);
  }

  console.log(`[streamAnalystMessage] Sending with session_id: ${AnalystSessionManager.getSessionId() || "none"}`);

  const { apiPost } = await import("./api");
  const response = await apiPost(API_BASE_URL, formData);

  if (!response.ok) {
    const text = await response.text().catch(() => "Unable to read error response");
    throw new Error(`HTTP error! status: ${response.status} - ${text}`);
  }

  const data = await response.json().catch(() => ({}));

  // Store session_id if present
  if (data.session_id && data.session_id !== "none") {
    AnalystSessionManager.setSessionId(data.session_id);
  }

  if (data.brd_id) {
    AnalystSessionManager.setBrdId(data.brd_id);
  }

  // Extract text content logic (simplified for brevity, assume backend sends 'response' or 'result')
  // Reusing the robust extraction logic from previous file is better.

  let content = data?.response || data?.result || data?.message || "";

  // Basic cleaning if it's JSON string
  if (typeof content === 'string' && content.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(content);
      content = parsed.response || parsed.result || parsed.message || content;
    } catch (e) { }
  }

  if (content) {
    yield content;
  }
}

export async function sendAnalystMessage(
  message: string,
  sessionId: string | null,  // From React state (database)
  projectId?: string | null
): Promise<AnalystChatResponse> {
  const API_BASE_URL = API_CONFIG.ANALYST_API_URL || API_CONFIG.CHATBOT_API_URL.replace('/chat', '/analyst-chat');

  const effectiveSessionId = sessionId || "none";
  console.log(`[sendAnalystMessage] Using session_id from React state: ${effectiveSessionId}`);

  const formData = new FormData();
  formData.append("message", message);
  formData.append("session_id", effectiveSessionId);
  if (projectId) {
    formData.append("project_id", projectId);
  }

  const { apiPost } = await import("./api");
  const response = await apiPost(API_BASE_URL, formData);

  if (!response.ok) {
    const text = await response.text().catch(() => "Unable to read error response");
    throw new Error(`HTTP error! status: ${response.status} - ${text}`);
  }

  const data = await response.json();
  if (data.session_id) {
    AnalystSessionManager.setSessionId(data.session_id);
  }
  if (data.brd_id) {
    AnalystSessionManager.setBrdId(data.brd_id);
  }
  return data;
}

// Fetch conversation history for a session
export async function fetchAnalystHistory(sessionId: string): Promise<any[]> {
  const BASE_URL = API_CONFIG.BASE_URL;
  // Use session ID directly

  try {
    const { apiGet } = await import("./api");
    const response = await apiGet(`${BASE_URL}/api/analyst-history/${sessionId}`);

    if (!response.ok) {
      console.warn(`Failed to fetch history: ${response.status}`);
      return [];
    }

    const data = await response.json();
    return data.messages || [];
  } catch (error) {
    console.error("Error fetching analyst history:", error);
    return [];
  }
}
