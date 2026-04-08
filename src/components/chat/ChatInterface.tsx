import { useState, useRef, useEffect } from "react";
import { Send, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ChatMessage } from "./ChatMessage";
import { streamChatMessage } from "@/services/chatbotApi";
import { toast } from "sonner";
import { useAppState } from "@/contexts/AppStateContext";
interface ChatMessageType {
  id: string;
  content: string;
  isBot: boolean;
  timestamp: string;
  isTyping?: boolean;
  isLoading?: boolean;
}
interface ChatInterfaceProps {
  title: string;
  subtitle: string;
  initialMessage?: string;
  placeholder?: string;
  onReviewed?: () => void;
  externalMessages?: ChatMessageType[];
  onMessagesChange?: (messages: ChatMessageType[]) => void;
  disabled?: boolean;
  sectionContext?: string;
  selectedSectionTitle?: string;
  selectedSectionNumber?: number | null;
  onSectionChangeRequest?: (sectionNumber: number | string) => void;
  onResponseReceived?: (response: string) => void;
  disableStreamForJira?: boolean;
  brdId?: string | null;
  isRestoringChat?: boolean;
}
export const ChatInterface = ({
  title,
  subtitle,
  initialMessage,
  placeholder = "Type your message about business requirements...",
  onReviewed,
  externalMessages,
  onMessagesChange,
  disabled = false,
  sectionContext,
  selectedSectionTitle,
  selectedSectionNumber,
  onSectionChangeRequest,
  onResponseReceived,
  disableStreamForJira = false,
  brdId = null,
  isRestoringChat = false,
}: ChatInterfaceProps) => {
  const { setIsBRDApproved, brdSections } = useAppState();
  const [internalMessages, setInternalMessages] = useState<ChatMessageType[]>([
    ...(initialMessage
      ? [
          {
            id: "1",
            content: initialMessage,
            isBot: true,
            timestamp: new Date().toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
          },
        ]
      : []),
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hasInitialized = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea as content grows
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [inputValue]);

  // Initialize external messages with initial message if they're empty
  useEffect(() => {
    if (
      !hasInitialized.current &&
      externalMessages !== undefined &&
      externalMessages.length === 0 &&
      initialMessage &&
      onMessagesChange
    ) {
      hasInitialized.current = true;
      onMessagesChange([
        {
          id: "1",
          content: initialMessage,
          isBot: true,
          timestamp: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        },
      ]);
    }
  }, [externalMessages, initialMessage, onMessagesChange]);

  // Use external messages if provided, otherwise use internal state
  const messages = externalMessages || internalMessages;
  const setMessages = onMessagesChange || setInternalMessages;

  // Auto scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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

    // Detect if user is asking to show/view a section (e.g., "show section 9", "show section User Stories")
    const showSectionMatch = currentMessage.match(/show\s+(?:me\s+)?(?:section\s+)?(\d+|[\w\s/]+)/i);
    if (showSectionMatch && onSectionChangeRequest) {
      const sectionIdentifier = showSectionMatch[1].trim();
      // Try to parse as number first
      const sectionNum = parseInt(sectionIdentifier, 10);
      if (!isNaN(sectionNum)) {
        onSectionChangeRequest(sectionNum);
      } else {
        // Otherwise treat as section title/name
        onSectionChangeRequest(sectionIdentifier);
      }
    }

    // Check if message is "approved" and return custom response without API call
    if (currentMessage.trim().toLowerCase() === "approved") {
      const botMessage: ChatMessageType = {
        id: `bot-${Date.now()}`,
        content: "All sections have been approved. You can download the BRD and push it to Confluence.",
        isBot: true,
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };
      setMessages([...currentMessages, userMessage, botMessage]);
      setIsLoading(false);
      setIsBRDApproved(true);
      return;
    }

    // Add bot message placeholder that will be updated with streaming content
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

      // Check if this is a Jira-related query
      const isJiraQuery =
        disableStreamForJira && /jira|issue|ticket|bug|story|epic|assignee|task|sprint|backlog/i.test(currentMessage);

      // Stream the response with appropriate stream setting
      const streamOverride = isJiraQuery ? false : undefined;
      // Pass section context with section number and title so agent knows which section user is referring to
      let enhancedSectionContext = sectionContext;
      if (selectedSectionTitle && sectionContext) {
        const sectionInfo = selectedSectionNumber 
          ? `SECTION ${selectedSectionNumber}: ${selectedSectionTitle}`
          : `SECTION: ${selectedSectionTitle}`;
        enhancedSectionContext = `${sectionInfo}\n\n${sectionContext}`;
      }
      for await (const chunk of streamChatMessage(currentMessage, enhancedSectionContext, streamOverride, brdId)) {
        accumulatedContent += chunk;

        // Update the bot message with accumulated content
        updatedMessages = updatedMessages.map((msg) =>
          msg.id === botMessageId ? { ...msg, content: accumulatedContent, isLoading: false, isTyping: false } : msg,
        );
        setMessages(updatedMessages);
      }

      setIsLoading(false);

      // Call the callback with the complete response
      if (onResponseReceived && accumulatedContent) {
        onResponseReceived(accumulatedContent);
      }

      // Check if the message is "reviewed" and trigger the callback
      if (currentMessage.trim().toLowerCase() === "reviewed" && onReviewed) {
        onReviewed();
      }

      // Check if the message is "approved" and enable BRD actions
      if (currentMessage.trim().toLowerCase() === "approved") {
        setIsBRDApproved(true);
      }
    } catch (error) {
      console.error("Chat error:", error);
      setIsLoading(false);

      // Remove loading message and add error message
      const withoutLoading = updatedMessages.filter((msg) => msg.id !== botMessageId);
      const errorMessage: ChatMessageType = {
        id: `error-${Date.now()}`,
        content:
          "Sorry, I couldn't process your message right now. This might be due to network issues or the API not being publicly accessible. Please try again later.",
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
  return (
    <Card className="h-full flex flex-col overflow-hidden">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <Avatar className="w-8 h-8 bg-primary">
            <AvatarFallback className="bg-primary text-primary-foreground text-xs">AI</AvatarFallback>
          </Avatar>
          <div></div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col min-h-0">
        <div className="flex-1 mb-4 overflow-y-auto max-h-full pr-2 scrollbar-thin-muted">
          {isRestoringChat ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
              <div className="w-6 h-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <p className="text-sm">Restoring previous chat session...</p>
            </div>
          ) : disabled ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <p className="text-sm">Please upload and submit files to enable chat</p>
            </div>
          ) : messages.length === 0 ? (
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

        <div className="flex gap-2 items-end">
          <Textarea
            ref={textareaRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={disabled ? "Upload files to enable chat..." : placeholder}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            disabled={isLoading || disabled}
            rows={1}
            className="flex-1 bg-white min-h-0 resize-none overflow-hidden py-2"
          />
          <Button
            onClick={handleSend}
            size="sm"
            className="px-3"
            disabled={isLoading || !inputValue.trim() || disabled}
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
