import { useState, useRef, useEffect } from "react";
import { Send, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { streamOrchestrationQuery, triggerIncrementalSync, type Source } from "@/services/orchestrationApi";
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
    const { selectedProject } = useAppState();
    const [messages, setMessages] = useState<Message[]>([
        {
            id: "1",
            content: "Hello! 👋 I'm your SDLC Orchestration Assistant powered by your project's Confluence and Jira documentation.\n\nI can help you with:\n- Understanding your project documentation\n- Finding information from Confluence pages\n- Searching through Jira issues\n- Answering questions about your workflows\n\nWhat would you like to know?",
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
                <div
                    className="flex-1 mb-4 overflow-y-auto max-h-full pr-2"
                    style={{
                        scrollbarWidth: "thin",
                        scrollbarColor: "#cbd5e1 transparent",
                    }}
                >
                    <div className="space-y-4">
                        {messages.map((message) => (
                            <div
                                key={message.id}
                                className={`flex ${message.isBot ? "justify-start" : "justify-end"}`}
                            >
                                <div
                                    className={`max-w-[80%] rounded-lg p-3 ${message.isBot
                                        ? "bg-muted"
                                        : "bg-primary text-primary-foreground"
                                        }`}
                                >
                                    {message.isLoading ? (
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 bg-current rounded-full animate-bounce" />
                                            <div className="w-2 h-2 bg-current rounded-full animate-bounce delay-100" />
                                            <div className="w-2 h-2 bg-current rounded-full animate-bounce delay-200" />
                                        </div>
                                    ) : (
                                        <>
                                            <div className="text-sm whitespace-pre-wrap">
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
                                                                className="block text-xs hover:underline text-blue-600 dark:text-blue-400"
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
                                    <p className="text-xs text-muted-foreground mt-2">
                                        {message.timestamp}
                                    </p>
                                </div>
                            </div>
                        ))}
                        <div ref={messagesEndRef} />
                    </div>
                </div>

                <div className="flex gap-2">
                    <Input
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        placeholder={
                            selectedProject
                                ? "Ask about your project documentation..."
                                : "Select a project to start..."
                        }
                        onKeyPress={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                        disabled={isLoading || !selectedProject}
                        className="flex-1"
                        style={{ backgroundColor: "#fff" }}
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
