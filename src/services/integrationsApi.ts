import axios from 'axios';
import { API_CONFIG } from '@/config/api';

// Use single source of truth so we never get /api/api/... (base is origin or empty; paths add /api/... once)
const API_BASE_URL = API_CONFIG.BASE_URL;

// ============================================
// Type Definitions
// ============================================

export interface LinkAtlassianRequest {
    domain: string;
    email: string;
    api_token: string;
}

export interface AtlassianStatus {
    linked: boolean;
    token_expired?: boolean;
    domain?: string;
    email?: string;
    linked_at?: number;
}

export interface JiraProject {
    key: string;
    name: string;
    id: string;
    type: string;
}

export interface JiraBoard {
    id: number;
    name: string;
    type: string; // 'scrum' | 'kanban' | 'simple'
}

export interface ConfluenceSpace {
    key: string;
    name: string;
    id: string;
    type: string;
}

export interface UploadBRDToConfluenceRequest {
    brd_id: string;
    project_id: string;
    page_title?: string;
}

export interface LinkLucidRequest {
    api_key: string;
}

export interface LucidStatus {
    linked: boolean;
    key_valid: boolean;
    linked_at?: string | null;
}

export interface LucidDocument {
    documentId: string;
    title: string;
    lastModified?: string;
    [key: string]: any;
}

export interface LucidImportResult {
    artifact_key: string;
    diagram_type: 'logical' | 'infrastructure' | 'security';
    preview_url: string;
    saved_at: number;
}

export interface UploadBRDToConfluenceResponse {
    status: string;
    message: string;
    confluence_page: {
        id: string;
        title: string;
        web_url: string;
        space_key: string;
    };
}

// ============================================
// API Functions
// ============================================

export const integrationsApi = {
    /**
     * Link user's Atlassian account
     */
    linkAtlassianAccount: async (request: LinkAtlassianRequest, token: string): Promise<void> => {
        if (!token) {
            console.warn('No access token provided for Atlassian link request');
            throw new Error('Authentication required');
        }

        await axios.post(`${API_BASE_URL}/api/integrations/atlassian/link`, request, {
            headers: { Authorization: `Bearer ${token}` }
        });
    },

    /**
     * Check if user has linked their Atlassian account
     */
    getAtlassianStatus: async (token: string): Promise<AtlassianStatus> => {
        if (!token) {
            console.warn('No access token provided for Atlassian status check');
            throw new Error('Authentication required');
        }

        const response = await axios.get(`${API_BASE_URL}/api/integrations/atlassian/status`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return response.data;
    },

    /**
     * Link user's Lucid account via personal REST API key.
     * Backend validates the key against Lucid /users/me before persisting
     * KMS-encrypted to the users table.
     */
    linkLucidAccount: async (request: LinkLucidRequest, token: string): Promise<void> => {
        if (!token) throw new Error('Authentication required');
        await axios.post(`${API_BASE_URL}/api/integrations/lucid/link`, request, {
            headers: { Authorization: `Bearer ${token}` },
        });
    },

    /**
     * Check whether the user has a stored (and recently-valid) Lucid API key.
     */
    getLucidStatus: async (token: string): Promise<LucidStatus> => {
        if (!token) throw new Error('Authentication required');
        const resp = await axios.get(`${API_BASE_URL}/api/integrations/lucid/status`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        return resp.data;
    },

    /**
     * Drop the user's stored Lucid API key. Idempotent.
     */
    unlinkLucidAccount: async (token: string): Promise<void> => {
        if (!token) throw new Error('Authentication required');
        await axios.delete(`${API_BASE_URL}/api/integrations/lucid/unlink`, {
            headers: { Authorization: `Bearer ${token}` },
        });
    },

    /**
     * Get all accessible Jira projects
     */
    getJiraProjects: async (token: string): Promise<JiraProject[]> => {
        if (!token) {
            console.warn('No access token provided for Jira projects request');
            throw new Error('Authentication required');
        }

        const response = await axios.get(`${API_BASE_URL}/api/integrations/jira/projects`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return response.data.projects;
    },

    /**
     * Get a page of Confluence spaces (lazy loading).
     * Returns { spaces, hasMore }.
     */
    getConfluenceSpaces: async (
        token: string,
        start: number = 0,
        limit: number = 100,
        search: string = "",
    ): Promise<{ spaces: ConfluenceSpace[]; hasMore: boolean }> => {
        if (!token) {
            console.warn('No access token provided for Confluence spaces request');
            throw new Error('Authentication required');
        }

        const params: Record<string, string | number> = { start, limit };
        if (search) params.search = search;

        const response = await axios.get(`${API_BASE_URL}/api/integrations/confluence/spaces`, {
            headers: { Authorization: `Bearer ${token}` },
            params,
        });
        return { spaces: response.data.spaces, hasMore: response.data.hasMore };
    },

    /**
     * Get Jira issues for a specific project key
     */
    getJiraIssues: async (projectKey: string, token: string): Promise<any> => {
        if (!token) {
            console.warn('No access token provided for Jira issues request');
            throw new Error('Authentication required');
        }

        const response = await axios.get(`${API_BASE_URL}/api/integrations/jira/issues/${projectKey}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return response.data;
    },

    /**
     * Get Jira boards for a specific project key
     */
    getJiraBoards: async (projectKey: string, token: string): Promise<JiraBoard[]> => {
        if (!token) {
            console.warn('No access token provided for Jira boards request');
            throw new Error('Authentication required');
        }

        const response = await axios.get(`${API_BASE_URL}/api/integrations/jira/boards/${projectKey}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return response.data.boards;
    },

    /**
     * Upload BRD from S3 to Confluence
     * Creates a new Confluence page with the BRD content
     */
    uploadBRDToConfluence: async (
        request: UploadBRDToConfluenceRequest,
        token: string
    ): Promise<UploadBRDToConfluenceResponse> => {
        if (!token) {
            console.warn('No access token provided for BRD upload request');
            throw new Error('Authentication required');
        }

        const response = await axios.post(
            `${API_BASE_URL}/api/integrations/confluence/upload-brd`,
            request,
            {
                headers: { Authorization: `Bearer ${token}` }
            }
        );
        return response.data;
    }
};
