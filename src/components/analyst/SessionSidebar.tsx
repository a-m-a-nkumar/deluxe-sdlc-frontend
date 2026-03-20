import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    MessageSquare,
    Plus,
    Trash2,
    Edit2,
    Check,
    X,
    FileText,
    ChevronLeft,
    ChevronRight,
    Download,
    Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ChatSession } from "@/services/analystApi";

interface SessionSidebarProps {
    sessions: ChatSession[];
    currentSessionId: string | null;
    onSelectSession: (sessionId: string) => void;
    onNewSession: () => void;
    onDeleteSession: (sessionId: string) => void;
    onRenameSession: (sessionId: string, newTitle: string) => void;
    isCollapsed?: boolean;
    onToggleCollapse?: () => void;
    isLoading?: boolean;
    // BRD action props
    brdId?: string | null;
    isGeneratingBRD?: boolean;
    onGenerateBRD?: () => void;
    onDownloadBRD?: () => void;
    onPushToConfluence?: () => void;
    isPushingToConfluence?: boolean;
}

export const SessionSidebar = ({
    sessions,
    currentSessionId,
    onSelectSession,
    onNewSession,
    onDeleteSession,
    onRenameSession,
    isCollapsed = false,
    onToggleCollapse,
    isLoading = false,
    brdId,
    isGeneratingBRD = false,
    onGenerateBRD,
    onDownloadBRD,
    onPushToConfluence,
    isPushingToConfluence = false,
}: SessionSidebarProps) => {
    const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
    const [editTitle, setEditTitle] = useState("");

    const handleStartEdit = (session: ChatSession) => {
        setEditingSessionId(session.id);
        setEditTitle(session.title);
    };

    const handleSaveEdit = (sessionId: string) => {
        if (editTitle.trim()) {
            onRenameSession(sessionId, editTitle.trim());
        }
        setEditingSessionId(null);
        setEditTitle("");
    };

    const handleCancelEdit = () => {
        setEditingSessionId(null);
        setEditTitle("");
    };

    const formatDate = (timestamp: number) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

        if (diffInDays === 0) {
            return "Today";
        } else if (diffInDays === 1) {
            return "Yesterday";
        } else if (diffInDays < 7) {
            return `${diffInDays} days ago`;
        } else {
            return date.toLocaleDateString();
        }
    };

    // Group sessions by date
    const groupedSessions = sessions.reduce((acc, session) => {
        const dateLabel = formatDate(session.lastUpdated);
        if (!acc[dateLabel]) {
            acc[dateLabel] = [];
        }
        acc[dateLabel].push(session);
        return acc;
    }, {} as Record<string, ChatSession[]>);

    if (isCollapsed) {
        return (
            <div className="w-16 bg-card border-r flex flex-col items-center py-4 gap-4">
                <Button
                    onClick={onNewSession}
                    size="icon"
                    variant="ghost"
                    className="w-10 h-10"
                    title="New Chat"
                >
                    <Plus className="w-5 h-5" />
                </Button>

                <div className="flex-1 w-full overflow-hidden">
                    <ScrollArea className="h-full">
                        <div className="flex flex-col gap-2 px-2">
                            {isLoading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <div key={i} className="w-10 h-10 rounded-md bg-muted animate-pulse" />
                                ))
                            ) : (
                                sessions.map((session) => (
                                    <Button
                                        key={session.id}
                                        onClick={() => onSelectSession(session.id)}
                                        size="icon"
                                        variant={currentSessionId === session.id ? "secondary" : "ghost"}
                                        className={cn(
                                            "w-10 h-10 relative",
                                            currentSessionId === session.id && "bg-accent"
                                        )}
                                        title={session.title}
                                    >
                                        <MessageSquare className="w-4 h-4" />
                                        {session.brdId && (
                                            <div className="absolute -top-1 -right-1 w-3 h-3 bg-primary rounded-full" />
                                        )}
                                    </Button>
                                ))
                            )}
                        </div>
                    </ScrollArea>
                </div>

                {onToggleCollapse && (
                    <Button
                        onClick={onToggleCollapse}
                        size="icon"
                        variant="ghost"
                        className="w-10 h-10"
                        title="Expand Sidebar"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </Button>
                )}
            </div>
        );
    }

    return (
        <div className="w-80 bg-card border-r flex flex-col h-full">
            {/* Header */}
            <div className="p-4 border-b">
                <div className="flex items-center justify-between mb-3">
                    <h2 className="font-semibold text-sm">Chat Sessions</h2>
                    {onToggleCollapse && (
                        <Button
                            onClick={onToggleCollapse}
                            size="icon"
                            variant="ghost"
                            className="w-8 h-8"
                            title="Collapse Sidebar"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </Button>
                    )}
                </div>
                <Button
                    onClick={onNewSession}
                    className="w-full flex items-center gap-2 text-white hover:opacity-90"
                    style={{ backgroundColor: '#D61120', padding: '20px 16px' }}
                >
                    <Plus className="w-4 h-4" />
                    New Chat
                </Button>
            </div>

            {/* Sessions List - Scrollable */}
            <ScrollArea className="flex-1 min-h-0">
                <div className="p-2">
                    {isLoading ? (
                        <div className="space-y-4 p-2">
                            {Array.from({ length: 4 }).map((_, i) => (
                                <div key={i} className="flex flex-col gap-2">
                                    <div className="h-4 w-16 bg-muted rounded animate-pulse" />
                                    <div className="h-14 w-full bg-muted rounded-md animate-pulse" />
                                </div>
                            ))}
                        </div>
                    ) : Object.keys(groupedSessions).length === 0 ? (
                        <div className="text-center py-8 text-sm text-muted-foreground">
                            No chat sessions yet
                        </div>
                    ) : (
                        Object.entries(groupedSessions).map(([dateLabel, dateSessions]) => (
                            <div key={dateLabel} className="mb-4">
                                <div className="px-3 py-2 text-xs font-semibold text-muted-foreground">
                                    {dateLabel}
                                </div>
                                <div className="space-y-1">
                                    {dateSessions.map((session) => (
                                        <div
                                            key={session.id}
                                            className="group relative rounded-lg transition-colors"
                                        >
                                            {editingSessionId === session.id ? (
                                                <div className="flex items-center gap-1 p-2">
                                                    <input
                                                        type="text"
                                                        value={editTitle}
                                                        onChange={(e) => setEditTitle(e.target.value)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === "Enter") {
                                                                handleSaveEdit(session.id);
                                                            } else if (e.key === "Escape") {
                                                                handleCancelEdit();
                                                            }
                                                        }}
                                                        className="flex-1 px-2 py-1 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-primary"
                                                        autoFocus
                                                    />
                                                    <Button
                                                        onClick={() => handleSaveEdit(session.id)}
                                                        size="icon"
                                                        variant="outline"
                                                        className="w-8 h-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                                                        title="Save"
                                                    >
                                                        <Check className="w-4 h-4" />
                                                    </Button>
                                                    <Button
                                                        onClick={handleCancelEdit}
                                                        size="icon"
                                                        variant="outline"
                                                        className="w-8 h-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                                                        title="Cancel"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            ) : (
                                                <div
                                                    className="flex items-center gap-2 rounded-md group/session transition-colors overflow-hidden"
                                                    style={{ backgroundColor: currentSessionId === session.id ? '#FDEDEF' : '#f6f6f6', padding: '16px' }}
                                                    onMouseEnter={e => { if (currentSessionId !== session.id) e.currentTarget.style.backgroundColor = '#eeeeee'; }}
                                                    onMouseLeave={e => { if (currentSessionId !== session.id) e.currentTarget.style.backgroundColor = '#f6f6f6'; }}
                                                >
                                                    <div
                                                        onClick={() => onSelectSession(session.id)}
                                                        className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer"
                                                    >
                                                        <MessageSquare className="w-4 h-4 flex-shrink-0" style={{ color: '#6b7280' }} />
                                                        <div className="flex-1 min-w-0">
                                                            <div className="text-sm font-medium whitespace-nowrap" style={{ color: '#111827' }}>
                                                                {session.title.length > 25 ? session.title.slice(0, 25) + '...' : session.title}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover/session:opacity-100 transition-opacity">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-7 w-7 hover:text-foreground"
                                                            style={{ color: '#6b7280' }}
                                                            title="Rename"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleStartEdit(session);
                                                            }}
                                                        >
                                                            <Edit2 className="h-3.5 w-3.5" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-7 w-7 hover:text-red-600"
                                                            style={{ color: '#6b7280' }}
                                                            title="Delete"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                if (window.confirm(`Delete "${session.title}"?`)) {
                                                                    onDeleteSession(session.id);
                                                                }
                                                            }}
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </ScrollArea>

            {/* BRD Action Buttons - Fixed at bottom */}
            <div className="border-t p-3 space-y-2">
                <div className="flex gap-2">
                    <button
                        onClick={onGenerateBRD}
                        disabled={isGeneratingBRD || !currentSessionId}
                        className="flex-1 flex items-center justify-center gap-2 text-xs font-medium rounded-md transition-colors disabled:opacity-50 disabled:pointer-events-none"
                        style={{ backgroundColor: '#FBE7E9', color: '#D61120', border: 'none', padding: '10px 16px' }}
                        onMouseEnter={e => { if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = '#F5CDD1'; }}
                        onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#FBE7E9'; }}
                    >
                        {isGeneratingBRD ? (
                            <>
                                <div className="w-4 h-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                Generating...
                            </>
                        ) : (
                            <>
                                <FileText className="w-4 h-4" />
                                Generate BRD
                            </>
                        )}
                    </button>
                    {brdId && (
                        <button
                            onClick={onDownloadBRD}
                            className="flex-1 flex items-center justify-center gap-2 text-xs font-medium rounded-md transition-colors"
                            style={{ backgroundColor: '#FBE7E9', color: '#D61120', border: 'none', padding: '10px 16px' }}
                            onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#F5CDD1'; }}
                            onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#FBE7E9'; }}
                        >
                            <Download className="w-4 h-4" />
                            Download BRD
                        </button>
                    )}
                </div>
                {brdId && (
                    <Button
                        onClick={onPushToConfluence}
                        disabled={isPushingToConfluence}
                        className="w-full flex items-center justify-center gap-2 text-xs text-white hover:opacity-90"
                        style={{ backgroundColor: '#D61120', padding: '20px 16px' }}
                    >
                        {isPushingToConfluence ? (
                            <>
                                <div className="w-4 h-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                Pushing...
                            </>
                        ) : (
                            <>
                                <Upload className="w-4 h-4" />
                                Push to Confluence
                            </>
                        )}
                    </Button>
                )}
            </div>
        </div>
    );
};
