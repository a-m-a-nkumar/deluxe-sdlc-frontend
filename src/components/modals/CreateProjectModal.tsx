import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { ChevronRight, Check, ChevronsUpDown, Loader2 } from "lucide-react";
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
import { useToast } from "@/hooks/use-toast";
import { createProject, type CreateProjectRequest, getBRDTemplates, type BRDTemplate, type Project } from "@/services/projectApi";
import { cn } from "@/lib/utils";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const createProjectSchema = z.object({
  project_name: z.string().min(1, "Project name is required"),
  brd_template: z.string().optional(),
});

type CreateProjectFormData = z.infer<typeof createProjectSchema>;

interface CreateProjectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projects: Project[];
  isLoadingProjects: boolean;
  onProjectCreated?: () => void;
  onProjectSelected?: (projectId: string) => void;
}

export const CreateProjectModal = ({ open, onOpenChange, projects, isLoadingProjects, onProjectCreated, onProjectSelected }: CreateProjectModalProps) => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"my-project" | "new-project">("my-project");
  const [brdTemplates, setBrdTemplates] = useState<BRDTemplate[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [projectOpen, setProjectOpen] = useState(false);
  
  const form = useForm<CreateProjectFormData>({
    resolver: zodResolver(createProjectSchema),
    defaultValues: {
      project_name: "",
      brd_template: "",
    },
  });

  const createProjectMutation = useMutation({
    mutationFn: createProject,
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Project created successfully!",
      });
      form.reset();
      onOpenChange(false);
      onProjectCreated?.();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create project. Please try again.",
        variant: "destructive",
      });
      console.error("Error creating project:", error);
    },
  });

  const onSubmit = (data: CreateProjectFormData) => {
    const projectData: CreateProjectRequest = {
      project_name: data.project_name,
      description: data.brd_template || "",
      jira_project_key: data.project_name.substring(0, 3).toUpperCase(),
      confluence_space_key: data.project_name.substring(0, 3).toUpperCase(),
    };
    
    createProjectMutation.mutate(projectData);
  };

  // Load BRD templates when modal opens
  useEffect(() => {
    if (open) {
      setIsLoadingTemplates(true);
      getBRDTemplates()
        .then(setBrdTemplates)
        .catch(console.error)
        .finally(() => setIsLoadingTemplates(false));
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`sm:max-w-[360px] bg-white border-0 p-0 ${activeTab === "new-project" ? "[&>button]:text-white [&>button]:z-10" : ""}`}>
        <DialogTitle className="sr-only">Project Workspace</DialogTitle>
        <DialogDescription className="sr-only">
          Select an existing project or create a new one
        </DialogDescription>
        {/* Tabs Header */}
        <div className="flex border-b">
          <button
            type="button"
            onClick={() => setActiveTab("my-project")}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === "my-project"
                ? "text-white rounded-tl-lg"
                : "text-muted-foreground hover:text-foreground"
            }`}
            style={activeTab === "my-project" ? { backgroundColor: '#D61120', color: '#fff' } : { color: '#858585' }}
          >
            My Project
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("new-project")}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === "new-project"
                ? "text-white rounded-tr-lg"
                : "text-muted-foreground hover:text-foreground"
            }`}
            style={activeTab === "new-project" ? { backgroundColor: '#D61120', color: '#fff' } : { color: '#858585' }}
          >
            New Project
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {activeTab === "my-project" ? (
            <div className="space-y-4">
              <Popover open={projectOpen} onOpenChange={setProjectOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={projectOpen}
                    className="w-full justify-between bg-white border-border h-10"
                  >
                    {selectedProject
                      ? projects.find((project) => project.project_id === selectedProject)?.project_name
                      : "Select Project"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0 bg-white" align="start" style={{ maxHeight: '300px' }}>
                  <Command className="overflow-hidden">
                    <CommandInput placeholder="Search project..." />
                    <CommandList 
                      className="max-h-[200px] overflow-y-auto overflow-x-hidden" 
                      style={{ overscrollBehavior: 'contain' }}
                      onWheel={(e) => e.stopPropagation()}
                    >
                      {isLoadingProjects ? (
                        <div className="flex items-center justify-center py-6">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2" style={{ borderColor: '#D61120' }}></div>
                        </div>
                      ) : (
                        <>
                          <CommandEmpty>No project found.</CommandEmpty>
                          <CommandGroup>
                            {projects.map((project) => (
                              <CommandItem
                                key={project.project_id}
                                value={project.project_name}
                                onSelect={() => {
                                  setSelectedProject(project.project_id);
                                  setProjectOpen(false);
                                  onProjectSelected?.(project.project_id);
                                  onOpenChange(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    selectedProject === project.project_id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                {project.project_name}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </>
                      )}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="project_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Enter Project Name"
                          className="bg-white border-border h-10"
                        />
                      </FormControl>
                      <FormMessage />
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
                          <SelectTrigger className="bg-white border-border h-10">
                            <SelectValue placeholder={isLoadingTemplates ? "Loading templates..." : "Select BRD Template"} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-white">
                          {isLoadingTemplates ? (
                            <div className="flex items-center justify-center py-6">
                              <Loader2 className="h-5 w-5 animate-spin" style={{ color: '#D61120' }} />
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
                
                <div className="flex justify-end pt-8">
                  <Button
                    type="submit"
                    disabled={createProjectMutation.isPending}
                    className="text-sm"
                    style={{ 
                      color: '#D61120',
                      fontWeight: 'normal'
                    }}
                    variant="ghost"
                  >
                    {createProjectMutation.isPending ? "Creating..." : "Create Project"}
                  </Button>
                </div>
              </form>
            </Form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};