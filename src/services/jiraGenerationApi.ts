import axios from 'axios';
import { API_CONFIG } from '@/config/api';

const API_BASE_URL = API_CONFIG.BASE_URL;

// ============================================
// Type Definitions
// ============================================

export interface UserStory {
    story_id: string;
    title: string;
    description: string;
    acceptance_criteria: string[];
    story_points: number;
    priority: string;
    mapped_to_requirement: string;
    selected: boolean;
}

export interface Epic {
    epic_id: string;
    title: string;
    description: string;
    mapped_to_brd_section: string;
    user_stories: UserStory[];
}

export interface GenerateJiraItemsResponse {
    epics: Epic[];
    total_epics: number;
    total_stories: number;
}

export interface CreatedEpic {
    temp_id: string;
    jira_key: string;
    title: string;
}

export interface CreatedStory {
    temp_id: string;
    jira_key: string;
    title: string;
    epic: string;
}

export interface CreateJiraItemsResponse {
    status: string;
    created_epics: CreatedEpic[];
    created_stories: CreatedStory[];
    failed: any[];
    summary: {
        total_epics_created: number;
        total_stories_created: number;
        total_failed: number;
    };
}

// ============================================
// API Functions
// ============================================

export const jiraGenerationApi = {
    /**
     * Generate Epics and User Stories from a Confluence page
     */
    generateFromConfluence: async (
        confluencePageId: string,
        projectId: string,
        token: string
    ): Promise<GenerateJiraItemsResponse> => {
        if (!token) {
            throw new Error('Authentication required');
        }

        const response = await axios.post(
            `${API_BASE_URL}/api/jira/generate-from-confluence`,
            {
                confluence_page_id: confluencePageId,
                project_id: projectId
            },
            {
                headers: { Authorization: `Bearer ${token}` }
            }
        );
        return response.data;
    },

    /**
     * Create selected Epics and User Stories in Jira
     */
    createInJira: async (
        projectId: string,
        jiraProjectKey: string,
        epics: Epic[],
        token: string,
        boardId?: number,
        confluencePageId?: string
    ): Promise<CreateJiraItemsResponse> => {
        if (!token) {
            throw new Error('Authentication required');
        }

        const response = await axios.post(
            `${API_BASE_URL}/api/jira/create-from-generated`,
            {
                project_id: projectId,
                jira_project_key: jiraProjectKey,
                epics: epics,
                board_id: boardId || null,
                confluence_page_id: confluencePageId || null
            },
            {
                headers: { Authorization: `Bearer ${token}` }
            }
        );
        return response.data;
    }
};
