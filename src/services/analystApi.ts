import { API_CONFIG } from "@/config/api";

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

export interface ChatSession {
  id: string;                    // Unified Session ID (Frontend + Backend)
  backendSessionId?: string | null;  // DEPRECATED: Kept for legacy session migration
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

export class AnalystSessionManager {
  private static readonly SESSIONS_KEY = "analyst_sessions";
  private static readonly CURRENT_SESSION_KEY = "analyst_current_session_id";
  private static readonly MESSAGES_PREFIX = "analyst_messages_";

  // Get all sessions
  static getAllSessions(): ChatSession[] {
    const sessionsJson = localStorage.getItem(this.SESSIONS_KEY);
    if (!sessionsJson) return [];
    try {
      const sessions = JSON.parse(sessionsJson);
      // Sort by last updated (most recent first)
      return sessions.sort((a: ChatSession, b: ChatSession) => b.lastUpdated - a.lastUpdated);
    } catch (e) {
      console.error("Error parsing sessions:", e);
      return [];
    }
  }

  // Save all sessions
  private static saveSessions(sessions: ChatSession[]): void {
    localStorage.setItem(this.SESSIONS_KEY, JSON.stringify(sessions));
  }

  // Get current session ID
  static getCurrentSessionId(): string | null {
    return localStorage.getItem(this.CURRENT_SESSION_KEY);
  }

  // Set current session ID
  static setCurrentSessionId(sessionId: string): void {
    localStorage.setItem(this.CURRENT_SESSION_KEY, sessionId);
  }

  // Create a new session
  static createSession(title?: string): ChatSession {
    const sessions = this.getAllSessions();
    const newSession: ChatSession = {
      // Generate a long unique ID that satisfies AgentCore requirement (min 33 chars)
      // session-timestamp-random1-random2
      id: `session-${Date.now()}-${Math.random().toString(36).substring(2, 15)}-${Math.random().toString(36).substring(2, 15)}`,
      title: title || `New Chat ${sessions.length + 1}`,
      brdId: null,
      messageCount: 0,
      createdAt: Date.now(),
      lastUpdated: Date.now(),
    };

    sessions.unshift(newSession);
    this.saveSessions(sessions);
    this.setCurrentSessionId(newSession.id);

    return newSession;
  }

  // Get a specific session
  static getSession(sessionId: string): ChatSession | null {
    const sessions = this.getAllSessions();
    return sessions.find(s => s.id === sessionId) || null;
  }

  // Update session metadata
  static updateSession(sessionId: string, updates: Partial<ChatSession>): void {
    const sessions = this.getAllSessions();
    const index = sessions.findIndex(s => s.id === sessionId);
    if (index !== -1) {
      sessions[index] = {
        ...sessions[index],
        ...updates,
        lastUpdated: Date.now(),
      };
      this.saveSessions(sessions);
    }
  }

  // Delete a session
  static deleteSession(sessionId: string): void {
    const sessions = this.getAllSessions();
    const filtered = sessions.filter(s => s.id !== sessionId);
    this.saveSessions(filtered);

    // Clear messages for this session
    localStorage.removeItem(this.MESSAGES_PREFIX + sessionId);

    // If this was the current session, clear it
    if (this.getCurrentSessionId() === sessionId) {
      localStorage.removeItem(this.CURRENT_SESSION_KEY);
    }
  }

  // Rename a session
  static renameSession(sessionId: string, newTitle: string): void {
    this.updateSession(sessionId, { title: newTitle });
  }

  // Set BRD ID for a session
  static setBrdIdForSession(sessionId: string, brdId: string): void {
    this.updateSession(sessionId, { brdId });
  }

  // Get messages for a session
  static getSessionMessages(sessionId: string): StoredMessage[] {
    const messagesJson = localStorage.getItem(this.MESSAGES_PREFIX + sessionId);
    if (!messagesJson) return [];
    try {
      return JSON.parse(messagesJson);
    } catch (e) {
      console.error("Error parsing messages:", e);
      return [];
    }
  }

  // Save messages for a session
  static saveSessionMessages(sessionId: string, messages: StoredMessage[]): void {
    localStorage.setItem(this.MESSAGES_PREFIX + sessionId, JSON.stringify(messages));

    // Update message count and last updated
    this.updateSession(sessionId, {
      messageCount: messages.length,
      lastUpdated: Date.now(),
    });
  }

  // Add a message to a session
  static addMessageToSession(sessionId: string, message: StoredMessage): void {
    const messages = this.getSessionMessages(sessionId);
    messages.push(message);
    this.saveSessionMessages(sessionId, messages);
  }

  // Clear all sessions (for testing/reset)
  static clearAllSessions(): void {
    const sessions = this.getAllSessions();
    sessions.forEach(session => {
      localStorage.removeItem(this.MESSAGES_PREFIX + session.id);
    });
    localStorage.removeItem(this.SESSIONS_KEY);
    localStorage.removeItem(this.CURRENT_SESSION_KEY);
  }

  // Get backend session ID for a specific session
  // Unified ID logic with Legacy Fallback
  static getBackendSessionId(sessionId: string): string | null {
    const session = this.getSession(sessionId);
    // If legacy session has a specific backend ID, use it. Otherwise use the unified ID.
    if (session?.backendSessionId && session.backendSessionId !== "none") {
      return session.backendSessionId;
    }
    return sessionId;
  }

  // Set backend session ID for a specific session
  // No-op: ID is unified
  static setBackendSessionId(sessionId: string, backendSessionId: string): void {
    // No-op
  }

  // Legacy compatibility methods
  static getSessionId(): string | null {
    return this.getCurrentSessionId();
  }

  static setSessionId(sessionId: string): void {
    // No-op
  }

  static getBrdId(): string | null {
    const currentSessionId = this.getCurrentSessionId();
    if (!currentSessionId) return null;
    const session = this.getSession(currentSessionId);
    return session?.brdId || null;
  }

  static setBrdId(brdId: string): void {
    const currentSessionId = this.getCurrentSessionId();
    if (currentSessionId) {
      this.setBrdIdForSession(currentSessionId, brdId);
    }
  }

  static clearSession(): void {
    const currentSessionId = this.getCurrentSessionId();
    if (currentSessionId) {
      this.deleteSession(currentSessionId);
    }
  }
}

// Stream chat message from analyst agent
export async function* streamAnalystMessage(
  message: string,
  projectId?: string | null
): AsyncGenerator<string, void, unknown> {
  const API_BASE_URL = API_CONFIG.ANALYST_API_URL || API_CONFIG.CHATBOT_API_URL.replace('/chat', '/analyst-chat');

  const formData = new FormData();
  formData.append("message", message);
  formData.append("session_id", AnalystSessionManager.getSessionId() || "none");
  if (projectId) {
    formData.append("project_id", projectId);
  }

  const { apiPost } = await import("./api");
  const response = await apiPost(API_BASE_URL, formData);

  if (!response.ok) {
    const text = await response.text().catch(() => "Unable to read error response");
    throw new Error(`HTTP error! status: ${response.status} - ${text}`);
  }

  const data = await response.json().catch(() => ({}));

  // Store session_id if present (analyst agent returns it in JSON)
  if (data.session_id && data.session_id !== "none") {
    console.log(`[analystApi] Storing session_id: ${data.session_id}`);
    AnalystSessionManager.setSessionId(data.session_id);
  } else {
    console.log(`[analystApi] No valid session_id in response. Data keys:`, Object.keys(data));
  }

  if (data.brd_id) {
    AnalystSessionManager.setBrdId(data.brd_id);
  }

  // Extract text content, handling nested JSON structures
  let content = data?.response || data?.result || data?.message || data?.answer || data?.text || data?.content || "";

  // Helper function to extract text from nested JSON structure
  const extractTextFromJson = (obj: any): string | null => {
    if (!obj || typeof obj !== 'object') return null;

    if (obj.text && typeof obj.text === 'string') return obj.text;
    if (obj.message && typeof obj.message === 'string') return obj.message;
    if (obj.result && typeof obj.result === 'string') return obj.result;
    if (obj.response && typeof obj.response === 'string') return obj.response;

    if (obj.content && Array.isArray(obj.content) && obj.content.length > 0) {
      const firstContent = obj.content[0];
      if (firstContent && typeof firstContent === 'object') {
        if (firstContent.text && typeof firstContent.text === 'string') {
          return firstContent.text;
        }
        const nested = extractTextFromJson(firstContent);
        if (nested) return nested;
      }
    }

    return null;
  };

  if (typeof content === 'string') {
    const trimmed = content.trim();

    if (trimmed.startsWith('{') && (trimmed.includes("'") || trimmed.includes('"'))) {
      try {
        let parsed: any;
        try {
          parsed = JSON.parse(trimmed);
        } catch (e1) {
          try {
            const jsonString = trimmed.replace(/'/g, '"').replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');
            parsed = JSON.parse(jsonString);
          } catch (e2) {
            try {
              parsed = new Function('return ' + trimmed)();
            } catch (e3) {
              console.warn('[ANALYST] Could not parse JSON string:', trimmed.substring(0, 100));
            }
          }
        }

        if (parsed) {
          const extracted = extractTextFromJson(parsed);
          if (extracted) {
            content = extracted;
          }
        }
      } catch (e) {
        console.warn('[ANALYST] Error parsing JSON content:', e);
      }
    }
  }

  content = String(content).trim();

  if (content.startsWith("{'") || content.startsWith('{"')) {
    try {
      const textMatch = content.match(/'text'\s*:\s*['"]([^'"]+)['"]/);
      if (textMatch && textMatch[1]) {
        content = textMatch[1];
      }
    } catch (e) {
      // If all parsing fails, just use the content as-is
    }
  }

  // Extract BRD ID from response if present
  const brdIdMatch = content.match(/BRD ID:\s*([a-f0-9-]+)/i);
  if (brdIdMatch && brdIdMatch[1]) {
    AnalystSessionManager.setBrdId(brdIdMatch[1]);
  }

  if (content) {
    yield content;
  }
}

export async function sendAnalystMessage(message: string, projectId?: string | null): Promise<AnalystChatResponse> {
  const API_BASE_URL = API_CONFIG.ANALYST_API_URL || API_CONFIG.CHATBOT_API_URL.replace('/chat', '/analyst-chat');

  const formData = new FormData();
  formData.append("message", message);
  formData.append("session_id", AnalystSessionManager.getSessionId() || "none");
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
  const API_BASE_URL = `http://localhost:8000/analyst-history/${sessionId}`;

  try {
    const { apiGet } = await import("./api");
    const response = await apiGet(API_BASE_URL);

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


