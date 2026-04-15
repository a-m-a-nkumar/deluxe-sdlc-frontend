import { useState, useRef, useEffect, useCallback } from "react";
import { Send, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { streamOrchestrationQuery, triggerIncrementalSync, getSyncStatus, type Source } from "@/services/orchestrationApi";
import { toast } from "sonner";
import { useAppState } from "@/contexts/AppStateContext";

interface Message {
    id: string;
    content: string;
    isBot: boolean;
    timestamp: string;
    sources?: Source[];
    isLoading?: boolean;
}

export const OrchestrationChat = () => {
    const { selectedProject, isSyncInProgress, setIsSyncInProgress, syncMessage, setSyncMessage } = useAppState();
    const [messages, setMessages] = useState<Message[]>([
        {
            id: "1",
            content: "Hello! 👋 I'm your Veluxe Assistant powered by your project's Confluence and Jira documentation.\n\nI can help you with:\n- Understanding your project documentation\n- Finding information from Confluence pages\n- Searching through Jira issues\n- Answering questions about your workflows\n\nWhat would you like to know?",
            isBot: true,
            timestamp: new Date().toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
            }),
        },
    ]);
    const [inputValue, setInputValue] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Auto-resize textarea as content grows
    useEffect(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = "auto";
        el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
    }, [inputValue]);

    // Poll sync status when a project is selected
    const pollSyncStatus = useCallback(async () => {
        if (!selectedProject?.id) return;
        try {
            const status = await getSyncStatus(selectedProject.id);
            if (status) {
                setIsSyncInProgress(status.is_syncing);
                setSyncMessage(status.sync_message || "");
            }
        } catch {
            // Silently ignore polling errors
        }
    }, [selectedProject?.id, setIsSyncInProgress, setSyncMessage]);

    // Start/stop polling based on project selection
    useEffect(() => {
        // Clear any existing interval
        if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
        }

        if (selectedProject?.id) {
            // Poll once on project select to get initial status
            pollSyncStatus();
            // Only poll every 5s while a sync is actively running
            pollIntervalRef.current = setInterval(() => {
                if (isSyncInProgress || isSyncing) {
                    pollSyncStatus();
                }
            }, 5000);
        } else {
            setIsSyncInProgress(false);
            setSyncMessage("");
        }

        return () => {
            if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
                pollIntervalRef.current = null;
            }
        };
    }, [selectedProject?.id, pollSyncStatus, isSyncInProgress, isSyncing, setIsSyncInProgress, setSyncMessage]);

    // Auto scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleSync = async () => {
        if (!selectedProject?.id) {
            toast.error("No project selected");
            return;
        }

        setIsSyncing(true);
        try {
            const result = await triggerIncrementalSync(selectedProject.id);
            if (result.success) {
                toast.success("Sync started! Only changed documents will be updated.");
            } else {
                toast.error(result.message);
            }
        } catch (error) {
            toast.error("Failed to start sync");
        } finally {
            setIsSyncing(false);
        }
    };

    const handleSend = async () => {
        if (!inputValue.trim() || isLoading) return;

        if (!selectedProject?.id) {
            toast.error("Please select a project first");
            return;
        }

        const userMessage: Message = {
            id: Date.now().toString(),
            content: inputValue,
            isBot: false,
            timestamp: new Date().toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
            }),
        };

        const currentQuery = inputValue;
        setMessages((prev) => [...prev, userMessage]);
        setInputValue("");
        setIsLoading(true);

        // Add bot message placeholder
        const botMessageId = `bot-${Date.now()}`;
        const botMessage: Message = {
            id: botMessageId,
            content: "",
            isBot: true,
            timestamp: new Date().toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
            }),
            isLoading: true,
        };
        setMessages((prev) => [...prev, botMessage]);

        try {
            let accumulatedContent = "";
            let sources: Source[] = [];

            // Stream RAG response
            for await (const event of streamOrchestrationQuery({
                project_id: selectedProject.id,
                query: currentQuery,
                max_chunks: 10,
                include_context: true,
            })) {
                if (event.type === "chunk" && event.content) {
                    accumulatedContent += event.content;

                    // Update message in real-time
                    setMessages((prev) =>
                        prev.map((msg) =>
                            msg.id === botMessageId
                                ? { ...msg, content: accumulatedContent, isLoading: false }
                                : msg
                        )
                    );
                } else if (event.type === "sources" && event.sources) {
                    sources = event.sources;

                    // Add sources to message
                    setMessages((prev) =>
                        prev.map((msg) =>
                            msg.id === botMessageId ? { ...msg, sources } : msg
                        )
                    );
                } else if (event.type === "error") {
                    toast.error(event.message || "An error occurred");
                    setMessages((prev) =>
                        prev.map((msg) =>
                            msg.id === botMessageId
                                ? {
                                    ...msg,
                                    content: `Sorry, I encountered an error: ${event.message}`,
                                    isLoading: false,
                                }
                                : msg
                        )
                    );
                }
            }

            setIsLoading(false);
        } catch (error) {
            console.error("Query error:", error);
            setIsLoading(false);

            setMessages((prev) =>
                prev.map((msg) =>
                    msg.id === botMessageId
                        ? {
                            ...msg,
                            content:
                                "Sorry, I couldn't process your question. Please try again.",
                            isLoading: false,
                        }
                        : msg
                )
            );

            toast.error("Failed to get response");
        }
    };

    return (
        <Card className="h-full flex flex-col overflow-hidden">
            <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Avatar className="w-8 h-8 bg-primary">
                            <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                                AI
                            </AvatarFallback>
                        </Avatar>
                        <div>
                            <h3 className="text-sm font-semibold">RAG Assistant</h3>
                            <p className="text-xs text-muted-foreground">
                                Powered by your documentation
                            </p>
                        </div>
                    </div>
                    <Button
                        onClick={handleSync}
                        disabled={isSyncing || !selectedProject}
                        size="sm"
                        variant="outline"
                        className="gap-2"
                    >
                        <RefreshCw className={`w-4 h-4 ${isSyncing ? "animate-spin" : ""}`} />
                        {isSyncing ? "Syncing..." : "Sync Docs"}
                    </Button>
                </div>
            </CardHeader>

            <CardContent className="flex-1 flex flex-col min-h-0">
                <div className="flex-1 mb-4 overflow-y-auto max-h-full pr-2 scrollbar-thin-muted">
                    <div className="space-y-4">
                        {messages.map((message) => (
                            <div
                                key={message.id}
                                className={`flex ${message.isBot ? "justify-start" : "justify-end"} mb-4`}
                            >
                                <div className={`flex ${message.isBot ? "flex-row" : "flex-row-reverse"} items-start gap-2 max-w-[80%]`}>
                                    {message.isBot ? (
                                        <Avatar className="w-8 h-8 mt-5 flex-shrink-0 bg-primary-light">
                                            <AvatarFallback className="text-xs font-semibold bg-primary-light text-primary">
                                                AI
                                            </AvatarFallback>
                                        </Avatar>
                                    ) : (
                                        <Avatar className="w-8 h-8 mt-5 flex-shrink-0 bg-muted">
                                            <AvatarFallback className="bg-muted text-muted-foreground text-xs">
                                                You
                                            </AvatarFallback>
                                        </Avatar>
                                    )}
                                    <div className="space-y-1">
                                        <div className={`text-xs text-muted-foreground px-1 ${message.isBot ? "text-left" : "text-right"}`}>
                                            {message.isBot ? "RAG Assistant" : "You"} &nbsp; {message.timestamp}
                                        </div>
                                        <div
                                            className={`px-4 py-3 rounded-2xl ${message.isBot ? "rounded-bl-md bg-[#F0F0F0] text-[#1a1a1a]" : "rounded-br-md bg-[#1a1a2e] text-white"}`}
                                        >
                                            {message.isLoading ? (
                                                <span className="inline-flex gap-1 align-middle items-center h-4">
                                                    <span className="inline-block w-2 h-2 bg-current rounded-full animate-bounce" />
                                                    <span className="inline-block w-2 h-2 bg-current rounded-full animate-bounce anim-delay-200" />
                                                    <span className="inline-block w-2 h-2 bg-current rounded-full animate-bounce anim-delay-400" />
                                                </span>
                                            ) : (
                                                <>
                                                    <div className="text-sm whitespace-pre-wrap break-words">
                                                        {message.content}
                                                    </div>
                                                    {message.sources && message.sources.length > 0 && (
                                                        <div className="mt-3 pt-3 border-t border-border/50">
                                                            <p className="text-xs font-semibold mb-2">Sources:</p>
                                                            <div className="space-y-1">
                                                                {message.sources.map((source, idx) => (
                                                                    <a
                                                                        key={idx}
                                                                        href={source.url}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className={`block text-xs hover:underline ${message.isBot ? 'text-blue-600' : 'text-blue-300'}`}
                                                                    >
                                                                        [{source.type}] {source.title} (
                                                                        {(source.similarity * 100).toFixed(0)}% match)
                                                                    </a>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                        <div ref={messagesEndRef} />
                    </div>
                </div>

                {isSyncInProgress && (
                    <div className="flex items-center gap-2 px-3 py-2 mb-2 rounded-md bg-amber-50 border border-amber-200 text-amber-700 text-sm">
                        <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
                        <span className="truncate">
                            {syncMessage || "Syncing your knowledge base..."}
                        </span>
                    </div>
                )}

                <div className="flex gap-2 items-end">
                    <Textarea
                        ref={textareaRef}
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        placeholder={
                            isSyncInProgress
                                ? "Knowledge base is syncing — you can still ask questions..."
                                : selectedProject
                                    ? "Ask about your project documentation..."
                                    : "Select a project to start..."
                        }
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                handleSend();
                            }
                        }}
                        disabled={isLoading || !selectedProject}
                        rows={1}
                        className="flex-1 bg-white min-h-0 resize-none overflow-hidden py-2"
                    />
                    <Button
                        onClick={handleSend}
                        size="sm"
                        className="px-3"
                        disabled={isLoading || !inputValue.trim() || !selectedProject}
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
    );
};
