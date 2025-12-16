import { useState, useEffect } from "react";
import { Search, ChevronDown, ArrowUp, User, Calendar, Link, FileText, Clock, ExternalLink, Code } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { searchJiraIssues, JiraIssue } from "@/services/jiraApi";
import { useToast } from "@/hooks/use-toast";
import { useAppState } from "@/contexts/AppStateContext";

interface DisplayIssue {
  id: string;
  title: string;
  type: string;
  priority: string;
  status: string;
  assignee: string;
  reporter: string;
  points: string;
  created: string;
  updated: string;
  description: string;
  sprint: string;
  labels: string[];
  url: string;
}

export const JiraDashboard = () => {
  const [issues, setIssues] = useState<DisplayIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIssue, setSelectedIssue] = useState<DisplayIssue | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all-status");
  const [typeFilter, setTypeFilter] = useState("all-type");
  const { toast } = useToast();
  const { newlyCreatedJiraIssueId, setNewlyCreatedJiraIssueId } = useAppState();

  const mapJiraIssueToDisplayIssue = (jiraIssue: JiraIssue): DisplayIssue => {
    const formatDate = (dateString: string) => {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    };

    const getPriorityLevel = (priorityName: string): string => {
      const priority = priorityName.toLowerCase();
      if (priority.includes('high') || priority.includes('critical') || priority.includes('blocker')) {
        return 'high';
      }
      return 'medium';
    };

    const extractTextFromADF = (description: any): string => {
      if (!description) return "No description provided";
      if (typeof description === 'string') return description;
      
      // Handle Atlassian Document Format (ADF)
      if (description.type === 'doc' && description.content) {
        const texts: string[] = [];
        const extractText = (node: any): void => {
          if (node.type === 'text' && node.text) {
            texts.push(node.text);
          } else if (node.content && Array.isArray(node.content)) {
            node.content.forEach(extractText);
          }
        };
        description.content.forEach(extractText);
        return texts.join(' ') || "No description provided";
      }
      
      return "No description provided";
    };

    // Extract base URL from self link
    const baseUrl = jiraIssue.self ? jiraIssue.self.split('/rest/api')[0] : '';
    const issueUrl = baseUrl ? `${baseUrl}/browse/${jiraIssue.key}` : '#';

    return {
      id: jiraIssue.key,
      title: jiraIssue.fields.summary,
      type: jiraIssue.fields.issuetype.name,
      priority: getPriorityLevel(jiraIssue.fields.priority.name),
      status: jiraIssue.fields.status.name,
      assignee: jiraIssue.fields.assignee?.displayName || "Unassigned",
      reporter: jiraIssue.fields.reporter?.displayName || "Unknown",
      points: jiraIssue.fields.customfield_10016?.toString() || "0",
      created: formatDate(jiraIssue.fields.created),
      updated: formatDate(jiraIssue.fields.updated),
      description: extractTextFromADF(jiraIssue.fields.description),
      sprint: jiraIssue.fields.sprint?.name || "No sprint",
      labels: jiraIssue.fields.labels || [],
      url: issueUrl
    };
  };

  useEffect(() => {
    const loadJiraIssues = async () => {
      setLoading(true);
      try {
        const response = await searchJiraIssues();
        const mappedIssues = response.issues.map(mapJiraIssueToDisplayIssue);
        setIssues(mappedIssues);
        
        // Check if there's a newly created issue to highlight
        if (newlyCreatedJiraIssueId) {
          const newlyCreatedIssue = mappedIssues.find(issue => issue.id === newlyCreatedJiraIssueId);
          if (newlyCreatedIssue) {
            setSelectedIssue(newlyCreatedIssue);
            setNewlyCreatedJiraIssueId(null); // Clear after setting
          } else if (mappedIssues.length > 0) {
            setSelectedIssue(mappedIssues[0]);
          }
        } else if (mappedIssues.length > 0) {
          setSelectedIssue(mappedIssues[0]);
        }
      } catch (error) {
        console.error("Failed to load Jira issues:", error);
        toast({
          title: "Error loading issues",
          description: "Failed to fetch Jira issues. Please try again later.",
          variant: "destructive",
        });
        // Set empty state on error
        setIssues([]);
        setSelectedIssue(null);
      } finally {
        setLoading(false);
      }
    };

    loadJiraIssues();
  }, [toast, newlyCreatedJiraIssueId, setNewlyCreatedJiraIssueId]);

  // Filter issues based on search term, status, and type
  const filteredIssues = issues.filter(issue => {
    const matchesSearch = searchTerm === "" || 
      issue.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      issue.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      issue.id.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all-status" || 
      issue.status.toLowerCase().replace(/[-\s]/g, '') === statusFilter.replace(/[-\s]/g, '');
    
    const matchesType = typeFilter === "all-type" || 
      issue.type.toLowerCase() === typeFilter;

    return matchesSearch && matchesStatus && matchesType;
  });

  // Update selected issue if it's filtered out
  useEffect(() => {
    if (filteredIssues.length > 0 && selectedIssue && !filteredIssues.find(issue => issue.id === selectedIssue.id)) {
      setSelectedIssue(filteredIssues[0]);
    }
  }, [filteredIssues, selectedIssue]);
  const getPriorityIcon = (priority: string) => {
    return priority === "high" ? <ArrowUp className="w-3 h-3 text-red-500" /> : <ArrowUp className="w-3 h-3 text-orange-500 rotate-45" />;
  };
  const getStatusBadge = (status: string) => {
    const statusConfig = {
      "In Progress": "bg-white text-blue-700",
      "To-do": "bg-white text-gray-700",
      "Under Review": "bg-white text-yellow-700",
      "Done": "bg-white text-green-700"
    };
    return statusConfig[status] || "bg-white text-gray-700";
  };
  const getTypeBadge = (type: string) => {
    const typeConfig = {
      "Story": "bg-white text-green-700",
      "Bug": "bg-white text-red-700",
      "Task": "bg-white text-blue-700",
      "Epic": "bg-white text-purple-700"
    };
    return typeConfig[type] || "bg-white text-gray-700";
  };
  return <div className="h-full bg-white">
      <div className="p-2 sm:p-4 md:p-6">
        <div className="flex flex-col lg:flex-row gap-4 sm:gap-6">
           <div className="w-full lg:w-80 xl:w-96 lg:self-stretch">
             <div className="border border-[#CCCCCC] rounded-md h-full">
               <div className="p-4 sm:p-6 flex flex-col bg-white h-full rounded-md max-h-[670px] overflow-y-auto">
          {/* Search and Filters */}
          <div className="space-y-4 mb-4 sm:mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input type="text" placeholder="Search pages" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full h-10 pl-10 pr-4 border border-[#DEDCDC] rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-ring text-sm" />
            </div>
            
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="flex-1 bg-white">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all-status">All Status</SelectItem>
                  <SelectItem value="inprogress">In Progress</SelectItem>
                  <SelectItem value="todo">To-do</SelectItem>
                  <SelectItem value="underreview">Under Review</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="flex-1 bg-white">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all-type">All Type</SelectItem>
                  <SelectItem value="story">Story</SelectItem>
                  <SelectItem value="bug">Bug</SelectItem>
                  <SelectItem value="task">Task</SelectItem>
                  <SelectItem value="epic">Epic</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Issues List */}
          <div className="flex-1 overflow-y-auto">
            <h3 className="font-semibold text-sm mb-4">Issues</h3>
            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-24 w-full" />
                ))}
              </div>
            ) : (
              <div className="space-y-2 max-h-100 overflow-y-auto issues-scrollbar" style={{
                scrollbarWidth: 'thin',
                scrollbarColor: '#E6E6E6 transparent'
              }}>
                <style dangerouslySetInnerHTML={{
                  __html: `
                    .issues-scrollbar::-webkit-scrollbar {
                      width: 6px;
                    }
                    .issues-scrollbar::-webkit-scrollbar-thumb {
                      background-color: #E6E6E6;
                      border-radius: 3px;
                    }
                    .issues-scrollbar::-webkit-scrollbar-track {
                      background: transparent;
                    }
                  `
                }} />
                {filteredIssues.map(issue => <div key={issue.id}><div className={`p-3 border border-[#DEDCDC] rounded cursor-pointer hover:bg-gray-50 transition-colors ${selectedIssue?.id === issue.id ? 'border-primary bg-primary/10 shadow-md' : ''}`} onClick={() => setSelectedIssue(issue)}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium" style={{
                          color: '#6C6C6C',
                          fontSize: '12px'
                        }}>{issue.id}</span>
                      <Badge className={`${getTypeBadge(issue.type)} text-xs px-2 py-0`}>
                        {issue.type}
                      </Badge>
                    </div>
                    {getPriorityIcon(issue.priority)}
                  </div>
                  
                  <h4 className="font-medium mb-2 line-clamp-2" style={{
                      fontSize: '16px',
                      color: '#3B3B3B',
                      fontWeight: 'medium'
                    }}>
                    {issue.title}
                  </h4>
                  
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1 min-w-0 flex-1" style={{
                        color: '#747474'
                      }}>
                      <Avatar className="h-4 w-4 flex-shrink-0">
                        <AvatarFallback className="text-xs">
                          {issue.assignee.split(' ').map(n => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      <span className="truncate">{issue.assignee}</span>
                      <span className="flex-shrink-0">• {issue.points} pts</span>
                    </div>
                    <Badge className={`${getStatusBadge(issue.status)} text-xs px-2 py-0 flex-shrink-0 ml-2`}>
                      {issue.status}
                    </Badge>
                  </div>
                </div></div>)}
              </div>
            )}
            </div>
            </div>
          </div>
        </div>

        {/* Main Content - Issue Details */}
        <div className="flex-1 bg-white rounded-md">
          {!selectedIssue ? (
            <div className="rounded-md border border-[#CCCCCC] p-6">
              <p className="text-muted-foreground text-center">Select an issue to view details</p>
            </div>
          ) : (
          <>
          {/* Wrapped Issue Details */}
          <div className="rounded-md border border-[#CCCCCC] pt-4 sm:pt-6 px-4 sm:px-6 pb-[10px] mb-4 sm:mb-6">
            {/* Issue Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 md:mb-4 gap-4">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="font-medium text-sm">{selectedIssue.id}</span>
                <Badge className={`${getTypeBadge(selectedIssue.type)} text-xs px-2 py-1`}>
                  {selectedIssue.type}
                </Badge>
                <Badge className={`${getStatusBadge(selectedIssue.status)} text-xs px-2 py-1`}>
                  {selectedIssue.status}
                </Badge>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="gap-2 text-sm font-normal"
                  onClick={() => window.open(selectedIssue.url, '_blank')}
                >
                  <ExternalLink className="w-4 h-4" />
                  <span className="hidden sm:inline">View in Jira</span>
                  <span className="sm:hidden">View</span>
                </Button>
                <Button variant="outline" size="sm" className="gap-2 text-sm">
                  <Code className="w-4 h-4" />
                  <span className="hidden sm:inline font-normal">Generate Code</span>
                  <span className="sm:hidden">Generate</span>
                </Button>
              </div>
            </div>

            {/* Issue Title */}
            <h1 className="text-lg mb-4 sm:mb-6 break-words sm:text-base font-bold">{selectedIssue.title}</h1>

            {/* Issue Metadata */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-4 sm:mb-6 text-sm">
              <div>
                <span style={{ color: '#747474', fontSize: '12px', fontWeight: 'normal' }}>Assignee:</span>
                <div style={{ color: '#3B3B3B', fontWeight: 'normal' }} className="truncate">{selectedIssue.assignee}</div>
              </div>
              <div>
                <span style={{ color: '#747474', fontSize: '12px', fontWeight: 'normal' }}>Reporter:</span>
                <div style={{ color: '#3B3B3B', fontWeight: 'normal' }} className="truncate">{selectedIssue.reporter}</div>
              </div>
              <div>
                <span style={{ color: '#747474', fontSize: '12px', fontWeight: 'normal' }}>Created:</span>
                <div style={{ color: '#3B3B3B', fontWeight: 'normal' }}>{selectedIssue.created}</div>
              </div>
              <div>
                <span style={{ color: '#747474', fontSize: '12px', fontWeight: 'normal' }}>Updated:</span>
                <div style={{ color: '#3B3B3B', fontWeight: 'normal' }}>{selectedIssue.updated}</div>
              </div>
            </div>

            {/* Description */}
            <div className="mb-4 sm:mb-6 pt-4 sm:pt-6 border-t border-[#CCCCCC]">
              <h3 className="font-semibold mb-2">Description</h3>
              <p className="text-sm text-foreground leading-relaxed">{selectedIssue.description}</p>
            </div>

            {/* Issue Details Grid */}
            <div className="grid grid-cols-11 gap-4 sm:gap-6 mb-4 sm:mb-6">
              {/* Priority, Story Points, Sprint Column */}
              <div className="col-span-6 border border-[#CCCCCC] rounded p-3 flex justify-between">
                <div>
                  <span style={{ color: '#747474', fontSize: '12px', fontWeight: 'normal' }}>Priority</span>
                  <div className="flex items-center gap-1 mt-1">
                    {getPriorityIcon(selectedIssue.priority)}
                    <span style={{ color: '#3B3B3B', fontWeight: 'normal' }} className="text-sm capitalize">{selectedIssue.priority}</span>
                  </div>
                </div>
                <div>
                  <span style={{ color: '#747474', fontSize: '12px', fontWeight: 'normal' }}>Story Points</span>
                  <div style={{ color: '#3B3B3B', fontWeight: 'normal' }} className="text-sm mt-1">{selectedIssue.points}</div>
                </div>
                <div>
                  <span style={{ color: '#747474', fontSize: '12px', fontWeight: 'normal' }}>Sprint</span>
                  <div style={{ color: '#3B3B3B', fontWeight: 'normal' }} className="text-sm mt-1">{selectedIssue.sprint}</div>
                </div>
              </div>
              
              {/* Labels Column */}
              <div className="col-span-5 border border-[#CCCCCC] rounded p-3">
                <span style={{ color: '#747474', fontSize: '12px', fontWeight: 'normal' }}>Labels</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {selectedIssue.labels.length > 0 ? (
                    selectedIssue.labels.map((label, index) => <Badge key={index} variant="secondary" className="text-xs">
                      {label}
                    </Badge>)
                  ) : (
                    <span style={{ color: '#747474', fontSize: '12px', fontWeight: 'normal' }}>No labels found</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* BRD Integration Actions */}
          <div className="border border-[#CCCCCC] rounded-md p-4">
            <h3 className="font-semibold mb-4 text-[#3B3B3B]">BRD Integration Actions</h3>
            
            {/* Blue background section */}
            <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-4">
              <button className="text-blue-600 font-medium mb-2 hover:underline cursor-pointer bg-transparent border-none p-0">
                Create BRD from Issue
              </button>
              <p className="text-[#3B3B3B] text-sm mb-4">
                Generate a Business Requirements Document based on this Jira issue and its details.
              </p>
              <Button className="bg-[hsl(var(--primary))] text-white hover:bg-[hsl(var(--primary))]/90 w-full sm:w-auto">
                Generate BRD from Issue
              </Button>
            </div>
            
            {/* Action buttons outside blue section */}
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 sm:justify-end">
              <Button variant="outline" size="sm" className="gap-2 bg-white font-normal">
                <Link className="w-4 h-4" />
                Link to BRD
              </Button>
              <Button variant="outline" size="sm" className="gap-2 bg-white font-normal">
                <FileText className="w-4 h-4" />
                Export Details
              </Button>
              <Button variant="outline" size="sm" className="gap-2 bg-white font-normal">
                <Clock className="w-4 h-4" />
                Track Progress
              </Button>
            </div>
          </div>
          </>
          )}
           </div>
         </div>
       </div>
     </div>;
};