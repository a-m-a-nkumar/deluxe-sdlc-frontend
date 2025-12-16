import { useState, useEffect, useRef } from "react";
import { ChevronDown, Menu, FolderKanban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CreateProjectModal } from "@/components/modals/CreateProjectModal";
import { fetchProjects, getProjectById, type Project } from "@/services/projectApi";
import { useToast } from "@/hooks/use-toast";
import { useAppState } from "@/contexts/AppStateContext";

interface TopHeaderProps {
  onMenuClick?: () => void;
  isMobile?: boolean;
  currentView?: string;
}

export const TopHeader = ({ onMenuClick, isMobile, currentView }: TopHeaderProps) => {
  const { selectedProject, setSelectedProject } = useAppState();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  const { toast } = useToast();
  const hasLoadedProjects = useRef(false);

  // Load projects only once on mount
  useEffect(() => {
    if (!hasLoadedProjects.current) {
      loadProjects();
      hasLoadedProjects.current = true;
    }
  }, []);

  const loadProjects = async () => {
    setIsLoadingProjects(true);
    try {
      const projectsData = await fetchProjects();
      setProjects(projectsData);
      console.log("Projects loaded:", projectsData);
    } catch (error) {
      console.error("Failed to load projects:", error);
    } finally {
      setIsLoadingProjects(false);
    }
  };

  const handleProjectSelect = async (projectId: string) => {
    try {
      const project = await getProjectById(projectId);
      setSelectedProject(project);
    } catch (error) {
      toast({
        title: "Error",
        description: "Project not found",
        variant: "destructive",
      });
      setSelectedProject(null);
    }
  };

  return (
    <>
      <CreateProjectModal 
        open={isCreateModalOpen} 
        onOpenChange={setIsCreateModalOpen}
        projects={projects}
        isLoadingProjects={isLoadingProjects}
        onProjectCreated={loadProjects}
        onProjectSelected={handleProjectSelect}
      />
    <div className="h-16 border-b border-border px-4 sm:px-6 lg:px-8 flex items-center justify-between" style={{ backgroundColor: '#fff' }}>
      <div className="flex items-center gap-4">
        {isMobile && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onMenuClick}
            className="lg:hidden"
          >
            <Menu className="w-4 h-4" />
          </Button>
        )}
        
        <Select defaultValue="model">
          <SelectTrigger className="w-24 sm:w-32" style={{ backgroundColor: '#fff' }}>
            <SelectValue placeholder="Model" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="model">Model</SelectItem>
            <SelectItem value="gpt-4">GPT-4</SelectItem>
            <SelectItem value="claude">Claude</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      <div className="flex items-center gap-2 sm:gap-4">
        <Button 
          className="text-sm px-3 sm:px-4 flex items-center gap-2 hover:opacity-90"
          style={{ backgroundColor: '#E7E7E7', color: '#222' }}
          onClick={() => setIsCreateModalOpen(true)}
        >
          <FolderKanban size={16} />
          <span className="hidden sm:inline">{selectedProject?.project_name || "Project Workspace"}</span>
          <span className="sm:hidden">{selectedProject?.project_name || "Workspace"}</span>
        </Button>
      </div>
    </div>
    </>
  );
};