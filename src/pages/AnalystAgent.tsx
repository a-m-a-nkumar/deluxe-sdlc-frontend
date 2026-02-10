import { useState, useRef, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Download, Sparkles, Send, FileText, Menu } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { streamAnalystMessage, AnalystSessionManager, ChatSession, StoredMessage } from "@/services/analystApi";
import { toast } from "sonner";
import { downloadBRD } from "@/services/projectApi";
import { ChatMessage } from "@/components/chat/ChatMessage";
import { SessionSidebar } from "@/components/analyst/SessionSidebar";
import { useAppState } from "@/contexts/AppStateContext";

interface ChatMessageType {
  id: string;
  content: string;
  isBot: boolean;
  timestamp: string;
  isTyping?: boolean;
  isLoading?: boolean;
}

const AnalystAgent = () => {
  const navigate = useNavigate();
  const { selectedProject } = useAppState();

  // Ref for accessing latest selectedProject in async functions/shutdowns
  const selectedProjectRef = useRef(selectedProject);
  useEffect(() => {
    selectedProjectRef.current = selectedProject;
  }, [selectedProject]);

  const INITIAL_MESSAGE: ChatMessageType = {
    id: "1",
    content: "Hello! I'm Mary, your Strategic Business Analyst. I'm here to help you create a comprehensive Business Requirements Document (BRD) through a structured conversation.\n\nI'll ask you questions about your project to understand:\n• Project purpose and objectives\n• Business drivers and pain points\n• Stakeholders and their roles\n• Scope (what's in and out)\n• Functional and non-functional requirements\n• Constraints and assumptions\n• Success criteria\n\nLet's start! What is the main idea or goal of your project?",
    isBot: true,
    timestamp: new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }),
  };

  // Session management
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isSessionsLoading, setIsSessionsLoading] = useState(false);

  // Chat state
  const [messages, setMessages] = useState<ChatMessageType[]>([INITIAL_MESSAGE]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [isGeneratingBRD, setIsGeneratingBRD] = useState(false);
  const [brdId, setBrdId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);





  // Reload sessions when project changes
  useEffect(() => {
    if (selectedProject) {
      console.log(`[AnalystAgent] Project changed to: ${selectedProject.project_name} (${selectedProject.project_id})`);

      // Clear current session and messages
      setCurrentSessionId(null);
      setMessages([INITIAL_MESSAGE]);
      setBrdId(null);

      // Reload sessions for new project
      loadSessions();

      toast.info(`Switched to project: ${selectedProject.project_name}`);
    }
  }, [selectedProject?.project_id]); // Watch for project_id changes


  // Load current session messages when session changes
  useEffect(() => {
    let active = true;

    const fetchSessionData = async () => {
      if (currentSessionId) {
        // Clear messages immediately when switching sessions
        setMessages([INITIAL_MESSAGE]);
        await loadSessionMessages(currentSessionId);

        if (!active) return;

        try {
          const session = await AnalystSessionManager.getSession(currentSessionId);
          console.log(`[AnalystAgent] Loading session ${currentSessionId}, BRD ID:`, session?.brdId);

          if (!active) return;

          if (session?.brdId) {
            setBrdId(session.brdId);
            console.log(`[AnalystAgent] ✅ BRD ID set to: ${session.brdId}`);
          } else {
            setBrdId(null);
            console.log(`[AnalystAgent] ❌ No BRD ID for this session`);
          }
        } catch (e) {
          console.error("Error fetching session details:", e);
        }
      } else {
        setMessages([INITIAL_MESSAGE]);
        setBrdId(null);
      }
    };

    fetchSessionData();
    return () => { active = false; };
  }, [currentSessionId]);

  // Save messages to localStorage - REMOVED/NO-OP
  // We rely on backend persistence now.
  // We only rename session based on first message
  useEffect(() => {
    const checkRename = async () => {
      if (currentSessionId && messages.length === 3 && !isHistoryLoading) {
        const firstUserMessage = messages.find(m => !m.isBot);
        if (firstUserMessage) {
          const title = firstUserMessage.content.slice(0, 50) + (firstUserMessage.content.length > 50 ? "..." : "");
          await AnalystSessionManager.renameSession(currentSessionId, title);
          loadSessions(false); // Silent reload
        }
      }
    };
    checkRename();
  }, [messages, currentSessionId, isHistoryLoading]);

  // Check for BRD ID in messages
  useEffect(() => {
    const checkBrd = async () => {
      let latestFoundBrdId: string | null = null;
      for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i];
        if (msg.isBot) {
          const brdIdMatch = msg.content.match(/BRD ID:\s*([a-f0-9-]+)/i);
          if (brdIdMatch && brdIdMatch[1]) {
            latestFoundBrdId = brdIdMatch[1];
            break;
          }
        }
      }

      if (latestFoundBrdId && latestFoundBrdId !== brdId) {
        setBrdId(latestFoundBrdId);
        if (currentSessionId) {
          await AnalystSessionManager.setBrdIdForSession(currentSessionId, latestFoundBrdId);
          loadSessions(false);
        }
        toast.success("BRD generated successfully! You can now download it.");
      }
    };
    checkBrd();
  }, [messages, brdId, currentSessionId]);

  // Load sessions using API
  // Load sessions using API
  const loadSessions = async (showLoading = true) => {
    const projectId = selectedProject?.project_id;

    if (projectId) {
      AnalystSessionManager.setCurrentProjectId(projectId);

      try {
        if (showLoading) {
          setIsSessionsLoading(true); // Set local loading state only if requested
        }

        const projectSessions = await AnalystSessionManager.getAllSessions(projectId);

        // Race condition check: Ensure we are still on the same project
        if (selectedProjectRef.current?.project_id !== projectId) {
          console.log(`[AnalystAgent] Ignoring stale sessions for project: ${projectId}`);
          return;
        }

        setSessions(projectSessions);

        console.log(`[AnalystAgent] Loaded ${projectSessions.length} sessions for project: ${projectId}`);

        if (!currentSessionId) {
          if (projectSessions.length > 0) {
            setCurrentSessionId(projectSessions[0].id);
            AnalystSessionManager.setCurrentSessionId(projectSessions[0].id);
          } else {
            const newSession = await AnalystSessionManager.createSession("New Chat", projectId);
            // Re-check race condition
            if (selectedProjectRef.current?.project_id !== projectId) return;

            setSessions([newSession]);
            setCurrentSessionId(newSession.id);
            AnalystSessionManager.setCurrentSessionId(newSession.id);  // CRITICAL: Sync localStorage
            console.log(`[AnalystAgent] Created first session for project: ${projectId}, Session ID: ${newSession.id}`);
          }
        }
      } catch (error) {
        console.error("Error loading sessions:", error);
        toast.error("Failed to load sessions");
      } finally {
        if (showLoading) {
          setIsSessionsLoading(false);
        }
      }
    } else {
      setSessions([]);
      setCurrentSessionId(null);
    }
  };

  const loadSessionMessages = async (sessionId: string) => {
    setMessages([INITIAL_MESSAGE]);
    setIsHistoryLoading(true);

    try {
      console.log(`[AnalystAgent] Loading messages for session: ${sessionId}`);
      const storedMessages = await AnalystSessionManager.getSessionMessages(sessionId);

      // Race condition check: Ensure we are still on the requested session
      // Note: currentSessionId might have changed while awaiting
      if (sessionId !== currentSessionId) {
        console.log(`[AnalystAgent] Ignoring stale messages for session: ${sessionId}`);
        return;
      }

      if (storedMessages && storedMessages.length > 0) {
        const formattedMessages: ChatMessageType[] = storedMessages.map((msg, index) => ({
          id: msg.id || `msg-${index}`,
          content: msg.content,
          isBot: msg.isBot,
          timestamp: msg.timestamp || new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        }));
        setMessages([INITIAL_MESSAGE, ...formattedMessages]);
      } else {
        setMessages([INITIAL_MESSAGE]);
      }
    } catch (error) {
      console.error("[AnalystAgent] Error loading session messages:", error);
      toast.error("Failed to load conversation history");
      setMessages([INITIAL_MESSAGE]);
    } finally {
      if (sessionId === currentSessionId) {
        setIsHistoryLoading(false);
      }
    }
  };

  const handleNewSession = async () => {
    const projectId = selectedProject?.project_id;
    if (!projectId) return;

    try {
      const newSession = await AnalystSessionManager.createSession("New Chat", projectId);

      // Update local state
      setSessions((prev) => [newSession, ...prev]);
      setCurrentSessionId(newSession.id);
      AnalystSessionManager.setCurrentSessionId(newSession.id);
      setMessages([INITIAL_MESSAGE]);
      setBrdId(null);

      setIsMobileSidebarOpen(false);
    } catch (error) {
      console.error("Error creating session:", error);
      toast.error("Failed to create new session");
    }
  };

  const handleSelectSession = (sessionId: string) => {
    setCurrentSessionId(sessionId);
    AnalystSessionManager.setCurrentSessionId(sessionId);
    setIsMobileSidebarOpen(false);
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (confirm("Are you sure you want to delete this chat session?")) {
      // Optimistic update
      const previousSessions = [...sessions];

      const updatedSessions = sessions.filter((s) => s.id !== sessionId);
      setSessions(updatedSessions);

      if (currentSessionId === sessionId) {
        if (updatedSessions.length > 0) {
          setCurrentSessionId(updatedSessions[0].id);
          AnalystSessionManager.setCurrentSessionId(updatedSessions[0].id);
        } else {
          setCurrentSessionId(null);
          AnalystSessionManager.setCurrentSessionId(""); // Clear
          setMessages([INITIAL_MESSAGE]);
        }
      }

      try {
        await AnalystSessionManager.deleteSession(sessionId);
        toast.success("Session deleted");
      } catch (error) {
        console.error("Error deleting session:", error);
        toast.error("Failed to delete session");

        // Revert optimistic update on failure - reload to be safe
        loadSessions(false);
      }
    }
  };

  const handleRenameSession = async (sessionId: string, newTitle: string) => {
    // Optimistic update
    setSessions(prev =>
      prev.map(s => s.id === sessionId ? { ...s, title: newTitle } : s)
    );

    try {
      await AnalystSessionManager.renameSession(sessionId, newTitle);
      toast.success("Session renamed");
    } catch (error) {
      console.error("Error renaming session:", error);
      toast.error("Failed to rename session");
      // Revert optimistic update on failure - strictly reload to get source of truth
      loadSessions(false);
    }
  };

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return;

    if (!currentSessionId) {
      // Need to handle creation here if new session needed
      const projectId = selectedProject?.project_id;
      if (projectId) {
        await handleNewSession();
        // Re-trigger send? Complex. 
        // Simplest is to create session and then proceed.
      } else {
        toast.error("Please select a project first.");
        return;
      }
    }

    const userContent = inputValue.trim();
    setInputValue("");

    const userMessage: ChatMessageType = {
      id: Date.now().toString(),
      content: userContent,
      isBot: false,
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    const botMessageId = (Date.now() + 1).toString();
    const botPlaceholder: ChatMessageType = {
      id: botMessageId,
      content: "",
      isBot: true,
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      isTyping: true,
    };
    setMessages((prev) => [...prev, botPlaceholder]);

    try {
      // Ensure we have a valid session
      let sessionId = currentSessionId;
      const projectId = selectedProject?.project_id;

      if (!sessionId && projectId) {
        const newSession = await AnalystSessionManager.createSession("New Chat", projectId);
        sessionId = newSession.id;
        setCurrentSessionId(sessionId);
        setSessions([newSession, ...sessions]);
      }

      if (!sessionId) {
        throw new Error("No session active");
      }

      const projectIdToUse = selectedProject?.project_id;

      console.log(`[AnalystAgent] Sending message with session ID from state: ${sessionId}`);

      let fullResponse = "";
      for await (const chunk of streamAnalystMessage(userContent, sessionId, projectIdToUse)) {
        fullResponse += chunk;
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === botMessageId
              ? { ...msg, content: fullResponse, isTyping: false }
              : msg
          )
        );
      }

      // Update session if BRD ID found etc. (handled by useEffect on messages)

      // Refresh sessions to update timestamp
      loadSessions(false);

    } catch (error) {
      console.error("Error in chat:", error);
      toast.error("Failed to receive response");
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === botMessageId
            ? { ...msg, content: "Sorry, I encountered an error. Please try again.", isTyping: false }
            : msg
        )
      );
    } finally {
      setIsLoading(false);
    }
  };


  const handleGenerateBRD = async () => {
    // Use session ID from React state (database), not localStorage
    const sessionId = currentSessionId;

    if (!sessionId || sessionId === "none") {
      toast.error("No active session. Please start a conversation first.");
      return;
    }

    setIsGeneratingBRD(true);
    toast.info("Generating BRD from conversation history... This may take a few minutes.");

    try {
      const { apiPost } = await import("@/services/api");
      const { API_CONFIG } = await import("@/config/api");
      const API_BASE_URL = `${API_CONFIG.BASE_URL}/analyst-generate-brd`;

      const formData = new FormData();
      formData.append("session_id", sessionId);

      const response = await apiPost(API_BASE_URL, formData);

      if (!response.ok) {
        const text = await response.text().catch(() => "Unable to read error response");
        throw new Error(`HTTP error! status: ${response.status} - ${text}`);
      }

      const data = await response.json();

      if (data.brd_id) {
        setBrdId(data.brd_id);
        if (currentSessionId) {
          await AnalystSessionManager.setBrdIdForSession(currentSessionId, data.brd_id);
          // Reload sessions to refresh state
          loadSessions(false);
        }
        toast.success(`BRD generated successfully! BRD ID: ${data.brd_id}`);

        const successMessage: ChatMessageType = {
          id: `brd-generated-${Date.now()}`,
          content: `✅ BRD generated successfully!\n\nBRD ID: ${data.brd_id}\n\nYou can now download the BRD using the download button.`,
          isBot: true,
          timestamp: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        };
        setMessages((prev) => [...prev, successMessage]);
      } else {
        throw new Error(data.error || "BRD generation failed");
      }
    } catch (error: any) {
      console.error("BRD generation error:", error);
      toast.error(error.message || "Failed to generate BRD. Please try again.");

      const errorMessage: ChatMessageType = {
        id: `brd-error-${Date.now()}`,
        content: `❌ Failed to generate BRD: ${error.message || "Unknown error"}\n\nPlease try again or continue the conversation to gather more requirements.`,
        isBot: true,
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsGeneratingBRD(false);
    }
  };

  const handleDownloadBRD = async () => {
    if (!brdId) {
      toast.error("No BRD available to download. Please generate a BRD first.");
      return;
    }

    try {
      const blob = await downloadBRD("", `BRD_${brdId}.docx`, brdId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `BRD_${brdId}.docx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success("BRD downloaded successfully!");
    } catch (error) {
      console.error("Download error:", error);
      toast.error("Failed to download BRD. Please try again.");
    }
  };

  const handleBack = () => {
    navigate("/");
  };

  const currentSession = sessions.find(s => s.id === currentSessionId);

  return (
    <MainLayout currentView="analyst" showBackButton onBack={handleBack}>
      <div className="flex h-full">
        {/* Session Sidebar - Desktop */}
        <div className="hidden lg:block h-[calc(100vh-4rem)] sticky top-16">
          <SessionSidebar
            sessions={sessions}
            currentSessionId={currentSessionId}
            onSelectSession={handleSelectSession}
            onNewSession={handleNewSession}
            onDeleteSession={handleDeleteSession}
            onRenameSession={handleRenameSession}
            isCollapsed={isSidebarCollapsed}
            onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            isLoading={isSessionsLoading}
          />
        </div>

        {/* Mobile Session Sidebar Overlay */}
        {isMobileSidebarOpen && (
          <div className="lg:hidden fixed inset-0 z-50 bg-black/50" onClick={() => setIsMobileSidebarOpen(false)}>
            <div className="w-64 h-full bg-background" onClick={(e) => e.stopPropagation()}>
              <SessionSidebar
                sessions={sessions}
                currentSessionId={currentSessionId}
                onSelectSession={handleSelectSession}
                onNewSession={handleNewSession}
                onDeleteSession={handleDeleteSession}
                onRenameSession={handleRenameSession}
                isLoading={isSessionsLoading}
              />
            </div>
          </div>
        )}

        {/* Main Chat Content */}
        <div className="flex-1 min-w-0">
          <div className="p-4 sm:p-6 lg:p-8">
            <div className="mb-4 lg:mb-6">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  {/* Mobile Session Menu Button */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsMobileSidebarOpen(true)}
                    className="lg:hidden p-2 hover:bg-accent"
                    title="Show chat sessions"
                  >
                    <Menu className="w-4 h-4" />
                  </Button>

                  <Sparkles className="w-5 h-5 text-primary" />
                  <h1 className="text-xl font-bold sm:text-2xl">Business Analyst Agent</h1>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={handleGenerateBRD}
                    disabled={isGeneratingBRD || !currentSessionId}
                    className="flex items-center gap-2"
                    variant="outline"
                    size="sm"
                  >
                    {isGeneratingBRD ? (
                      <>
                        <div className="w-4 h-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        <span className="hidden sm:inline">Generating...</span>
                      </>
                    ) : (
                      <>
                        <FileText className="w-4 h-4" />
                        <span className="hidden sm:inline">Generate BRD</span>
                      </>
                    )}
                  </Button>
                  {brdId && (
                    <Button onClick={handleDownloadBRD} className="flex items-center gap-2" size="sm">
                      <Download className="w-4 h-4" />
                      <span className="hidden sm:inline">Download</span>
                    </Button>
                  )}
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                {currentSession?.title || "Have a conversation with Mary, your Strategic Business Analyst"}
              </p>
            </div>

            <div className="max-w-5xl mx-auto">
              <Card className="h-[600px] sm:h-[700px] flex flex-col overflow-hidden relative">
                <CardHeader className="pb-4 border-b">
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-primary" />
                    Requirements Gathering Session
                  </CardTitle>
                </CardHeader>

                <CardContent className="flex-1 flex flex-col min-h-0 p-4">
                  <div
                    className="flex-1 mb-4 overflow-y-auto max-h-full pr-2"
                    style={{
                      scrollbarWidth: "thin",
                      scrollbarColor: "#cbd5e1 transparent",
                    }}
                  >
                    {messages.length === 0 ? (
                      <div className="flex items-center justify-center h-full text-muted-foreground">
                        <p className="text-sm">Start a conversation...</p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {messages.map((message) => (
                          <ChatMessage key={message.id} message={message} />
                        ))}
                        <div ref={messagesEndRef} />
                      </div>
                    )}
                  </div>

                  {isHistoryLoading && (
                    <div className="absolute inset-0 bg-background/50 backdrop-blur-sm flex items-center justify-center z-10">
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                        <p className="text-sm text-muted-foreground font-medium">Loading conversation history...</p>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2 pt-4 border-t items-end">
                    <Textarea
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      placeholder="Type your message... (Shift+Enter for new line)"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSend();
                        }
                      }}
                      disabled={isLoading}
                      className="flex-1 min-h-[40px] max-h-[200px] resize-none"
                      style={{ backgroundColor: "#fff" }}
                    />
                    <Button
                      onClick={handleSend}
                      size="sm"
                      className="px-3"
                      disabled={isLoading || !inputValue.trim()}
                    >
                      {isLoading ? (
                        <div className="w-4 h-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default AnalystAgent;
