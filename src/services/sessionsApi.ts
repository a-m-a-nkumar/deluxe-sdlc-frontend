// Session API Service
import { apiGet, apiPost, apiDelete, apiRequest } from "./api";
import { API_CONFIG } from "@/config/api";

const BASE_URL = API_CONFIG.BASE_URL;

export interface Session {
    id: string;
    project_id: string;
    user_id: string;
    title: string;
    brd_id?: string;
    message_count: number;
    created_at: number; // Unix timestamp in milliseconds
    last_updated: number; // Unix timestamp in milliseconds
    is_deleted: boolean;
}

export interface CreateSessionRequest {
    session_id: string;
    project_id: string;
    title?: string;
}

export interface UpdateSessionRequest {
    title?: string;
    brd_id?: string;
    message_count?: number;
}

/**
 * Get all sessions for a specific project
 */
export const getProjectSessions = async (projectId: string): Promise<Session[]> => {
    const response = await apiGet(`${BASE_URL}/api/sessions/?project_id=${projectId}`);

    if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown error");
        throw new Error(`Failed to fetch sessions: ${response.status} - ${errorText}`);
    }

    return response.json();
};

/**
 * Get a specific session by ID
 */
export const getSession = async (sessionId: string): Promise<Session> => {
    const response = await apiGet(`${BASE_URL}/api/sessions/${sessionId}`);

    if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown error");
        throw new Error(`Failed to fetch session: ${response.status} - ${errorText}`);
    }

    return response.json();
};

/**
 * Create a new session
 */
export const createSession = async (sessionData: CreateSessionRequest): Promise<Session> => {
    const response = await apiPost(`${BASE_URL}/api/sessions/`, sessionData);

    if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown error");
        throw new Error(`Failed to create session: ${response.status} - ${errorText}`);
    }

    return response.json();
};

/**
 * Update a session (title, brd_id, etc.)
 */
export const updateSession = async (sessionId: string, updates: UpdateSessionRequest): Promise<Session> => {
    const response = await apiRequest(`${BASE_URL}/api/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates)
    });

    if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown error");
        throw new Error(`Failed to update session: ${response.status} - ${errorText}`);
    }

    return response.json();
};

/**
 * Increment message count for a session
 */
export const incrementMessageCount = async (sessionId: string): Promise<{ session_id: string, message_count: number }> => {
    const response = await apiPost(`${BASE_URL}/api/sessions/${sessionId}/increment-messages`);

    if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown error");
        throw new Error(`Failed to increment message count: ${response.status} - ${errorText}`);
    }

    return response.json();
};

/**
 * Delete a session
 */
export const deleteSession = async (sessionId: string): Promise<void> => {
    const response = await apiDelete(`${BASE_URL}/api/sessions/${sessionId}`);

    if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown error");
        throw new Error(`Failed to delete session: ${response.status} - ${errorText}`);
    }
};
