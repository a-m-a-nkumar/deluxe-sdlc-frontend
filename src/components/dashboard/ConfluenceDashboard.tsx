import { Search, ChevronRight, User, FileText, Users, Calendar, Tag, ExternalLink, Plus, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useState, useEffect } from "react";
import { fetchConfluencePages, fetchConfluencePageDetails, ConfluencePage, ConfluencePageDetails } from "@/services/confluenceApi";
import { useToast } from "@/hooks/use-toast";
import { useAppState } from "@/contexts/AppStateContext";
import { createJiraStoryFromConfluence } from "@/services/jiraApi";
import { useNavigate } from "react-router-dom";

export const ConfluenceDashboard = () => {
  const { 
    activeConfluencePageId, 
    setActiveConfluencePageId,
    isCreatingJiraStory,
    setIsCreatingJiraStory,
    setNewlyCreatedJiraIssueId
  } = useAppState();
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [pages, setPages] = useState<ConfluencePage[]>([]);
  const [pageDetails, setPageDetails] = useState<ConfluencePageDetails | null>(null);
  const [isLoadingPages, setIsLoadingPages] = useState(true);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    loadPages();
  }, []);

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
    try {
      setIsLoadingPages(true);
      const fetchedPages = await fetchConfluencePages();
      setPages(fetchedPages);
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
    try {
      setIsLoadingDetails(true);
      const details = await fetchConfluencePageDetails(pageId);
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

  const handleCreateJiraStory = async () => {
    if (!selectedPageId) {
      toast({
        title: "No page selected",
        description: "Please select a Confluence page first.",
        variant: "destructive",
      });
      return;
    }

    setIsCreatingJiraStory(true);
    try {
      const response = await createJiraStoryFromConfluence(selectedPageId);
      
      setIsCreatingJiraStory(false);
      
      if (response.issue_key) {
        setNewlyCreatedJiraIssueId(response.issue_key);
        toast({
          title: "Jira story created",
          description: `Successfully created ${response.issue_key}`,
        });
        navigate('/jira');
      } else {
        toast({
          title: "Story created",
          description: response.message || "Successfully created Jira story",
        });
        navigate('/jira');
      }
    } catch (error) {
      setIsCreatingJiraStory(false);
      toast({
        title: "Creation failed",
        description: "Failed to create Jira story. Please try again.",
        variant: "destructive",
      });
    }
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

              {/* Payment Gateway Section */}
              <div className="flex-1 overflow-y-auto pr-2 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:bg-[#E6E6E6] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full">
                <div>
                  <h2 className="text-base sm:text-lg font-semibold mb-4">Payment Gateway</h2>
                  {isLoadingPages ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      Loading pages...
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {filteredPages.map((page) => (
                        <div 
                          key={page.id} 
                          className={`p-3 sm:p-4 border-[#DEDCDC] border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors ${
                            selectedPageId === page.id ? 'border-primary bg-primary/5' : ''
                          }`}
                          onClick={() => setSelectedPageId(page.id)}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="font-medium text-sm text-foreground truncate pr-2 flex-1">
                              {page.title}
                            </h3>
                            <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          </div>
                          
                          <div className="flex items-center justify-between">
                            <span 
                              className="text-[10px] truncate text-black px-2 py-1"
                              style={{backgroundColor: '#E5E5E5', borderRadius: '50px'}}
                            >
                              {page.status}
                            </span>
                          </div>
                        </div>
                      ))}
                      {filteredPages.length === 0 && (
                        <div className="text-center text-muted-foreground text-sm py-8">
                          No pages found matching your search.
                        </div>
                      )}
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
                    className="bg-red-600 text-white border border-red-600 text-sm flex items-center gap-2 hover:bg-black hover:text-white hover:border-black transition-colors"
                    style={{
                      fontSize: '14px',
                      fontWeight: 'normal'
                    }}
                    onClick={() => pageDetails && window.open(`https://siriusai-team-test.atlassian.net/wiki${pageDetails._links.webui}`, '_blank')}
                    disabled={!pageDetails}
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span className="hidden sm:inline">View in Confluence</span>
                    <span className="sm:hidden">View</span>
                  </Button>
                  <Button 
                    variant="outline" 
                    className="bg-red-600 text-white border border-red-600 text-sm flex items-center gap-2 hover:bg-black hover:text-white hover:border-black transition-colors"
                    style={{
                      fontSize: '14px',
                      fontWeight: 'normal'
                    }}
                    onClick={handleCreateJiraStory}
                    disabled={!selectedPageId || isCreatingJiraStory}
                  >
                    {isCreatingJiraStory ? (
                      <>
                        <div className="w-4 h-4 animate-spin rounded-full border-2 border-current border-t-transparent flex-shrink-0" />
                        <span className="hidden sm:inline">Creating Jira issue for {pageDetails?.title || 'page'}</span>
                        <span className="sm:hidden">Creating...</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4" />
                        <span className="hidden sm:inline">Create Epic & Story</span>
                        <span className="sm:hidden">Create</span>
                      </>
                    )}
                  </Button>
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
                        <AvatarFallback className="text-sm bg-red-600 text-white">
                          {pageDetails.version.by.displayName.split(' ').map(n => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium">{pageDetails.version.by.displayName}</span>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mb-6 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4 flex-shrink-0 text-red-600" />
                        <span>{new Date(pageDetails.version.when).toLocaleString()}</span>
                      </div>
                      <Badge 
                        className={`${getStatusBadge(pageDetails.status)} self-start ${pageDetails.status === 'Current' ? 'hover:bg-red-600' : ''}`}
                        style={{
                          backgroundColor: pageDetails.status === 'Current' ? '#0000FF' : undefined,
                          borderColor: pageDetails.status === 'Current' ? '#0000FF' : undefined,
                          color: pageDetails.status === 'Current' ? '#fff' : undefined
                        }}
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
                        onClick={() => pageDetails && window.open(`https://siriusai-team-test.atlassian.net/wiki${pageDetails._links.webui}`, '_blank')}
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
    </div>
  );
};