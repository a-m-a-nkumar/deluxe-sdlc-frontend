import { useState, useRef, useEffect } from "react";
import { Loader2, Send, Trash2, Bot, User, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildConfig, harnessChat, type HarnessCredentials, type ChatToolCall } from "@/services/harnessApi";

interface Props {
  credentials: HarnessCredentials;
}

interface DisplayMessage {
  role: "user" | "assistant";
  text: string;
  toolCalls?: ChatToolCall[];
}

const TOOL_LABELS: Record<string, string> = {
  get_account_info:    "Fetching account info",
  list_organizations:  "Listing organizations",
  list_projects:       "Listing projects",
  list_pipelines:      "Listing pipelines",
  list_executions:     "Listing executions",
  get_pipeline_detail: "Fetching pipeline details",
  get_execution_logs:  "Fetching execution logs",
  trigger_pipeline:    "Triggering pipeline",
};

const SUGGESTIONS = [
  "Show all pipelines",
  "What failed in the last execution?",
  "List recent deployments",
  "Show my account info",
  "Which pipelines failed recently?",
  "Trigger the frontend pipeline on main",
];

function ToolCallBadge({ calls }: { calls: ChatToolCall[] }) {
  if (!calls.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {calls.map((c, i) => (
        <span key={i} className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-600 border border-blue-100 px-2 py-0.5 rounded-full">
          <Wrench className="w-3 h-3" />
          {TOOL_LABELS[c.name] || c.name}
        </span>
      ))}
    </div>
  );
}

function MessageBubble({ msg }: { msg: DisplayMessage }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${isUser ? "bg-primary" : "bg-muted"}`}>
        {isUser
          ? <User className="w-3.5 h-3.5 text-primary-foreground" />
          : <Bot className="w-3.5 h-3.5 text-muted-foreground" />
        }
      </div>
      <div className={`max-w-[78%] ${isUser ? "items-end" : "items-start"} flex flex-col`}>
        <div className={`px-4 py-2.5 rounded-2xl text-sm whitespace-pre-wrap leading-relaxed ${
          isUser
            ? "bg-primary text-primary-foreground rounded-tr-sm"
            : "bg-muted text-foreground rounded-tl-sm"
        }`}>
          {msg.text}
        </div>
        {!isUser && msg.toolCalls && <ToolCallBadge calls={msg.toolCalls} />}
      </div>
    </div>
  );
}

export default function ChatSection({ credentials }: Props) {
  const config = buildConfig(credentials.apiKey);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [fullHistory, setFullHistory] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const send = async (text = input.trim()) => {
    if (!text || loading) return;
    setInput("");
    const userMsg: DisplayMessage = { role: "user", text };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const res = await harnessChat(config, credentials.orgId, credentials.projectId, text, fullHistory);
      setFullHistory(res.history);
      setMessages(prev => [...prev, { role: "assistant", text: res.answer, toolCalls: res.tool_calls }]);
    } catch (e: any) {
      setMessages(prev => [...prev, { role: "assistant", text: `Error: ${e.message}` }]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const clear = () => {
    setMessages([]);
    setFullHistory([]);
    setInput("");
  };

  return (
    <div className="flex flex-col h-full" style={{ minHeight: "calc(100vh - 130px)" }}>
      {/* Header */}
      <div className="px-6 py-4 border-b border-border flex items-center justify-between flex-shrink-0">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Bot className="w-5 h-5 text-primary" /> Harness AI Chat
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Ask anything about your pipelines, deployments, and executions in natural language.
          </p>
        </div>
        {messages.length > 0 && (
          <Button variant="ghost" size="sm" onClick={clear} className="text-muted-foreground">
            <Trash2 className="w-3.5 h-3.5 mr-1" /> Clear
          </Button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-4 pt-8">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
              <Bot className="w-7 h-7 text-primary" />
            </div>
            <div>
              <p className="font-medium text-sm">Ask me anything about your Harness account</p>
              <p className="text-xs text-muted-foreground mt-1">I can list pipelines, check executions, analyze failures, and trigger runs.</p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center max-w-lg mt-2">
              {SUGGESTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="text-xs px-3 py-1.5 rounded-full border border-border hover:bg-accent hover:border-primary/30 transition-colors text-muted-foreground"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <MessageBubble key={i} msg={msg} />
        ))}

        {loading && (
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
              <Bot className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
            <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Thinking...</span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-6 py-4 border-t border-border flex-shrink-0">
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            rows={1}
            className="flex-1 resize-none border rounded-xl px-4 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 max-h-32 leading-relaxed"
            placeholder="Ask about your pipelines, executions, failures..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            style={{ minHeight: "42px" }}
          />
          <Button
            size="sm"
            className="h-[42px] px-4 rounded-xl"
            onClick={() => send()}
            disabled={!input.trim() || loading}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-1.5">Press Enter to send · Shift+Enter for new line</p>
      </div>
    </div>
  );
}
