import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { type Project, getProjectById } from "@/services/projectApi";
import { useAuth } from "@/contexts/AuthContext";

interface ChatMessageType {
  id: string;
  content: string;
  isBot: boolean;
  timestamp: string;
  isTyping?: boolean;
  isLoading?: boolean;
}

interface UploadedFile {
  id: string;
  name: string;
  size: string;
  timestamp: string;
  originalFile?: File;
}

interface UploadedFileBatch {
  id: string;
  files: Array<{ name: string; size: string }>;
  contentPreview: string;
  timestamp: string;
}

interface BRDSection {
  title: string;
  sectionNumber?: number | null;
  description: string;
  content?: string;
}

interface AppStateContextType {
  selectedProject: Project | null;
  setSelectedProject: (project: Project | null) => void;
  isRestoringProject: boolean;
  selectedBRDTemplate: string | null;
  setSelectedBRDTemplate: (template: string | null) => void;
  chatMessages: {
    overview: ChatMessageType[];
    brd: ChatMessageType[];
    confluence: ChatMessageType[];
    jira: ChatMessageType[];
    design: ChatMessageType[];
  };
  setChatMessages: (view: keyof AppStateContextType["chatMessages"], messages: ChatMessageType[]) => void;
  isFileUploading: boolean;
  setIsFileUploading: (uploading: boolean) => void;
  isBRDDownloading: boolean;
  setIsBRDDownloading: (downloading: boolean) => void;
  pendingUploadResponse: any | null;
  setPendingUploadResponse: (response: any | null) => void;
  uploadedFileBatches: UploadedFileBatch[];
  addUploadedFileBatch: (batch: UploadedFileBatch) => void;
  clearUploadedFileBatches: () => void;
  uploadedFiles: UploadedFile[];
  setUploadedFiles: (files: UploadedFile[] | ((prev: UploadedFile[]) => UploadedFile[])) => void;
  brdSections: BRDSection[];
  setBrdSections: (sections: BRDSection[]) => void;
  isBRDApproved: boolean;
  setIsBRDApproved: (approved: boolean) => void;
  brdId: string | null;
  setBrdId: (id: string | null) => void;
  activeConfluencePageId: string | null;
  setActiveConfluencePageId: (pageId: string | null) => void;
  isCreatingJiraStory: boolean;
  setIsCreatingJiraStory: (creating: boolean) => void;
  newlyCreatedJiraIssueId: string | null;
  setNewlyCreatedJiraIssueId: (issueId: string | null) => void;
  isSyncInProgress: boolean;
  setIsSyncInProgress: (syncing: boolean) => void;
  syncMessage: string;
  setSyncMessage: (message: string) => void;
}

const AppStateContext = createContext<AppStateContextType | undefined>(undefined);

const SELECTED_PROJECT_KEY = "sdlc_selected_project_id";

export const AppStateProvider = ({ children }: { children: ReactNode }) => {
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const [selectedProject, setSelectedProjectState] = useState<Project | null>(null);
  const [isRestoringProject, setIsRestoringProject] = useState(() => !!localStorage.getItem(SELECTED_PROJECT_KEY));
  const [selectedBRDTemplate, setSelectedBRDTemplate] = useState<string | null>(null);

  // Wrap setSelectedProject to persist the project ID to localStorage
  const setSelectedProject = useCallback((project: Project | null) => {
    setSelectedProjectState(project);
    if (project?.id) {
      localStorage.setItem(SELECTED_PROJECT_KEY, project.id);
    } else {
      localStorage.removeItem(SELECTED_PROJECT_KEY);
    }
  }, []);

  // Restore selected project from localStorage once auth is ready
  useEffect(() => {
    if (isAuthLoading || !isAuthenticated) {
      return;
    }

    const storedProjectId = localStorage.getItem(SELECTED_PROJECT_KEY);
    if (storedProjectId) {
      setIsRestoringProject(true);
      getProjectById(storedProjectId)
        .then((project) => {
          setSelectedProjectState(project);
        })
        .catch(() => {
          localStorage.removeItem(SELECTED_PROJECT_KEY);
        })
        .finally(() => {
          setIsRestoringProject(false);
        });
    } else {
      setIsRestoringProject(false);
    }
  }, [isAuthLoading, isAuthenticated]);

  const [chatMessages, setChatMessagesState] = useState<AppStateContextType["chatMessages"]>({
    overview: [],
    brd: [],
    confluence: [],
    jira: [],
    design: [],
  });
  const [isFileUploading, setIsFileUploading] = useState(false);
  const [isBRDDownloading, setIsBRDDownloading] = useState(false);
  const [pendingUploadResponse, setPendingUploadResponse] = useState<any | null>(null);
  const [uploadedFileBatches, setUploadedFileBatches] = useState<UploadedFileBatch[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [brdSections, setBrdSections] = useState<BRDSection[]>([]);
  const [isBRDApproved, setIsBRDApproved] = useState(false);
  const [brdId, setBrdId] = useState<string | null>(null);
  const [activeConfluencePageId, setActiveConfluencePageId] = useState<string | null>(null);
  const [isCreatingJiraStory, setIsCreatingJiraStory] = useState(false);
  const [newlyCreatedJiraIssueId, setNewlyCreatedJiraIssueId] = useState<string | null>(null);
  const [isSyncInProgress, setIsSyncInProgress] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");

  const setChatMessages = (view: keyof AppStateContextType["chatMessages"], messages: ChatMessageType[]) => {
    setChatMessagesState(prev => ({
      ...prev,
      [view]: messages,
    }));
  };

  const addUploadedFileBatch = (batch: UploadedFileBatch) => {
    setUploadedFileBatches(prev => [...prev, batch]);
  };

  const clearUploadedFileBatches = () => {
    setUploadedFileBatches([]);
  };

  return (
    <AppStateContext.Provider
      value={{
        selectedProject,
        setSelectedProject,
        isRestoringProject,
        selectedBRDTemplate,
        setSelectedBRDTemplate,
        chatMessages,
        setChatMessages,
        isFileUploading,
        setIsFileUploading,
        isBRDDownloading,
        setIsBRDDownloading,
        pendingUploadResponse,
        setPendingUploadResponse,
        uploadedFileBatches,
        addUploadedFileBatch,
        clearUploadedFileBatches,
        uploadedFiles,
        setUploadedFiles,
        brdSections,
        setBrdSections,
        isBRDApproved,
        setIsBRDApproved,
        brdId,
        setBrdId,
        activeConfluencePageId,
        setActiveConfluencePageId,
        isCreatingJiraStory,
        setIsCreatingJiraStory,
        newlyCreatedJiraIssueId,
        setNewlyCreatedJiraIssueId,
        isSyncInProgress,
        setIsSyncInProgress,
        syncMessage,
        setSyncMessage,
      }}
    >
      {children}
    </AppStateContext.Provider>
  );
};

export const useAppState = () => {
  const context = useContext(AppStateContext);
  if (context === undefined) {
    throw new Error("useAppState must be used within an AppStateProvider");
  }
  return context;
};
