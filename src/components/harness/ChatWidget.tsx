import { useState, useRef, useEffect } from "react";
import { Bot, X, Send, Loader2, Trash2, Wrench, Minimize2 } from "lucide-react";
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
  "What failed recently?",
  "List executions",
  "Show account info",
];

export default function ChatWidget({ credentials }: Props) {
  const config = buildConfig(credentials.apiKey);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [fullHistory, setFullHistory] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [messages, open, loading]);

  const send = async (text = input.trim()) => {
    if (!text || loading) return;
    setInput("");
    setMessages(prev => [...prev, { role: "user", text }]);
    setLoading(true);
    try {
      const res = await harnessChat(config, credentials.orgId, credentials.projectId, text, fullHistory);
      setFullHistory(res.history);
      setMessages(prev => [...prev, { role: "assistant", text: res.answer, toolCalls: res.tool_calls }]);
    } catch (e: any) {
      setMessages(prev => [...prev, { role: "assistant", text: `Error: ${e.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  const clear = () => { setMessages([]); setFullHistory([]); setInput(""); };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">

      {/* Chat window */}
      {open && (
        <div className="w-80 bg-background border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          style={{ height: "440px" }}>

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-primary text-primary-foreground flex-shrink-0">
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4" />
              <span className="text-sm font-medium">Harness AI</span>
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button onClick={clear} className="p-1 rounded hover:bg-white/20 transition-colors" title="Clear">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
              <button onClick={() => setOpen(false)} className="p-1 rounded hover:bg-white/20 transition-colors">
                <Minimize2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
                <Bot className="w-8 h-8 text-muted-foreground/40" />
                <p className="text-xs text-muted-foreground">Ask anything about your pipelines and deployments</p>
                <div className="flex flex-col gap-1.5 w-full">
                  {SUGGESTIONS.map(s => (
                    <button key={s} onClick={() => send(s)}
                      className="text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-accent transition-colors text-left text-muted-foreground">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`flex flex-col gap-1 ${msg.role === "user" ? "items-end" : "items-start"}`}>
                <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground rounded-tr-sm"
                    : "bg-muted text-foreground rounded-tl-sm"
                }`}>
                  {msg.text}
                </div>
                {msg.role === "assistant" && msg.toolCalls && msg.toolCalls.length > 0 && (
                  <div className="flex flex-wrap gap-1 max-w-[85%]">
                    {msg.toolCalls.map((c, j) => (
                      <span key={j} className="inline-flex items-center gap-1 text-[10px] bg-blue-50 text-blue-600 border border-blue-100 px-1.5 py-0.5 rounded-full">
                        <Wrench className="w-2.5 h-2.5" />
                        {TOOL_LABELS[c.name] || c.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex items-start gap-2">
                <div className="bg-muted rounded-2xl rounded-tl-sm px-3 py-2 flex items-center gap-1.5">
                  <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Thinking...</span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="flex gap-2 p-3 border-t flex-shrink-0">
            <input
              ref={inputRef}
              type="text"
              className="flex-1 border rounded-xl px-3 py-1.5 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="Ask about pipelines..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && send()}
            />
            <button
              onClick={() => send()}
              disabled={!input.trim() || loading}
              className="w-8 h-8 rounded-xl bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40 hover:bg-primary/90 transition-colors flex-shrink-0"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      )}

      {/* Floating button */}
      <button
        onClick={() => setOpen(v => !v)}
        className={`w-13 h-13 rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-105 active:scale-95 ${
          open ? "bg-muted text-foreground border border-border" : "bg-primary text-primary-foreground"
        }`}
        style={{ width: 52, height: 52 }}
        title="Harness AI Chat"
      >
        {open ? <X className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
        {!open && messages.length > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full text-[10px] text-white flex items-center justify-center font-bold">
            {messages.filter(m => m.role === "assistant").length}
          </span>
        )}
      </button>

    </div>
  );
}
