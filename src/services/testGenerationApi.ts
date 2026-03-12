const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export interface GenerateTestScenariosResponse {
  page_title: string;
  content: string; // markdown
}

export interface PushToConfluenceResponse {
  page_id: string;
  page_title: string;
  web_url: string;
}

export const testGenerationApi = {
  generateFromConfluence: async (
    confluencePageId: string,
    projectId: string,
    token: string
  ): Promise<GenerateTestScenariosResponse> => {
    const response = await fetch(`${API_BASE_URL}/api/test/generate-from-confluence`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        confluence_page_id: confluencePageId,
        project_id: projectId,
      }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to generate test scenarios');
    }
    return response.json();
  },

  pushToConfluence: async (
    projectId: string,
    pageTitle: string,
    content: string,
    token: string
  ): Promise<PushToConfluenceResponse> => {
    const response = await fetch(`${API_BASE_URL}/api/test/push-to-confluence`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        project_id: projectId,
        page_title: pageTitle,
        content: content,
      }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to push to Confluence');
    }
    return response.json();
  },
};
