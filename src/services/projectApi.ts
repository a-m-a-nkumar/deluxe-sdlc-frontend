// Project API Service
import { API_CONFIG } from "@/config/api";

export interface CreateProjectRequest {
  project_name: string;
  description: string;
  jira_project_key: string;
  confluence_space_key: string;
}

export interface Project {
  project_id: string;
  project_name: string;
  description: string;
  jira_project_key?: string;
  confluence_space_key?: string;
  created_at: string;
}

interface CreateProjectResponse extends Project {}

// Local-only project handling to keep UI functional without backend endpoints
const LOCAL_PROJECT_KEY = "local_brd_projects";

const readLocalProjects = (): Project[] => {
  try {
    const raw = localStorage.getItem(LOCAL_PROJECT_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Project[];
  } catch {
    return [];
  }
};

const writeLocalProjects = (projects: Project[]) => {
  localStorage.setItem(LOCAL_PROJECT_KEY, JSON.stringify(projects));
};

export const createProject = async (projectData: CreateProjectRequest): Promise<CreateProjectResponse> => {
  const newProject: Project = {
    project_id: crypto.randomUUID(),
    project_name: projectData.project_name,
    description: projectData.description,
    jira_project_key: projectData.jira_project_key,
    confluence_space_key: projectData.confluence_space_key,
    created_at: new Date().toISOString(),
  };

  const projects = readLocalProjects();
  projects.push(newProject);
  writeLocalProjects(projects);
  return newProject;
};

export const fetchProjects = async (): Promise<Project[]> => {
  const projects = readLocalProjects();

  // Ensure at least one default project exists
  if (projects.length === 0) {
    const defaultProject: Project = {
      project_id: "local-project",
      project_name: "Local BRD Project",
      description: "Local project placeholder",
      jira_project_key: "LOC",
      confluence_space_key: "LOC",
      created_at: new Date().toISOString(),
    };
    writeLocalProjects([defaultProject]);
    return [defaultProject];
  }

  return projects;
};

export const getProjectById = async (projectId: string): Promise<Project> => {
  const projects = readLocalProjects();
  const project = projects.find((p) => p.project_id === projectId);
  if (!project) {
    throw new Error("Project not found");
  }
  return project;
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

  // Expect at least one transcript file
  const transcript = files[0];
  if (!transcript) {
    throw new Error("No transcript file provided");
  }

  // Step 1: Upload transcript to S3 via backend
  const uploadFormData = new FormData();
  uploadFormData.append("transcript", transcript, transcript.name);

  console.log("[UPLOAD] Uploading transcript to S3...");
  const uploadResponse = await fetch(`${API_BASE_URL}/upload-transcript`, {
    method: "POST",
    body: uploadFormData,
  });

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
  const generateResponse = await fetch(`${API_BASE_URL}/generate-from-s3`, {
    method: "POST",
    body: generateFormData,
  });

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
      const response = await fetch(`${API_BASE_URL}/download-brd/${brdId}`, {
        method: "GET",
      });

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