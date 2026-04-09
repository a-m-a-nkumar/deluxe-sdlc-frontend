import { useState } from "react";
import { ChevronDown, Menu, FolderKanban, LogOut, Link as LinkIcon, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useNavigate } from "react-router-dom";
import { integrationsApi } from "@/services/integrationsApi";
import { LinkAtlassianModal } from "@/components/modals/LinkAtlassianModal";
import { CreateProjectModal } from "@/components/modals/CreateProjectModal";
import { fetchProjects, getProjectById } from "@/services/projectApi";
import { useToast } from "@/hooks/use-toast";
import { useAppState } from "@/contexts/AppStateContext";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface TopHeaderProps {
  onMenuClick?: () => void;
  isMobile?: boolean;
  currentView?: string;
}

export const TopHeader = ({ onMenuClick, isMobile, currentView }: TopHeaderProps) => {
  const { selectedProject, setSelectedProject } = useAppState();
  const { user, logout, accessToken } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);

  // -- Data Fetching with React Query --

  // Cached: Fetch Projects
  const { data: projects = [], isLoading: isLoadingProjects } = useQuery({
    queryKey: ["projects"],
    queryFn: fetchProjects,
    staleTime: 1000 * 60 * 5, // 5 minutes cache
    refetchOnWindowFocus: false,
  });

  // Cached: Atlassian Status
  const { data: atlassianStatus } = useQuery({
    queryKey: ["atlassian-status", user?.id],
    queryFn: () => integrationsApi.getAtlassianStatus(accessToken!),
    enabled: !!accessToken && !!user, // Only fetch if we have a user and token
    staleTime: 1000 * 60 * 5, // 5 minutes cache
    refetchOnWindowFocus: false,
  });

  const isAtlassianLinked = atlassianStatus?.linked || false;

  const handleLogout = () => {
    // Clear cache and app state on logout
    queryClient.clear();
    setSelectedProject(null);
    // Clear localStorage session data from previous account
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith("chatbot_session_id") || key.startsWith("analyst_")) {
        localStorage.removeItem(key);
      }
    });
    logout();
    navigate("/login");
    toast({
      title: "Logged out",
      description: "You have been successfully logged out",
    });
  };

  const getInitials = (email: string) => {
    return email
      .split("@")[0]
      .split(".")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || email[0].toUpperCase();
  };

  const handleProjectSelect = async (projectId: string) => {
    try {
      // Optimistically select from cached list if possible, or fetch
      const existing = projects.find(p => p.id === projectId);
      if (existing) {
        setSelectedProject(existing);
      } else {
        const project = await getProjectById(projectId);
        setSelectedProject(project);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Project not found",
        variant: "destructive",
      });
      setSelectedProject(null);
    }
  };

  // Callback to refresh data and auto-select newly created project
  const handleProjectCreated = (newProject?: import("@/services/projectApi").Project) => {
    queryClient.invalidateQueries({ queryKey: ["projects"] });
    if (newProject) {
      setSelectedProject(newProject);
      navigate("/");
    }
  };

  const handleLinkSuccess = () => {
    setIsLinkModalOpen(false);
    queryClient.invalidateQueries({ queryKey: ["atlassian-status"] });
    toast({
      title: "Success",
      description: "Atlassian account linked successfully",
    });
  };

  return (
    <>
      <CreateProjectModal
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
        projects={projects}
        isLoadingProjects={isLoadingProjects}
        onProjectCreated={handleProjectCreated}
        onProjectSelected={handleProjectSelect}
      />
      <div className="h-16 border-b border-border px-4 sm:px-6 lg:px-8 flex items-center justify-between bg-white">
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

          <Select value="claude-sonnet-4.5">
            <SelectTrigger className="w-36 sm:w-44 bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="claude-sonnet-4.5">Claude Sonnet 4.5</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          <Button
            variant="outline"
            className="text-sm px-3 sm:px-4 flex items-center gap-2 hover:bg-accent"
            onClick={() => setIsCreateModalOpen(true)}
          >
            <FolderKanban size={16} />
            <span className="hidden sm:inline">{selectedProject?.project_name || "Project Workspace"}</span>
            <span className="sm:hidden">{selectedProject?.project_name || "Workspace"}</span>
            <ChevronDown size={14} className="text-muted-foreground" />
          </Button>

          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-gray-500 text-white">
                      {getInitials(user.email)}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">Signed in as</p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {user.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />

                {!isAtlassianLinked ? (
                  <DropdownMenuItem onClick={() => setIsLinkModalOpen(true)} className="cursor-pointer text-blue-600 focus:text-blue-700">
                    <LinkIcon className="mr-2 h-4 w-4" />
                    <span>Link Atlassian Account</span>
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem disabled className="text-muted-foreground flex items-center">
                    <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
                    <span>Atlassian Connected</span>
                  </DropdownMenuItem>
                )}

                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="cursor-pointer">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        <LinkAtlassianModal
          isOpen={isLinkModalOpen}
          onClose={() => setIsLinkModalOpen(false)}
          onSuccess={handleLinkSuccess}
        />
      </div>
    </>
  );
};