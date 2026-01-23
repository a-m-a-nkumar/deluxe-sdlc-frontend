import { useState, useRef, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Download, Sparkles, Send, FileText, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { streamAnalystMessage, AnalystSessionManager } from "@/services/analystApi";
import { toast } from "sonner";
import { downloadBRD } from "@/services/projectApi";
import { ChatMessage } from "@/components/chat/ChatMessage";

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

  const [messages, setMessages] = useState<ChatMessageType[]>([INITIAL_MESSAGE]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);
  const [isGeneratingBRD, setIsGeneratingBRD] = useState(false);
  const [brdId, setBrdId] = useState<string | null>(AnalystSessionManager.getBrdId());
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Check for BRD ID in messages
  useEffect(() => {
    // Find the most recent BRD ID mentioned by the bot
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

    // Only update and toast if it's a new BRD ID we haven't seen in this session state
    if (latestFoundBrdId && latestFoundBrdId !== brdId) {
      setBrdId(latestFoundBrdId);
      AnalystSessionManager.setBrdId(latestFoundBrdId);
      toast.success("BRD generated successfully! You can now download it.");
    }
  }, [messages, brdId]);

  // Load conversation history on mount
  useEffect(() => {
    const loadHistory = async () => {
      const sessionId = AnalystSessionManager.getSessionId();
      if (!sessionId || sessionId === "none") {
        console.log("[AnalystAgent] No session ID found, skipping history load");
        setIsHistoryLoading(false);
        return;
      }

      console.log(`[AnalystAgent] Loading history for session: ${sessionId}`);

      try {
        const { fetchAnalystHistory } = await import("@/services/analystApi");
        const historyMessages = await fetchAnalystHistory(sessionId);

        if (historyMessages && historyMessages.length > 0) {
          console.log(`[AnalystAgent] Loaded ${historyMessages.length} messages from history`);

          // Convert history messages to ChatMessageType format
          const formattedMessages: ChatMessageType[] = historyMessages.map((msg, index) => ({
            id: `history-${index}`,
            content: msg.content,
            isBot: msg.isBot,
            timestamp: new Date().toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
          }));

          // Prepend the initial greeting message
          const initialMessage: ChatMessageType = {
            ...INITIAL_MESSAGE,
            timestamp: new Date().toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
          };

          setMessages([initialMessage, ...formattedMessages]);
          toast.success(`Restored ${historyMessages.length} previous messages`);
        } else {
          console.log("[AnalystAgent] No history messages found");
        }
      } catch (error) {
        console.error("[AnalystAgent] Error loading history:", error);
        // Don't show error toast, just silently fail
      } finally {
        setIsHistoryLoading(false);
      }
    };

    loadHistory();
  }, []); // Run only once on mount


  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return;

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

    // Add bot message placeholder
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

      // Stream the response using analyst API
      for await (const chunk of streamAnalystMessage(currentMessage)) {
        accumulatedContent += chunk;

        // Update the bot message with accumulated content
        updatedMessages = updatedMessages.map((msg) =>
          msg.id === botMessageId
            ? { ...msg, content: accumulatedContent, isLoading: false, isTyping: false }
            : msg
        );
        setMessages(updatedMessages);
      }

      setIsLoading(false);

      // Get session_id from AnalystSessionManager (it's set by streamAnalystMessage)
      const currentSessionId = AnalystSessionManager.getSessionId();
      if (currentSessionId && currentSessionId !== "none") {
        console.log(`[AnalystAgent] Session ID stored: ${currentSessionId}`);
      }

      // Check for BRD ID in response
      const brdIdMatch = accumulatedContent.match(/BRD ID:\s*([a-f0-9-]+)/i);
      if (brdIdMatch && brdIdMatch[1]) {
        setBrdId(brdIdMatch[1]);
        AnalystSessionManager.setBrdId(brdIdMatch[1]);
      }
    } catch (error) {
      console.error("Chat error:", error);
      setIsLoading(false);

      const withoutLoading = updatedMessages.filter((msg) => msg.id !== botMessageId);
      const errorMessage: ChatMessageType = {
        id: `error-${Date.now()}`,
        content:
          "Sorry, I couldn't process your message right now. Please try again later.",
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

    // If no session ID, try to get it from the most recent message
    if (!sessionId || sessionId === "none") {
      // Check if we have any messages (which means a session was created)
      if (messages.length > 0) {
        // Try to extract session_id from the last bot message
        const lastBotMessage = [...messages].reverse().find(msg => msg.isBot);
        if (lastBotMessage) {
          // The session_id should be in localStorage, but if not, we need to make a call to get it
          // For now, show a helpful error
          toast.error("Session ID not found. Please send another message to establish a session, then try again.");
          return;
        }
      } else {
        toast.error("No active session. Please start a conversation first.");
        return;
      }
    }

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
        AnalystSessionManager.setBrdId(data.brd_id);
        toast.success(`BRD generated successfully! BRD ID: ${data.brd_id}`);

        // Add success message to chat
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

      // Add error message to chat
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

  const handleNewSession = () => {
    if (window.confirm("Are you sure you want to start a new session? This will clear the current conversation.")) {
      AnalystSessionManager.clearSession();
      setMessages([INITIAL_MESSAGE]);
      setBrdId(null);
      setInputValue("");
      toast.success("New session started.");
    }
  };

  const handleBack = () => {
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background">
      <MainLayout currentView="analyst" showBackButton onBack={handleBack}>
        <div className="p-4 sm:p-6 lg:p-8">
          <div className="mb-4 lg:mb-6">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="sm" onClick={handleBack} className="p-2 hover:bg-accent">
                  <ArrowLeft className="w-4 h-4" />
                </Button>
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary" />
                  <h1 className="text-xl font-bold sm:text-2xl">Business Analyst Agent</h1>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={handleGenerateBRD}
                  disabled={isGeneratingBRD || !AnalystSessionManager.getSessionId()}
                  className="flex items-center gap-2"
                  variant="outline"
                >
                  {isGeneratingBRD ? (
                    <>
                      <div className="w-4 h-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      <span className="hidden sm:inline">Generating...</span>
                      <span className="sm:hidden">Generating...</span>
                    </>
                  ) : (
                    <>
                      <FileText className="w-4 h-4" />
                      <span className="hidden sm:inline">Generate BRD</span>
                      <span className="sm:hidden">Generate</span>
                    </>
                  )}
                </Button>
                <Button
                  onClick={handleNewSession}
                  className="flex items-center gap-2"
                  variant="outline"
                  title="Start New Session"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span className="hidden sm:inline">New Session</span>
                </Button>
                {brdId && (
                  <Button onClick={handleDownloadBRD} className="flex items-center gap-2">
                    <Download className="w-4 h-4" />
                    <span className="hidden sm:inline">Download BRD</span>
                    <span className="sm:hidden">Download</span>
                  </Button>
                )}
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-2 ml-11">
              Have a conversation with Mary, your Strategic Business Analyst, to gather requirements and generate a BRD
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 lg:gap-8">
            <div className="lg:col-span-8 lg:col-start-3">
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

                  <div className="flex gap-2 pt-4 border-t">
                    <Input
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      placeholder="Type your message about your project requirements..."
                      onKeyPress={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                      disabled={isLoading}
                      className="flex-1"
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
      </MainLayout>
    </div>
  );
};

export default AnalystAgent;

