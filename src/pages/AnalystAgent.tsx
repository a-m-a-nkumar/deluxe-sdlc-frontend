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

  // Load sessions on mount
  useEffect(() => {
    loadSessions();
  }, []);

  // Load current session messages when session changes
  useEffect(() => {
    if (currentSessionId) {
      loadSessionMessages(currentSessionId);
      const session = AnalystSessionManager.getSession(currentSessionId);
      console.log(`[AnalystAgent] Loading session ${currentSessionId}, BRD ID:`, session?.brdId);
      if (session?.brdId) {
        setBrdId(session.brdId);
        console.log(`[AnalystAgent] ✅ BRD ID set to: ${session.brdId}`);
      } else {
        setBrdId(null);
        console.log(`[AnalystAgent] ❌ No BRD ID for this session`);
      }
    } else {
      setMessages([INITIAL_MESSAGE]);
      setBrdId(null);
    }
  }, [currentSessionId]);

  // Save messages to localStorage whenever they change
  useEffect(() => {
    // Prevent saving if we are currently loading history (avoids saving wrong session data)
    if (currentSessionId && messages.length > 1 && !isHistoryLoading) {
      const storedMessages: StoredMessage[] = messages
        .filter(msg => msg.id !== "1")
        .map(msg => ({
          id: msg.id,
          content: msg.content,
          isBot: msg.isBot,
          timestamp: msg.timestamp,
        }));
      AnalystSessionManager.saveSessionMessages(currentSessionId, storedMessages);

      if (messages.length === 3) {
        const firstUserMessage = messages.find(m => !m.isBot);
        if (firstUserMessage) {
          const title = firstUserMessage.content.slice(0, 50) + (firstUserMessage.content.length > 50 ? "..." : "");
          AnalystSessionManager.renameSession(currentSessionId, title);
          loadSessions();
        }
      }
    }
  }, [messages, currentSessionId, isHistoryLoading]);

  // Check for BRD ID in messages
  useEffect(() => {
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
        AnalystSessionManager.setBrdIdForSession(currentSessionId, latestFoundBrdId);
        loadSessions();
      }
      toast.success("BRD generated successfully! You can now download it.");
    }
  }, [messages, brdId, currentSessionId]);

  const loadSessions = () => {
    const allSessions = AnalystSessionManager.getAllSessions();
    setSessions(allSessions);

    if (!currentSessionId) {
      if (allSessions.length > 0) {
        setCurrentSessionId(allSessions[0].id);
        AnalystSessionManager.setCurrentSessionId(allSessions[0].id);
      } else {
        const newSession = AnalystSessionManager.createSession("New Chat");
        setSessions([newSession]);
        setCurrentSessionId(newSession.id);
      }
    }
  };

  const loadSessionMessages = async (sessionId: string) => {
    // Clear existing messages first to avoid showing previous session's chat
    setMessages([INITIAL_MESSAGE]);
    setIsHistoryLoading(true);

    try {
      // Get the backend session ID for this frontend session
      const backendSessionId = AnalystSessionManager.getBackendSessionId(sessionId);

      // Try to fetch from AgentCore Memory via backend API if we have a backend session ID
      if (backendSessionId) {
        console.log(`[AnalystAgent] Loading history from AgentCore Memory for frontend session: ${sessionId}, backend session: ${backendSessionId}`);

        const { fetchAnalystHistory } = await import("@/services/analystApi");
        const historyMessages = await fetchAnalystHistory(backendSessionId);

        if (historyMessages && historyMessages.length > 0) {
          console.log(`[AnalystAgent] ✅ Loaded ${historyMessages.length} messages from AgentCore Memory`);

          const formattedMessages: ChatMessageType[] = historyMessages.map((msg, index) => ({
            id: `history-${index}`,
            content: msg.content,
            isBot: msg.isBot,
            timestamp: msg.timestamp || new Date().toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
          }));

          setMessages([INITIAL_MESSAGE, ...formattedMessages]);

          // Update message count in session metadata
          AnalystSessionManager.updateSession(sessionId, {
            messageCount: historyMessages.length,
          });

          // Update sessions state to reflect new message count
          setSessions(AnalystSessionManager.getAllSessions());

          setIsHistoryLoading(false);
          return;
        }
      } else {
        console.log(`[AnalystAgent] No backend session ID yet for session: ${sessionId}`);
      }

      // Fallback: Load from localStorage if AgentCore Memory has no messages or no backend session
      console.log(`[AnalystAgent] Loading from localStorage for session: ${sessionId}`);
      const storedMessages = AnalystSessionManager.getSessionMessages(sessionId);

      if (storedMessages.length > 0) {
        const formattedMessages: ChatMessageType[] = storedMessages.map(msg => ({
          id: msg.id,
          content: msg.content,
          isBot: msg.isBot,
          timestamp: msg.timestamp,
        }));
        setMessages([INITIAL_MESSAGE, ...formattedMessages]);
      } else {
        setMessages([INITIAL_MESSAGE]);
      }
    } catch (error) {
      console.error("[AnalystAgent] Error loading session messages:", error);
      // On error, fall back to localStorage
      const storedMessages = AnalystSessionManager.getSessionMessages(sessionId);
      if (storedMessages.length > 0) {
        const formattedMessages: ChatMessageType[] = storedMessages.map(msg => ({
          id: msg.id,
          content: msg.content,
          isBot: msg.isBot,
          timestamp: msg.timestamp,
        }));
        setMessages([INITIAL_MESSAGE, ...formattedMessages]);
      } else {
        setMessages([INITIAL_MESSAGE]);
      }
    } finally {
      setIsHistoryLoading(false);
    }
  };

  const handleNewSession = () => {
    const newSession = AnalystSessionManager.createSession();
    setSessions([newSession, ...sessions]);
    setCurrentSessionId(newSession.id);
    setMessages([INITIAL_MESSAGE]);
    setBrdId(null);
    setInputValue("");
    setIsMobileSidebarOpen(false);
    toast.success("New chat session created!");
  };

  const handleSelectSession = (sessionId: string) => {
    setCurrentSessionId(sessionId);
    AnalystSessionManager.setCurrentSessionId(sessionId);
    setIsMobileSidebarOpen(false);
  };

  const handleDeleteSession = (sessionId: string) => {
    AnalystSessionManager.deleteSession(sessionId);
    const updatedSessions = sessions.filter(s => s.id !== sessionId);
    setSessions(updatedSessions);

    if (sessionId === currentSessionId) {
      if (updatedSessions.length > 0) {
        setCurrentSessionId(updatedSessions[0].id);
        AnalystSessionManager.setCurrentSessionId(updatedSessions[0].id);
      } else {
        handleNewSession();
      }
    }

    toast.success("Chat session deleted");
  };

  const handleRenameSession = (sessionId: string, newTitle: string) => {
    AnalystSessionManager.renameSession(sessionId, newTitle);
    loadSessions();
    toast.success("Session renamed");
  };

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return;

    if (!currentSessionId) {
      handleNewSession();
      return;
    }

    const userMessage: ChatMessageType = {
      id: Date.now().toString(),
      content: inputValue,
      isBot: false,
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    const currentMessage = inputValue;
    const currentMessages = messages;
    setMessages([...currentMessages, userMessage]);
    setInputValue("");
    setIsLoading(true);

    const botMessageId = `bot-${Date.now()}`;
    const botMessage: ChatMessageType = {
      id: botMessageId,
      content: "",
      isBot: true,
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      isLoading: true,
    };
    setMessages([...currentMessages, userMessage, botMessage]);

    let updatedMessages = [...currentMessages, userMessage, botMessage];

    try {
      let accumulatedContent = "";

      for await (const chunk of streamAnalystMessage(currentMessage)) {
        accumulatedContent += chunk;

        updatedMessages = updatedMessages.map((msg) =>
          msg.id === botMessageId
            ? { ...msg, content: accumulatedContent, isLoading: false, isTyping: false }
            : msg
        );
        setMessages(updatedMessages);
      }

      setIsLoading(false);

      const brdIdMatch = accumulatedContent.match(/BRD ID:\s*([a-f0-9-]+)/i);
      if (brdIdMatch && brdIdMatch[1]) {
        setBrdId(brdIdMatch[1]);
        if (currentSessionId) {
          AnalystSessionManager.setBrdIdForSession(currentSessionId, brdIdMatch[1]);
          loadSessions();
        }
      }
    } catch (error) {
      console.error("Chat error:", error);
      setIsLoading(false);

      const withoutLoading = updatedMessages.filter((msg) => msg.id !== botMessageId);
      const errorMessage: ChatMessageType = {
        id: `error-${Date.now()}`,
        content: "Sorry, I couldn't process your message right now. Please try again later.",
        isBot: true,
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };
      setMessages([...withoutLoading, errorMessage]);

      toast.error("Failed to send message. Please check your connection and try again.");
    }
  };

  const handleGenerateBRD = async () => {
    let sessionId = AnalystSessionManager.getSessionId();

    if (!sessionId || sessionId === "none") {
      toast.error("No active session. Please start a conversation first.");
      return;
    }

    setIsGeneratingBRD(true);
    toast.info("Generating BRD from conversation history... This may take a few minutes.");

    try {
      const { apiPost } = await import("@/services/api");
      const API_BASE_URL = "http://localhost:8000/analyst-generate-brd";

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
          AnalystSessionManager.setBrdIdForSession(currentSessionId, data.brd_id);
          loadSessions();
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
