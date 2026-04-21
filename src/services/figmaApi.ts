import axios from 'axios';
import { API_CONFIG } from '@/config/api';

const API_BASE_URL = API_CONFIG.BASE_URL;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface JiraStoryInput {
  key: string;
  title: string;
  description: string;
  type?: string;
  priority?: string;
  acceptance_criteria?: string;
}

export interface FigmaPromptRequest {
  project_id: string;
  jira_story: JiraStoryInput;
  max_chunks?: number;
}

export interface FigmaPromptResponse {
  prompt: string;
}

export interface FigmaFile {
  key: string;
  name: string;
  thumbnail_url: string;
  last_modified: string;
}

export interface FigmaProject {
  id: string;
  name: string;
  files: FigmaFile[];
}

export interface FigmaStatus {
  linked: boolean;
  team_id?: string;
  linked_at?: string;
}

// ─── API calls ────────────────────────────────────────────────────────────────

export const figmaApi = {
  // Phase 1 — generate design prompt via RAG + Claude
  generatePrompt: async (request: FigmaPromptRequest, token: string): Promise<FigmaPromptResponse> => {
    if (!token) throw new Error('Authentication required');
    const response = await axios.post(
      `${API_BASE_URL}/api/figma/generate-prompt`,
      request,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
  },

  // Phase 2 — link Figma credentials (PAT + Team ID)
  linkFigma: async (pat: string, teamId: string, token: string): Promise<void> => {
    if (!token) throw new Error('Authentication required');
    await axios.post(
      `${API_BASE_URL}/api/figma/link`,
      { pat, team_id: teamId },
      { headers: { Authorization: `Bearer ${token}` } }
    );
  },

  // Phase 2 — check if credentials are saved
  getFigmaStatus: async (token: string): Promise<FigmaStatus> => {
    if (!token) throw new Error('Authentication required');
    const res = await axios.get(
      `${API_BASE_URL}/api/figma/status`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return res.data;
  },

  // Phase 2 — fetch team projects + files
  fetchFigmaItems: async (token: string): Promise<FigmaProject[]> => {
    if (!token) throw new Error('Authentication required');
    const res = await axios.get(
      `${API_BASE_URL}/api/figma/items`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return res.data.projects;
  },
};
