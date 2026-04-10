import { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { FolderKanban, Loader2, Pencil, Trash2, X, Check as CheckIcon, Info, Link2, LayoutGrid, FileText, ChevronsUpDown, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { createProject, updateProject, deleteProject, type CreateProjectRequest, type UpdateProjectRequest, getBRDTemplates, type BRDTemplate, type Project } from "@/services/projectApi";
import { integrationsApi, type JiraProject, type ConfluenceSpace } from "@/services/integrationsApi";
import { useAuth } from "@/contexts/AuthContext";

const createProjectSchema = z.object({
  project_name: z.string().min(1, "Project name is required").max(75, "Project name must be 75 characters or less"),
  brd_template: z.string().optional(),
});

type CreateProjectFormData = z.infer<typeof createProjectSchema>;

interface CreateProjectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projects: Project[];
  isLoadingProjects: boolean;
  onProjectCreated?: (project?: Project) => void;
  onProjectSelected?: (projectId: string) => void;
}

export const CreateProjectModal = ({ open, onOpenChange, projects, isLoadingProjects, onProjectCreated, onProjectSelected }: CreateProjectModalProps) => {
  const { toast } = useToast();
  const { accessToken } = useAuth();
  const [activeTab, setActiveTab] = useState<"my-project" | "new-project">("my-project");
  const [brdTemplates, setBrdTemplates] = useState<BRDTemplate[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [editingProject, setEditingProject] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Atlassian integration state
  const [isAtlassianLinked, setIsAtlassianLinked] = useState(false);
  const [jiraProjects, setJiraProjects] = useState<JiraProject[]>([]);
  const [confluenceSpaces, setConfluenceSpaces] = useState<ConfluenceSpace[]>([]);
  const [selectedJiraProject, setSelectedJiraProject] = useState("");
  const [selectedConfluenceSpace, setSelectedConfluenceSpace] = useState("");
  const [loadingIntegrations, setLoadingIntegrations] = useState(false);
  const [jiraPopoverOpen, setJiraPopoverOpen] = useState(false);
  const [confluencePopoverOpen, setConfluencePopoverOpen] = useState(false);

  const form = useForm<CreateProjectFormData>({
    resolver: zodResolver(createProjectSchema),
    defaultValues: {
      project_name: "",
      brd_template: "",
    },
  });

  const createProjectMutation = useMutation({
    mutationFn: createProject,
    onSuccess: (newProject) => {
      toast({
        title: "Success",
        description: "Project created successfully!",
      });
      form.reset();
      onOpenChange(false);
      onProjectCreated?.(newProject);
    },
    onError: (error: any) => {
      const msg = error?.message || "";
      const isDuplicate = msg.toLowerCase().includes("already exists");
      // Extract the detail from the JSON error body if present
      let description = "Failed to create project. Please try again.";
      if (isDuplicate) {
        try {
          const jsonPart = msg.substring(msg.indexOf("{"));
          description = JSON.parse(jsonPart).detail;
        } catch {
          description = "A project with this name already exists. Please choose a different name.";
        }
      }
      toast({
        title: isDuplicate ? "Duplicate Project Name" : "Error",
        description,
        variant: "destructive",
      });
      console.error("Error creating project:", error);
    },
  });

  const onSubmit = (data: CreateProjectFormData) => {
    // Validate Jira and Confluence are selected
    if (!isAtlassianLinked) {
      toast({
        title: "Atlassian account required",
        description: "Please link your Atlassian account before creating a project.",
        variant: "destructive",
      });
      return;
    }
    if (!selectedJiraProject || selectedJiraProject === "none") {
      toast({
        title: "Jira project required",
        description: "Please select a Jira project to link with this project.",
        variant: "destructive",
      });
      return;
    }
    if (!selectedConfluenceSpace || selectedConfluenceSpace === "none") {
      toast({
        title: "Confluence space required",
        description: "Please select a Confluence space to link with this project.",
        variant: "destructive",
      });
      return;
    }

    // Check for duplicate project name (case-insensitive)
    const trimmedName = data.project_name.trim();
    const isDuplicate = projects.some(
      (p) => p.project_name.toLowerCase() === trimmedName.toLowerCase()
    );
    if (isDuplicate) {
      form.setError("project_name", {
        message: "A project with this name already exists. Please choose a unique project name.",
      });
      return;
    }

    const projectData: CreateProjectRequest = {
      project_id: crypto.randomUUID(),
      project_name: data.project_name.trim(),
      description: data.brd_template || "",
      jira_project_key: selectedJiraProject,
      confluence_space_key: selectedConfluenceSpace,
    };

    createProjectMutation.mutate(projectData);
  };

  const loadAtlassianData = useCallback(async () => {
    if (!accessToken) return;

    setLoadingIntegrations(true);
    try {
      // Check if Atlassian is linked
      const status = await integrationsApi.getAtlassianStatus(accessToken);
      setIsAtlassianLinked(status.linked && !status.token_expired);

      if (status.linked) {
        // Fetch Jira projects and Confluence spaces in parallel
        const [jiraData, confluenceData] = await Promise.all([
          integrationsApi.getJiraProjects(accessToken),
          integrationsApi.getConfluenceSpaces(accessToken)
        ]);
        setJiraProjects(jiraData || []);
        setConfluenceSpaces(confluenceData || []);
      }
    } catch (error) {
      console.error('Error fetching Atlassian data:', error);
      toast({
        title: "Integration Error",
        description: "Failed to load Atlassian projects/spaces. Please check your connection.",
        variant: "destructive",
      });
    } finally {
      setLoadingIntegrations(false);
    }
  }, [accessToken, toast]);

  useEffect(() => {
    if (open) {
      // Reset form and selections each time the modal opens
      form.reset();
      setSelectedJiraProject("");
      setSelectedConfluenceSpace("");

      setIsLoadingTemplates(true);
      getBRDTemplates()
        .then(setBrdTemplates)
        .catch(console.error)
        .finally(() => setIsLoadingTemplates(false));

      // Fetch Atlassian data
      loadAtlassianData();
    }
  }, [open, loadAtlassianData]);

  console.log("CreateProjectModal render:", { open, activeTab, isAtlassianLinked, loadingIntegrations, jiraProjectsCount: jiraProjects.length });

  const handleUpdateProject = async (projectId: string) => {
    if (!editName.trim()) return;

    setIsUpdating(true);
    try {
      await updateProject(projectId, { project_name: editName });
      toast({
        title: "Success",
        description: "Project updated successfully",
      });
      setEditingProject(null);
      setEditName("");
      onProjectCreated?.();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update project",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteProject = async () => {
    if (!projectToDelete) return;

    setIsDeleting(true);
    try {
      await deleteProject(projectToDelete);
      toast({
        title: "Success",
        description: "Project deleted successfully",
      });
      setProjectToDelete(null);
      onProjectCreated?.();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete project",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const startEditing = (project: Project) => {
    setEditingProject(project.project_id);
    setEditName(project.project_name);
  };

  const filteredProjects = projects.filter(p =>
    p.project_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!createProjectMutation.isPending) onOpenChange(v); }}>
      <DialogContent className="sm:max-w-[440px] w-[calc(100%-2rem)] bg-white border border-border p-0 overflow-hidden">
        {/* Loading overlay while project is being created */}
        {createProjectMutation.isPending && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-white/95 backdrop-blur-sm rounded-lg">
            <Loader2 className="h-10 w-10 animate-spin text-red-600 mb-4" />
            <p className="text-lg font-semibold text-gray-800">Creating your project...</p>
            <p className="text-sm text-gray-500 mt-2 text-center px-6">
              Setting up integrations and syncing your knowledge base. This may take a moment.
            </p>
          </div>
        )}

        <div className="p-4 border-b bg-muted/30">
          <DialogTitle className="text-lg font-semibold flex items-center gap-2">
            <FolderKanban className="w-5 h-5 text-red-600" />
            Project Workspace
          </DialogTitle>
          <DialogDescription>
            {activeTab === "my-project" ? "Manage your existing projects" : (loadingIntegrations ? "Fetching integration data..." : "Create a new project integration")}
          </DialogDescription>
        </div>

        <div className="flex border-b">
          <button
            type="button"
            onClick={() => setActiveTab("my-project")}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === "my-project"
              ? "text-white rounded-tl-lg"
              : "text-muted-foreground hover:text-foreground"
              } `}
            style={activeTab === "my-project" ? { backgroundColor: '#D61120', color: '#fff' } : { color: '#858585' }}
          >
            My Project
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("new-project")}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === "new-project"
              ? "text-white rounded-tr-lg"
              : "text-muted-foreground hover:text-foreground"
              } `}
            style={activeTab === "new-project" ? { backgroundColor: '#D61120', color: '#fff' } : { color: '#858585' }}
          >
            New Project
          </button>
        </div>

        <div className="p-6 overflow-hidden min-w-0">
          {activeTab === "my-project" ? (
            <div className="space-y-4">
              <div className="relative">
                <Input
                  placeholder="Search projects..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-white border-border h-9 mb-2"
                />
              </div>

              <ScrollArea className="h-[240px] w-full rounded-md border p-1">
                {isLoadingProjects ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="h-6 w-6 animate-spin text-primary-red" />
                  </div>
                ) : filteredProjects.length === 0 ? (
                  <div className="text-center py-8 text-sm text-muted-foreground">
                    No projects found.
                  </div>
                ) : (
                  <div className="space-y-1">
                    {filteredProjects.map((project) => (
                      <div
                        key={project.project_id}
                        className="flex items-center justify-between p-2 rounded-md hover:bg-accent group"
                      >
                        {editingProject === project.project_id ? (
                          <div className="flex items-center gap-2 flex-1 mr-2">
                            <Input
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              className="h-8 text-sm"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleUpdateProject(project.project_id);
                                if (e.key === "Escape") setEditingProject(null);
                              }}
                            />
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                              onClick={() => handleUpdateProject(project.project_id)}
                              disabled={isUpdating}
                            >
                              {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckIcon className="h-4 w-4" />}
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => setEditingProject(null)}
                              disabled={isUpdating}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <>
                            <div className="flex-1 min-w-0">
                              <button
                                className="w-full text-left text-sm font-medium truncate px-2 py-1.5 rounded hover:bg-black/5 flex items-center justify-between group/btn"
                                onClick={() => {
                                  onProjectSelected?.(project.project_id);
                                  onOpenChange(false);
                                }}
                              >
                                <span className="truncate flex-1 font-semibold">{project.project_name}</span>

                                {/* Integration Indicators */}
                                <div className="flex items-center gap-1.5 ml-2 shrink-0">
                                  {isAtlassianLinked && (
                                    <span title="Atlassian Account Linked">
                                      <Link2 className="h-3.5 w-3.5 text-blue-500 opacity-60 group-hover/btn:opacity-100 transition-opacity" />
                                    </span>
                                  )}
                                  {project.jira_project_key && (
                                    <span title={`Jira Linked: ${project.jira_project_key}`}>
                                      <LayoutGrid className="h-3.5 w-3.5 text-indigo-600 opacity-80 group-hover/btn:opacity-100 transition-opacity" />
                                    </span>
                                  )}
                                  {project.confluence_space_key && (
                                    <span title={`Confluence Linked: ${project.confluence_space_key}`}>
                                      <FileText className="h-3.5 w-3.5 text-emerald-600 opacity-80 group-hover/btn:opacity-100 transition-opacity" />
                                    </span>
                                  )}
                                </div>
                              </button>
                            </div>
                            <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap ml-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  startEditing(project);
                                }}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-muted-foreground hover:text-red-600 hover:bg-red-50"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setProjectToDelete(project.project_id);
                                }}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          ) : (
            <div className="space-y-4">
              {loadingIntegrations ? (
                <div className="bg-muted/30 border border-border rounded-lg p-6 flex flex-col items-center justify-center space-y-4 animate-pulse">
                  <div className="relative">
                    <Loader2 className="h-10 w-10 animate-spin text-red-600" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="h-4 w-4 bg-white rounded-full border-2 border-red-600" />
                    </div>
                  </div>
                  <div className="text-center">
                    <h4 className="text-sm font-semibold">Syncing with Atlassian</h4>
                    <p className="text-xs text-muted-foreground mt-1">Fetching your Jira projects and Confluence spaces...</p>
                  </div>
                </div>
              ) : (
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 min-w-0">
                    <FormField
                      control={form.control}
                      name="project_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <textarea
                              {...field}
                              placeholder="Enter Project Name *"
                              maxLength={75}
                              rows={1}
                              className="flex w-full rounded-md border border-border bg-white px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none overflow-hidden min-h-[40px]"
                              onInput={(e) => {
                                const target = e.target as HTMLTextAreaElement;
                                target.style.height = 'auto';
                                target.style.height = `${target.scrollHeight}px`;
                              }}
                            />
                          </FormControl>
                          <div className="flex items-center justify-between">
                            <FormMessage />
                            <span className={cn(
                              "text-xs ml-auto",
                              (field.value?.length || 0) >= 75 ? "text-red-500" : "text-muted-foreground"
                            )}>
                              {field.value?.length || 0}/75
                            </span>
                          </div>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="brd_template"
                      render={({ field }) => (
                        <FormItem>
                          <Select onValueChange={field.onChange} value={field.value} disabled={isLoadingTemplates}>
                            <FormControl>
                              <SelectTrigger className="bg-white border-border h-10 overflow-hidden">
                                <SelectValue placeholder={isLoadingTemplates ? "Loading templates..." : "Select BRD Template"} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="bg-white">
                              {isLoadingTemplates ? (
                                <div className="flex items-center justify-center py-6">
                                  <Loader2 className="h-5 w-5 animate-spin text-primary-red" />
                                </div>
                              ) : brdTemplates.length > 0 ? (
                                brdTemplates.map((template) => (
                                  <SelectItem key={template.template_id} value={template.template_id}>
                                    {template.template_name}
                                  </SelectItem>
                                ))
                              ) : (
                                <div className="py-2 px-3 text-sm text-muted-foreground text-center">
                                  No templates available
                                </div>
                              )}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Atlassian Integration Section - REQUIRED */}
                    {isAtlassianLinked ? (
                      <div className="space-y-3 pt-2">
                        <div className="flex items-center gap-2 text-xs font-semibold text-red-600 pb-1">
                          <Info className="w-3 h-3" />
                          LINK TO ATLASSIAN (REQUIRED)
                        </div>

                        {/* Jira Project Selector */}
                        <FormItem>
                          <Popover open={jiraPopoverOpen} onOpenChange={setJiraPopoverOpen}>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                role="combobox"
                                aria-expanded={jiraPopoverOpen}
                                className={cn(
                                  "w-full justify-between h-10 bg-white font-normal overflow-hidden",
                                  !selectedJiraProject || selectedJiraProject === 'none' ? 'border-red-300' : 'border-green-400'
                                )}
                              >
                                <span className="truncate">
                                  {selectedJiraProject
                                    ? (() => {
                                        const proj = jiraProjects.find(p => p.key === selectedJiraProject);
                                        return proj ? `${proj.key} - ${proj.name}` : selectedJiraProject;
                                      })()
                                    : "Select Jira Project *"}
                                </span>
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[--radix-popover-trigger-width] p-0 bg-white" align="start">
                              <Command>
                                <CommandInput placeholder="Search Jira projects..." />
                                <CommandList>
                                  <CommandEmpty>No project found.</CommandEmpty>
                                  <CommandGroup>
                                    {jiraProjects.map(project => (
                                      <CommandItem
                                        key={project.key}
                                        value={`${project.key} ${project.name}`}
                                        onSelect={() => {
                                          setSelectedJiraProject(project.key);
                                          setJiraPopoverOpen(false);
                                        }}
                                        className="overflow-hidden"
                                      >
                                        <Check className={cn("mr-2 h-4 w-4 shrink-0", selectedJiraProject === project.key ? "opacity-100" : "opacity-0")} />
                                        <span className="font-medium shrink-0">{project.key}</span>
                                        <span className="ml-1 text-muted-foreground truncate">- {project.name}</span>
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                          {(!selectedJiraProject || selectedJiraProject === 'none') && (
                            <p className="text-xs text-red-500 mt-1">Jira project is required</p>
                          )}
                        </FormItem>

                        {/* Confluence Space Selector */}
                        <FormItem>
                          <Popover open={confluencePopoverOpen} onOpenChange={setConfluencePopoverOpen}>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                role="combobox"
                                aria-expanded={confluencePopoverOpen}
                                className={cn(
                                  "w-full justify-between h-10 bg-white font-normal overflow-hidden",
                                  !selectedConfluenceSpace || selectedConfluenceSpace === 'none' ? 'border-red-300' : 'border-green-400'
                                )}
                              >
                                <span className="truncate">
                                  {selectedConfluenceSpace
                                    ? (() => {
                                        const space = confluenceSpaces.find(s => s.key === selectedConfluenceSpace);
                                        return space ? `${space.key} - ${space.name}` : selectedConfluenceSpace;
                                      })()
                                    : "Select Confluence Space *"}
                                </span>
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[--radix-popover-trigger-width] p-0 bg-white" align="start">
                              <Command>
                                <CommandInput placeholder="Search Confluence spaces..." />
                                <CommandList>
                                  <CommandEmpty>No space found.</CommandEmpty>
                                  <CommandGroup>
                                    {confluenceSpaces.map(space => (
                                      <CommandItem
                                        key={space.key}
                                        value={`${space.key} ${space.name}`}
                                        onSelect={() => {
                                          setSelectedConfluenceSpace(space.key);
                                          setConfluencePopoverOpen(false);
                                        }}
                                        className="overflow-hidden"
                                      >
                                        <Check className={cn("mr-2 h-4 w-4 shrink-0", selectedConfluenceSpace === space.key ? "opacity-100" : "opacity-0")} />
                                        <span className="font-medium shrink-0">{space.key}</span>
                                        <span className="ml-1 text-muted-foreground truncate">- {space.name}</span>
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                          {(!selectedConfluenceSpace || selectedConfluenceSpace === 'none') && (
                            <p className="text-xs text-red-500 mt-1">Confluence space is required</p>
                          )}
                        </FormItem>
                      </div>
                    ) : (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-4 mt-2">
                        <div className="flex items-start gap-2">
                          <Info className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-sm font-medium text-red-800">Atlassian account required</p>
                            <p className="text-xs text-red-600 mt-1">
                              Please link your Atlassian account first to create a project. Click your profile avatar (top-right) → Link Atlassian Account.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="pt-4">
                      <Button
                        type="submit"
                        disabled={
                          createProjectMutation.isPending ||
                          !isAtlassianLinked ||
                          !selectedJiraProject ||
                          selectedJiraProject === 'none' ||
                          !selectedConfluenceSpace ||
                          selectedConfluenceSpace === 'none'
                        }
                        className="w-full h-10 px-8 text-white font-semibold transition-all hover:opacity-90 bg-[#D61120]"
                      >
                        {createProjectMutation.isPending ? (
                          <div className="flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Creating...
                          </div>
                        ) : "Create Project"}
                      </Button>
                    </div>
                  </form>
                </Form>
              )}
            </div>
          )}
        </div>
      </DialogContent>

      <AlertDialog open={!!projectToDelete} onOpenChange={(open) => !open && setProjectToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the project
              and all its data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDeleteProject();
              }}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Delete Project
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
};
