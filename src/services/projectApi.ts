// Project API Service
import { apiGet, apiPost, apiDelete, apiRequest } from "./api";
import { API_CONFIG } from "@/config/api";

const BASE_URL = API_CONFIG.BASE_URL;

export interface CreateProjectRequest {
  project_id: string; // Now required by backend
  project_name: string;
  description?: string;
  jira_project_key?: string;
  confluence_space_key?: string;
}

export interface UpdateProjectRequest {
  project_name?: string;
  description?: string;
  jira_project_key?: string;
  confluence_space_key?: string;
}

// Backend project interface
export interface BackendProject {
  id: string; // Backend uses 'id' instead of 'project_id'
  user_id: string;
  project_name: string;
  description?: string;
  jira_project_key?: string;
  confluence_space_key?: string;
  created_at: number; // Milliseconds
  updated_at: number; // Milliseconds
  is_deleted: boolean;
}

// Helper to map backend Project to frontend interface if needed, or update frontend to use 'id'
// For now, let's keep frontend expectations. If frontend expects 'project_id', we map it.
// Checking previous code: interface Project { project_id: string; ... }
// I should align with backend 'id', but to avoid breaking entire frontend, I might mapper.
// But better to update frontend to match backend schema. 'id' is standard.
// Let's assume we map 'id' -> 'project_id' for compatibility or just switch to 'id'.
// The previous interface had: project_id, project_name, description, jira..., confluence..., created_at (string)
// Backend returns created_at as number (ms).

// Let's force alignment with Backend but providing a compatibility layer if needed?
// The user wants migration. Let's return what backend returns but mapped if necessary.

// Updated interface matching backend response
export interface ProjectResponse {
  id: string;
  user_id: string;
  project_name: string;
  description?: string;
  jira_project_key?: string;
  confluence_space_key?: string;
  created_at: number;
  updated_at: number;
  is_deleted: boolean;
}

// Frontend might rely on 'project_id' property. Let's keep it compatible by adding it
export interface FrontendProject extends ProjectResponse {
  project_id: string; // Alias for id
}

// Export Project as FrontendProject for backward compatibility
export type Project = FrontendProject;

const mapProject = (p: ProjectResponse): FrontendProject => ({
  ...p,
  project_id: p.id
});

export const createProject = async (projectData: Omit<CreateProjectRequest, "project_id">): Promise<FrontendProject> => {
  const payload = {
    ...projectData,
    project_id: crypto.randomUUID() // Generate ID on frontend as expected by backend or helpful
  };

  const response = await apiPost(`${BASE_URL}/api/projects/`, payload);

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    throw new Error(`Failed to create project: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return mapProject(data);
};

export const fetchProjects = async (): Promise<FrontendProject[]> => {
  const response = await apiGet(`${BASE_URL}/api/projects/`);

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    throw new Error(`Failed to fetch projects: ${response.status} - ${errorText}`);
  }

  const data: ProjectResponse[] = await response.json();
  return data.map(mapProject);
};

export const getProjectById = async (projectId: string): Promise<FrontendProject> => {
  const response = await apiGet(`${BASE_URL}/api/projects/${projectId}`);

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    throw new Error(`Failed to fetch project: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return mapProject(data);
};

export const updateProject = async (projectId: string, updates: UpdateProjectRequest): Promise<FrontendProject> => {
  const response = await apiRequest(`${BASE_URL}/api/projects/${projectId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates)
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    throw new Error(`Failed to update project: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return mapProject(data);
};

export const deleteProject = async (projectId: string): Promise<void> => {
  const response = await apiDelete(`${BASE_URL}/api/projects/${projectId}`);

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    throw new Error(`Failed to delete project: ${response.status} - ${errorText}`);
  }
};

export interface BRDTemplate {
  template_id: string;
  template_name: string;
  s3_path: string;
  created_at: string;
  updated_at: string;
}

export interface BRDTemplatesResponse {
  success: boolean;
  message: string;
  data: BRDTemplate[];
  total_count: number;
}

export const getBRDTemplates = async (): Promise<BRDTemplate[]> => {
  // Single template served from S3 as requested
  return [
    {
      template_id: "deluxe-brd-template",
      template_name: "template.docx",
      s3_path: import.meta.env.VITE_S3_TEMPLATE_URL || "https://test-development-bucket-siriusai.s3.us-east-1.amazonaws.com/templates/Deluxe_BRD_Template_v2+2.docx",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];
};

export interface FileUploadResponse {
  message: string;
  filename: string;
  size: number;
  type: string;
  processed_for_querying: boolean;
  s3_uploaded: boolean;
  brd_auto_generated?: {
    success: boolean;
    brd_id: string;
    content_preview: string;
    file_path: string;
    frontend_url: string;
  };
}

export const uploadFiles = async (files: File[], projectId?: string | null): Promise<FileUploadResponse> => {
  const API_BASE_URL = API_CONFIG.BASE_URL;

  // Import API functions once at the start
  const { apiPost } = await import("./api");

  // Expect at least one transcript file
  const transcript = files[0];
  if (!transcript) {
    throw new Error("No transcript file provided");
  }

  // Step 1: Upload transcript to S3 via backend
  const uploadFormData = new FormData();
  uploadFormData.append("transcript", transcript, transcript.name);

  console.log("[UPLOAD] Uploading transcript to S3...");
  const uploadResponse = await apiPost(`${API_BASE_URL}/api/upload-transcript`, uploadFormData);

  if (!uploadResponse.ok) {
    const text = await uploadResponse.text().catch(() => "Unable to read error response");
    throw new Error(`Failed to upload transcript to S3: ${uploadResponse.status} - ${text}`);
  }

  const uploadData = await uploadResponse.json();
  const transcriptS3Path = uploadData.s3_path;

  if (!transcriptS3Path) {
    throw new Error("Backend did not return S3 path for transcript");
  }

  console.log("[UPLOAD] Transcript uploaded to S3:", transcriptS3Path);

  // Step 2: Generate BRD from S3 (backend fetches transcript and template from S3)
  const generateFormData = new FormData();
  generateFormData.append("transcript_s3_path", transcriptS3Path);
  if (projectId) {
    generateFormData.append("project_id", projectId);
  }

  console.log("[GENERATE] Requesting BRD generation from S3...");
  const generateResponse = await apiPost(`${API_BASE_URL}/api/generate-from-s3`, generateFormData);

  if (!generateResponse.ok) {
    const text = await generateResponse.text().catch(() => "Unable to read error response");
    throw new Error(`HTTP error! status: ${generateResponse.status} - ${text}`);
  }

  const data = await generateResponse.json();

  // Backend returns: { result: string, brd_id: string, session_id?: string }
  const brdContent = data?.result || data?.content || "BRD generated successfully";
  const brdId = data?.brd_id || "none";
  const sessionId = data?.session_id;

  // Store session ID per-project if provided
  if (sessionId) {
    const { SessionManager } = await import("./chatbotApi");
    SessionManager.setSessionId(sessionId, projectId);
  }

  console.log("[GENERATE] BRD generated successfully, BRD ID:", brdId);

  return {
    message: "BRD generated successfully",
    filename: transcript.name,
    size: transcript.size,
    type: transcript.type,
    processed_for_querying: true,
    s3_uploaded: true,
    brd_auto_generated: {
      success: true,
      brd_id: brdId,
      content_preview: brdContent,
      file_path: transcriptS3Path,
      frontend_url: "",
    },
  };
};

export const downloadBRD = async (text: string, filename: string, brdId?: string | null): Promise<Blob> => {
  const API_BASE_URL = API_CONFIG.BASE_URL;

  // If brdId is provided, use backend download endpoint
  if (brdId && brdId !== "none") {
    try {
      const { apiGet } = await import("./api");
      const response = await apiGet(`${API_BASE_URL}/api/download-brd/${brdId}`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const blob = await response.blob();
      return blob;
    } catch (error) {
      console.error("Error downloading BRD from backend:", error);
      // Fallback to client-side download
    }
  }

  // Client-side fallback: create text blob
  const blob = new Blob([text], { type: "text/plain" });
  return blob;
};

// ============================================
// BRD SESSION PERSISTENCE
// ============================================

export interface BrdSession {
  brd_id: string | null;
  session_id: string | null;
  brd_content?: string | null;
}

export const fetchProjectBrdSession = async (projectId: string): Promise<BrdSession> => {
  try {
    const response = await apiGet(`${BASE_URL}/api/projects/${projectId}/brd-session`);

    if (!response.ok) {
      console.warn(`Failed to fetch BRD session for project ${projectId}`);
      return { brd_id: null, session_id: null };
    }

    return response.json();
  } catch (e) {
    console.warn("Error fetching BRD session:", e);
    return { brd_id: null, session_id: null };
  }
};

export const saveProjectBrdSession = async (
  projectId: string,
  brdId: string | null,
  sessionId: string | null,
  brdContent?: string | null
): Promise<void> => {
  try {
    const payload: Record<string, string | null> = { brd_id: brdId, session_id: sessionId };
    if (brdContent !== undefined) {
      payload.brd_content = brdContent;
    }
    await apiRequest(`${BASE_URL}/api/projects/${projectId}/brd-session`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    console.error("Error saving BRD session:", e);
  }
};

// ============================================
// BRD SECTION APIs (S3-backed)
// ============================================

export interface BrdSectionInfo {
  number: number;
  title: string;
}

export interface BrdSectionDetail {
  brd_id: string;
  section_number: number;
  title: string;
  section: Record<string, unknown>;
  markdown: string;
}

/** Fetch the list of BRD sections from S3 (lightweight — titles + numbers only). */
export const fetchBrdSections = async (brdId: string): Promise<BrdSectionInfo[]> => {
  try {
    const response = await apiGet(`${BASE_URL}/api/brd/${brdId}/sections`);
    if (!response.ok) {
      console.warn(`Failed to fetch BRD sections for ${brdId}: ${response.status}`);
      return [];
    }
    const data = await response.json();
    return data.sections || [];
  } catch (e) {
    console.warn("Error fetching BRD sections:", e);
    return [];
  }
};

/** Fetch a single section's full content (markdown) from S3. */
export const fetchBrdSectionContent = async (
  brdId: string,
  sectionNumber: number
): Promise<BrdSectionDetail | null> => {
  try {
    const response = await apiGet(`${BASE_URL}/api/brd/${brdId}/section/${sectionNumber}`);
    if (!response.ok) {
      console.warn(`Failed to fetch section ${sectionNumber} for BRD ${brdId}: ${response.status}`);
      return null;
    }
    return response.json();
  } catch (e) {
    console.warn("Error fetching BRD section content:", e);
    return null;
  }
};

// ============================================
// BRD CHAT HISTORY (my_agent memory)
// ============================================

/** Fetch BRD chat history (DB-backed, with AgentCore Memory fallback). */
export const fetchBrdHistory = async (
  sessionId: string,
  projectId?: string
): Promise<Array<{ role: string; content: string; isBot: boolean }>> => {
  try {
    const params = projectId ? `?project_id=${encodeURIComponent(projectId)}` : "";
    const response = await apiGet(`${BASE_URL}/api/brd-history/${sessionId}${params}`);
    if (!response.ok) {
      console.warn(`Failed to fetch BRD history for session ${sessionId}: ${response.status}`);
      return [];
    }
    const data = await response.json();
    return data.messages || [];
  } catch (e) {
    console.warn("Error fetching BRD history:", e);
    return [];
  }
};