import { Search, ChevronRight, ChevronDown, User, FileText, Users, Calendar, Tag, ExternalLink, Eye, Sparkles, FlaskConical, ShieldX, Folder, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useState, useEffect } from "react";
import { fetchConfluencePages, fetchConfluencePageDetails, ConfluencePage, ConfluencePageDetails } from "@/services/confluenceApi";
import { useToast } from "@/hooks/use-toast";
import { useAppState } from "@/contexts/AppStateContext";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

// Build a tree from flat pages using ancestors
interface TreeNode {
  id: string;
  title: string;
  children: TreeNode[];
  page?: any;
}

function buildPageTree(pages: any[]): TreeNode[] {
  const nodeMap = new Map<string, TreeNode>();
  const childIds = new Set<string>();

  // Create a node for every page
  for (const page of pages) {
    nodeMap.set(page.id, { id: page.id, title: page.title, children: [], page });
  }

  // For each page, find its direct parent from ancestors and link them
  for (const page of pages) {
    const ancestors = page.ancestors || [];
    if (ancestors.length <= 1) continue; // skip space root only

    // Direct parent = last ancestor (excluding space root at index 0)
    const directParent = ancestors[ancestors.length - 1];

    // Create parent node if it doesn't exist (parent page not in fetched list)
    if (!nodeMap.has(directParent.id)) {
      nodeMap.set(directParent.id, { id: directParent.id, title: directParent.title, children: [] });
    }

    const parentNode = nodeMap.get(directParent.id)!;
    const childNode = nodeMap.get(page.id)!;
    if (!parentNode.children.find(c => c.id === childNode.id)) {
      parentNode.children.push(childNode);
    }
    childIds.add(page.id);
  }

  // Roots = nodes that are NOT a child of another node
  const roots: TreeNode[] = [];
  for (const [id, node] of nodeMap) {
    if (!childIds.has(id)) roots.push(node);
  }

  // Debug — remove after fixing
  console.log("[TREE]", { totalPages: pages.length, nodes: nodeMap.size, roots: roots.length, childIds: childIds.size });
  for (const [id, node] of nodeMap) {
    if (node.children.length > 0) console.log("[FOLDER]", node.title, "->", node.children.map(c => c.title));
  }
  for (const page of pages) {
    console.log("[PAGE]", page.title, "ancestors:", (page.ancestors || []).map((a: any) => a.title));
  }

  return roots;
}

export const ConfluenceDashboard = () => {
  const { accessToken, isBusinessUser } = useAuth();
  const {
    activeConfluencePageId,
    setActiveConfluencePageId,
    selectedProject,
    isRestoringProject
  } = useAppState();
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [pages, setPages] = useState<ConfluencePage[]>([]);
  const [pageDetails, setPageDetails] = useState<ConfluencePageDetails | null>(null);
  const [isLoadingPages, setIsLoadingPages] = useState(true);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [showAccessDenied, setShowAccessDenied] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (accessToken && !isRestoringProject) loadPages();
  }, [accessToken, selectedProject, isRestoringProject]);

  // Set active page when activeConfluencePageId is set
  useEffect(() => {
    if (activeConfluencePageId && pages.length > 0) {
      const newlyCreatedPage = pages.find(page => page.id === activeConfluencePageId);
      if (newlyCreatedPage) {
        setSelectedPageId(newlyCreatedPage.id);
        setActiveConfluencePageId(null); // Clear after setting
      }
    }
  }, [activeConfluencePageId, pages, setActiveConfluencePageId]);

  useEffect(() => {
    if (selectedPageId) {
      loadPageDetails(selectedPageId);
    }
  }, [selectedPageId]);

  const loadPages = async () => {
    if (!accessToken) return;
    if (!selectedProject?.confluence_space_key) {
      setPages([]);
      setIsLoadingPages(false);
      toast({
        title: "No project selected",
        description: "Select a project to view Confluence pages.",
      });
      return;
    }
    try {
      setIsLoadingPages(true);
      setSelectedPageId(null);
      setPageDetails(null);
      setExpandedFolders(new Set());
      const spaceKey = selectedProject.confluence_space_key;
      const fetchedPages = await fetchConfluencePages(accessToken, spaceKey);
      // Sort by last modified (newest first) using version.when from Confluence API
      const sorted = [...fetchedPages].sort((a: any, b: any) => {
        const dateA = a.version?.when || "";
        const dateB = b.version?.when || "";
        return dateB.localeCompare(dateA);
      });
      setPages(sorted);
      // Only auto-select first page if there's no activeConfluencePageId waiting to be set
      if (fetchedPages.length > 0 && !selectedPageId && !activeConfluencePageId) {
        setSelectedPageId(fetchedPages[0].id);
      }
    } catch (error) {
      toast({
        title: "Error loading pages",
        description: "Failed to fetch Confluence pages. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingPages(false);
    }
  };

  const loadPageDetails = async (pageId: string) => {
    if (!accessToken) return;
    try {
      setIsLoadingDetails(true);
      const details = await fetchConfluencePageDetails(pageId, accessToken);
      setPageDetails(details);
    } catch (error) {
      toast({
        title: "Error loading page details",
        description: "Failed to fetch page details. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingDetails(false);
    }
  };

  // Build tree from ALL pages, then filter
  const fullTree = buildPageTree(pages);

  function filterTree(nodes: TreeNode[], query: string): TreeNode[] {
    if (!query) return nodes;
    const q = query.toLowerCase();
    return nodes.reduce<TreeNode[]>((acc, node) => {
      const titleMatch = node.title.toLowerCase().includes(q);
      const filteredChildren = filterTree(node.children, query);
      if (titleMatch) {
        // Folder matches search — keep ALL its children so it renders as a folder
        acc.push({ ...node, children: node.children });
      } else if (filteredChildren.length > 0) {
        // Children match — show folder with only matching children
        acc.push({ ...node, children: filteredChildren });
      }
      return acc;
    }, []);
  }

  const filteredTree = filterTree(fullTree, searchTerm);

  // Flat filtered list for backward compat (page count etc)
  const filteredPages = pages.filter(page =>
    page.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      "Approved": "bg-green-100 text-green-700",
      "Under Review": "bg-yellow-100 text-yellow-700",
      "Published": "bg-purple-100 text-purple-700",
      "In Progress": "bg-blue-100 text-blue-700",
      "Draft": "bg-gray-100 text-gray-700",
      "Current": "text-white border-0"
    };

    return statusConfig[status] || "bg-gray-100 text-gray-700";
  };


  const formatConfluenceContent = (htmlContent: string) => {
    if (!htmlContent) return htmlContent;

    // Convert markdown bold ** to <strong>
    let formatted = htmlContent.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    // Convert ### subheadings to <h4> with bold
    formatted = formatted.replace(/###\s+(.+)/g, '<h4><strong>$1</strong></h4>');

    // Make sure all headings are bold
    formatted = formatted.replace(/<h1>((?:(?!<strong>).)*)<\/h1>/g, '<h1><strong>$1</strong></h1>');
    formatted = formatted.replace(/<h2>((?:(?!<strong>).)*)<\/h2>/g, '<h2><strong>$1</strong></h2>');
    formatted = formatted.replace(/<h3>((?:(?!<strong>).)*)<\/h3>/g, '<h3><strong>$1</strong></h3>');
    formatted = formatted.replace(/<h4>((?:(?!<strong>).)*)<\/h4>/g, '<h4><strong>$1</strong></h4>');
    formatted = formatted.replace(/<h5>((?:(?!<strong>).)*)<\/h5>/g, '<h5><strong>$1</strong></h5>');
    formatted = formatted.replace(/<h6>((?:(?!<strong>).)*)<\/h6>/g, '<h6><strong>$1</strong></h6>');

    // Remove tables that don't have tbody
    formatted = formatted.replace(/<table[^>]*>(?:(?!<tbody)[\s\S])*?<\/table>/gi, '');

    return formatted;
  };

  return (
    <div className="h-full bg-white">
      <div className="p-2 sm:p-4 md:p-6">
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 sm:gap-6 h-auto xl:h-full">
          {/* Left Sidebar - Search and Pages List */}
          <div className="xl:col-span-3 order-1 xl:order-1">
            <div className="h-auto xl:h-[650px] flex flex-col border border-[#ccc] p-[20px] rounded-lg">
              {/* Search Bar */}
              <div className="mb-4 sm:mb-6">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search pages"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full h-[45px] pl-10 pr-4 border border-[#DEDCDC] rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-ring text-sm"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto pr-2 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:bg-[#E6E6E6] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full">
                <div>
                  {isLoadingPages ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      Loading pages...
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {(() => {
                        const tree = filteredTree;
                        const toggleFolder = (id: string) => {
                          setExpandedFolders(prev => {
                            const next = new Set(prev);
                            next.has(id) ? next.delete(id) : next.add(id);
                            return next;
                          });
                        };
                        const renderNode = (node: TreeNode, depth: number = 0): React.ReactNode => {
                          const hasChildren = node.children.length > 0;
                          // Auto-expand folders when searching
                          const isExpanded = searchTerm ? true : expandedFolders.has(node.id);

                          if (hasChildren) {
                            // Folder node (page with children)
                            return (
                              <div key={node.id}>
                                <div
                                  className={`flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors ${selectedPageId === node.id ? 'bg-primary/5 border border-primary' : ''}`}
                                  style={{ marginLeft: `${depth * 16}px` }}
                                  onClick={() => {
                                    toggleFolder(node.id);
                                    if (node.page) setSelectedPageId(node.id);
                                  }}
                                >
                                  {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />}
                                  {isExpanded ? <FolderOpen className="w-4 h-4 text-amber-500 flex-shrink-0" /> : <Folder className="w-4 h-4 text-amber-500 flex-shrink-0" />}
                                  <span className="text-sm font-medium text-foreground truncate flex-1">{node.title}</span>
                                  <span className="text-[10px] text-muted-foreground">{node.children.length}</span>
                                </div>
                                {isExpanded && (
                                  <div>
                                    {node.children.map(child => renderNode(child, depth + 1))}
                                  </div>
                                )}
                              </div>
                            );
                          }

                          // Leaf page node
                          return (
                            <div
                              key={node.id}
                              className={`p-3 border-[#DEDCDC] border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors ${selectedPageId === node.id ? 'border-primary bg-primary/5' : ''}`}
                              style={{ marginLeft: `${depth * 16}px` }}
                              onClick={() => setSelectedPageId(node.id)}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  <FileText className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                                  <h3 className="font-medium text-sm text-foreground truncate">{node.title}</h3>
                                </div>
                                <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                              </div>
                            </div>
                          );
                        };
                        return tree.length > 0 ? tree.map(node => renderNode(node)) : (
                          <div className="text-center text-muted-foreground text-sm py-8">
                            No pages found matching your search.
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right Content Area */}
          <div className="xl:col-span-9 order-2 xl:order-2">
            <div className="border border-[#CCCCCC] rounded-lg h-auto xl:h-[650px] flex flex-col">
              {/* Header */}
              <div className="flex-shrink-0 flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#CCCCCC] p-4 sm:p-[24px] gap-4">
                <h1 className="text-base font-semibold truncate flex-1">{pageDetails?.title || 'Select a page'}</h1>
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                  <Button
                    variant="outline"
                    className="bg-red-600 text-white border border-red-600 text-sm font-normal flex items-center gap-2 hover:bg-black hover:text-white hover:border-black transition-colors"
                    onClick={() => pageDetails && window.open(`https://deluxe.atlassian.net/wiki${pageDetails._links.webui}`, '_blank')}
                    disabled={!pageDetails}
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span className="hidden sm:inline">View in Confluence</span>
                    <span className="sm:hidden">View</span>
                  </Button>
                  {isBusinessUser && (
                  <Button
                    variant="outline"
                    className="bg-purple-600 text-white border border-purple-600 text-sm font-normal flex items-center gap-2 hover:bg-purple-700 hover:text-white hover:border-purple-700 transition-colors"
                    onClick={() => selectedPageId && navigate(`/jira-generation/${selectedPageId}`)}
                    disabled={!selectedPageId}
                  >
                    <Sparkles className="w-4 h-4" />
                    <span className="hidden sm:inline">Generate Jira Items</span>
                    <span className="sm:hidden">Generate</span>
                  </Button>
                  )}


                </div>
              </div>

              {/* Content Details */}
              <div className="flex-1 overflow-y-auto rounded-lg p-4 sm:p-6 bg-white [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:bg-[#E6E6E6] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full">
                {isLoadingDetails ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Loading page details...
                  </div>
                ) : pageDetails ? (
                  pageDetails.body?.storage?.value ? (
                    <>
                      <div className="flex items-center gap-3 mb-4">
                        <Avatar className="h-8 w-8 flex-shrink-0">
                          <AvatarFallback className="text-sm text-white bg-primary">
                            {pageDetails.version.by.displayName.split(' ').map(n => n[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium">{pageDetails.version.by.displayName}</span>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mb-6 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4 flex-shrink-0 text-primary" />
                          <span>{new Date(pageDetails.version.when).toLocaleString()}</span>
                        </div>
                        <Badge
                          className={`${getStatusBadge(pageDetails.status)} self-start ${pageDetails.status === 'Current' ? 'bg-blue-700 border-blue-700 text-white' : ''}`}
                        >
                          {pageDetails.status}
                        </Badge>
                      </div>

                      <div className="space-y-6">
                        <div
                          className="text-sm leading-relaxed prose prose-sm max-w-none 
                        [&_*]:text-[#747474] 
                        [&_h1]:text-[#3B3B3B] [&_h1]:font-bold [&_h1]:text-lg [&_h1]:mb-4 [&_h1]:mt-6 
                        [&_h2]:text-[#3B3B3B] [&_h2]:font-bold [&_h2]:text-lg [&_h2]:mb-4 [&_h2]:mt-5 
                        [&_h3]:text-[#3B3B3B] [&_h3]:font-bold [&_h3]:text-base [&_h3]:mb-3 [&_h3]:mt-4 
                        [&_h4]:text-[#3B3B3B] [&_h4]:font-bold [&_h5]:text-[#3B3B3B] [&_h5]:font-bold [&_h6]:text-[#3B3B3B] [&_h6]:font-bold 
                        [&_strong]:text-[#3B3B3B] [&_strong]:font-semibold 
                        [&_p]:mb-3 [&_ul]:mb-3 [&_ol]:mb-3 
                        [&_table]:mb-6 [&_table]:w-full [&_table]:border-collapse [&_table]:border [&_table]:border-[#DEDCDC]
                        [&_thead]:bg-black
                        [&_th]:border [&_th]:border-[#DEDCDC] [&_th]:bg-black [&_th]:px-4 [&_th]:py-2 [&_th]:text-left [&_th]:font-bold [&_th]:text-white
                        [&_th_*]:!text-white [&_th_strong]:!text-white
                        [&_td]:border [&_td]:border-[#DEDCDC] [&_td]:px-4 [&_td]:py-2 [&_td]:text-[#747474] [&_td]:min-h-[40px]
                        [&_td:empty]:after:content-['—'] [&_td:empty]:after:text-[#CCCCCC]
                        [&_tr]:border-b [&_tr]:border-[#DEDCDC]
                        [&_ac-structured-macro]:hidden [&_ac-adf-extension]:hidden"
                          dangerouslySetInnerHTML={{
                            __html: formatConfluenceContent(
                              pageDetails.body.storage.value
                                .replace(/true%7B%22[^<]*/g, '')
                                .replace(/<ac:structured-macro[^>]*>[\s\S]*?<\/ac:structured-macro>/g, '')
                                .replace(/<ac:adf-extension[^>]*>[\s\S]*?<\/ac:adf-extension>/g, '')
                            )
                          }}
                        />

                        {pageDetails.ancestors && pageDetails.ancestors.length > 0 && (
                          <div className="mt-6">
                            <h4 className="text-sm font-medium mb-3">Breadcrumb</h4>
                            <div className="flex flex-wrap gap-2">
                              {pageDetails.ancestors.map((ancestor) => (
                                <Badge key={ancestor.id} variant="secondary" className="text-xs">
                                  {ancestor.title}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <p className="mb-2">This page doesn't have content available.</p>
                      <Button
                        variant="outline"
                        className="mt-4"
                        onClick={() => pageDetails && window.open(`https://deluxe.atlassian.net/wiki${pageDetails._links.webui}`, '_blank')}
                      >
                        View in Confluence
                      </Button>
                    </div>
                  )
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    Select a page to view details
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Access Denied Dialog */}
      <Dialog open={showAccessDenied} onOpenChange={setShowAccessDenied}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-primary-light">
                <ShieldX className="w-5 h-5 text-primary" />
              </div>
              <DialogTitle className="text-lg font-semibold">Access Denied</DialogTitle>
            </div>
            <DialogDescription className="text-sm text-gray-600 leading-relaxed pt-1">
              You do not have permission to access this module. Please contact your
              administrator to request access through the appropriate Azure AD group.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-2">
            <Button
              onClick={() => setShowAccessDenied(false)}
              className="bg-primary text-white"
            >
              Return to Dashboard
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};