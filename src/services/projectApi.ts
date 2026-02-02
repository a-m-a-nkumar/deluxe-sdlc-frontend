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
      template_name: "Deluxe BRD Template v2",
      s3_path: "https://test-development-bucket-siriusai.s3.us-east-1.amazonaws.com/templates/Deluxe_BRD_Template_v2+2.docx",
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

export const uploadFiles = async (files: File[]): Promise<FileUploadResponse> => {
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
  const uploadResponse = await apiPost(`${API_BASE_URL}/upload-transcript`, uploadFormData);

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

  console.log("[GENERATE] Requesting BRD generation from S3...");
  const generateResponse = await apiPost(`${API_BASE_URL}/generate-from-s3`, generateFormData);

  if (!generateResponse.ok) {
    const text = await generateResponse.text().catch(() => "Unable to read error response");
    throw new Error(`HTTP error! status: ${generateResponse.status} - ${text}`);
  }

  const data = await generateResponse.json();

  // Backend returns: { result: string, brd_id: string, session_id?: string }
  const brdContent = data?.result || data?.content || "BRD generated successfully";
  const brdId = data?.brd_id || "none";
  const sessionId = data?.session_id;

  // Store session ID if provided
  if (sessionId) {
    localStorage.setItem("chatbot_session_id", sessionId);
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
      const response = await apiGet(`${API_BASE_URL}/download-brd/${brdId}`);

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