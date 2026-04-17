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

export interface FeatureFile {
  filename: string;
  content: string;
}

export interface PushToGitHubResponse {
  success: boolean;
  branch: string;
  branch_url: string;
  files: string[];
  pr_url: string | null;
  pr_number: number | null;
}

export interface ParsedScenario {
  id: string;
  name: string;
  description: string;
}

export interface ParseScenariosResponse {
  page_title: string;
  scenarios: ParsedScenario[];
  prompt: string;
}

export const testGenerationApi = {
  parseScenarios: async (
    confluencePageId: string,
    projectId: string,
    token: string
  ): Promise<ParseScenariosResponse> => {
    const response = await fetch(`${API_BASE_URL}/api/test/parse-scenarios`, {
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
      throw new Error(error.detail || 'Failed to parse scenarios');
    }
    return response.json();
  },

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
    token: string,
    sourceScenarioPage?: string,
    coverageSummary?: string,
    sourceBrdPageId?: string
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
        source_scenario_page: sourceScenarioPage,
        coverage_summary: coverageSummary,
        source_brd_page_id: sourceBrdPageId || null,
      }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to push to Confluence');
    }
    return response.json();
  },

  /**
   * SSE listener for receiving test cases from MCP/AI IDE.
   * Returns an AbortController to cancel the connection.
   */
  listenForTestCases: (
    projectId: string,
    token: string,
    onGherkinReceived: (gherkin: string, sessionId: string) => void,
    onError?: (error: string) => void,
  ): AbortController => {
    const controller = new AbortController();

    (async () => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/test/listen/${projectId}`,
          {
            headers: { Authorization: `Bearer ${token}` },
            signal: controller.signal,
          }
        );

        if (!response.ok || !response.body) {
          onError?.(`SSE connection failed: ${response.status}`);
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === "gherkin_received") {
                onGherkinReceived(data.gherkin, data.session_id);
              } else if (data.type === "done") {
                return;
              }
            } catch {
              // skip malformed lines
            }
          }
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name !== "AbortError") {
          onError?.(err.message);
        }
      }
    })();

    return controller;
  },

  pushToGitHub: async (
    projectId: string,
    githubToken: string,
    repoUrl: string,
    featureFiles: FeatureFile[],
    token: string,
    branch: string = 'test/auto-generated',
    basePath: string = 'tests/features',
    createPr: boolean = true
  ): Promise<PushToGitHubResponse> => {
    const response = await fetch(`${API_BASE_URL}/api/test/push-to-github`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        project_id: projectId,
        github_token: githubToken,
        repo_url: repoUrl,
        feature_files: featureFiles,
        branch,
        base_path: basePath,
        create_pr: createPr,
      }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to push to GitHub');
    }
    return response.json();
  },
};
