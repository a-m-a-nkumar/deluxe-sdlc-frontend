import { API_CONFIG } from "@/config/api";

export interface JiraIssue {
  id: string;
  key: string;
  self: string;
  fields: {
    summary: string;
    issuetype: {
      name: string;
    };
    priority: {
      name: string;
    };
    status: {
      name: string;
    };
    assignee?: {
      displayName: string;
    };
    reporter?: {
      displayName: string;
    };
    customfield_10016?: number; // Story points
    created: string;
    updated: string;
    description?: string;
    sprint?: {
      name: string;
    };
    labels?: string[];
  };
}

export interface JiraSearchResponse {
  issues: JiraIssue[];
  total: number;
}

export const searchJiraIssues = async (jql?: string): Promise<JiraSearchResponse> => {
  const API_BASE_URL = API_CONFIG.BASE_URL;
  try {
    const params = new URLSearchParams({
      jql: jql || "order by created DESC",
      maxResults: "50",
      fields: [
        "summary",
        "issuetype",
        "priority",
        "status",
        "assignee",
        "reporter",
        "customfield_10016",
        "created",
        "updated",
        "description",
        "sprint",
        "labels"
      ].join(",")
    });

    const response = await fetch(`${API_BASE_URL}/confluence-jira/search/jql?${params.toString()}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching Jira issues:", error);
    throw error;
  }
};

export interface CreateJiraStoryResponse {
  issue_key?: string;
  message?: string;
}

export const createJiraStoryFromConfluence = async (pageId: string): Promise<CreateJiraStoryResponse> => {
  const API_BASE_URL = API_CONFIG.BASE_URL;
  try {
    const response = await fetch(`${API_BASE_URL}/confluence-jira/jira_story/${pageId}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error creating Jira story:", error);
    throw error;
  }
};
