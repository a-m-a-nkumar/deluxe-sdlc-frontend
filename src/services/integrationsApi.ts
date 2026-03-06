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
     * Get all accessible Confluence spaces
     */
    getConfluenceSpaces: async (token: string): Promise<ConfluenceSpace[]> => {
        if (!token) {
            console.warn('No access token provided for Confluence spaces request');
            throw new Error('Authentication required');
        }

        const response = await axios.get(`${API_BASE_URL}/api/integrations/confluence/spaces`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return response.data.spaces;
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
