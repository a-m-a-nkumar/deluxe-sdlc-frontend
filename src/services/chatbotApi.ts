import { API_CONFIG } from "@/config/api";
import { useMutation } from "@tanstack/react-query";

export interface ChatRequest {
  message: string;
  session_id: string | null;
  include_context?: boolean;
  max_tokens?: number;
  temperature?: number;
}

export interface ChatResponse {
  response: string;
  session_id: string;
  timestamp?: string;
  message_count?: number;
  model_used?: string;
  processing_time?: number;
  message?: string;
}

export class SessionManager {
  private static readonly SESSION_KEY = "chatbot_session_id";

  static getSessionId(): string | null {
    return localStorage.getItem(this.SESSION_KEY);
  }

  static setSessionId(sessionId: string): void {
    localStorage.setItem(this.SESSION_KEY, sessionId);
  }
}

// AgentCore backend returns JSON; stream generator yields a single message
export async function* streamChatMessage(
  message: string,
  sectionContext?: string,
  _streamOverride?: boolean,
  brdId?: string | null
): AsyncGenerator<string, void, unknown> {
  const API_BASE_URL = API_CONFIG.CHATBOT_API_URL;

  let enhancedMessage = message;
  if (sectionContext) {
    // If section context includes "SECTION" prefix, it already has the section info
    // Otherwise, format it clearly for the agent
    if (sectionContext.startsWith("SECTION")) {
      enhancedMessage = `${sectionContext}\n\nUSER REQUEST: ${message}\n\nIMPORTANT: The user is currently viewing the section shown above. When they say "here", "this section", or make edits without specifying a section number, they are referring to that specific section. Please update that section accordingly.`;
    } else {
      enhancedMessage = `BRD CONTEXT:\n${sectionContext}\n\nUSER REQUEST: ${message}`;
    }
  }

  const formData = new FormData();
  formData.append("message", enhancedMessage);
  formData.append("brd_id", brdId || "none");
  formData.append("session_id", SessionManager.getSessionId() || "none");

  const response = await fetch(API_BASE_URL, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "Unable to read error response");
    throw new Error(`HTTP error! status: ${response.status} - ${text}`);
  }

  const data = await response.json().catch(() => ({}));

  if (data.session_id) {
    SessionManager.setSessionId(data.session_id);
  }

  // Extract text content, handling nested JSON structures
  let content = data?.response || data?.result || data?.message || data?.answer || data?.text || data?.content || "";
  
  // Helper function to extract text from nested JSON structure
  const extractTextFromJson = (obj: any): string | null => {
    if (!obj || typeof obj !== 'object') return null;
    
    // Check for direct text fields
    if (obj.text && typeof obj.text === 'string') return obj.text;
    if (obj.message && typeof obj.message === 'string') return obj.message;
    if (obj.result && typeof obj.result === 'string') return obj.result;
    if (obj.response && typeof obj.response === 'string') return obj.response;
    
    // Check for content array: {'role': 'assistant', 'content': [{'text': '...'}]}
    if (obj.content && Array.isArray(obj.content) && obj.content.length > 0) {
      const firstContent = obj.content[0];
      if (firstContent && typeof firstContent === 'object') {
        if (firstContent.text && typeof firstContent.text === 'string') {
          return firstContent.text;
        }
        // Recursively check nested content
        const nested = extractTextFromJson(firstContent);
        if (nested) return nested;
      }
    }
    
    return null;
  };
  
  // If content is a string that looks like JSON (Python dict or JSON format), try to parse it
  if (typeof content === 'string') {
    const trimmed = content.trim();
    
    // Check if it looks like a JSON/dict string
    if (trimmed.startsWith('{') && (trimmed.includes("'") || trimmed.includes('"'))) {
      try {
        // First try standard JSON parsing
        let parsed: any;
        try {
          parsed = JSON.parse(trimmed);
        } catch (e1) {
          // If that fails, try converting Python dict format (single quotes) to JSON
          try {
            // Replace single quotes with double quotes, but be careful with strings
            const jsonString = trimmed.replace(/'/g, '"').replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');
            parsed = JSON.parse(jsonString);
          } catch (e2) {
            // If both fail, try using eval (last resort, but safe here since we control the input)
            try {
              // Use Function constructor as safer alternative to eval
              parsed = new Function('return ' + trimmed)();
            } catch (e3) {
              console.warn('[CHAT] Could not parse JSON string:', trimmed.substring(0, 100));
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
        console.warn('[CHAT] Error parsing JSON content:', e);
      }
    }
  }
  
  // Convert to string and clean up
  content = String(content).trim();
  
  // Final check: if content still looks like a dict/JSON string, try one more extraction
  if (content.startsWith("{'") || content.startsWith('{"')) {
    try {
      // Try to extract using regex as last resort
      const textMatch = content.match(/'text'\s*:\s*['"]([^'"]+)['"]/);
      if (textMatch && textMatch[1]) {
        content = textMatch[1];
      }
    } catch (e) {
      // If all parsing fails, just use the content as-is
    }
  }

  if (content) {
    yield content;
  }
}

export async function sendChatMessage(message: string, brdId?: string | null): Promise<ChatResponse> {
  const API_BASE_URL = API_CONFIG.CHATBOT_API_URL;

  const formData = new FormData();
  formData.append("message", message);
  formData.append("brd_id", brdId || "none");
  formData.append("session_id", SessionManager.getSessionId() || "none");

  const response = await fetch(API_BASE_URL, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "Unable to read error response");
    throw new Error(`HTTP error! status: ${response.status} - ${text}`);
  }

  const data = await response.json();
  if (data.session_id) {
    SessionManager.setSessionId(data.session_id);
  }
  return data;
}

export function useChatMessage() {
  return useMutation({
    mutationFn: ({ message, brdId }: { message: string; brdId?: string | null }) =>
      sendChatMessage(message, brdId),
    onError: (error) => {
      console.error("Chat error:", error);
    },
    onSuccess: (data) => {
      console.log("Chat success:", data);
    },
  });
}

