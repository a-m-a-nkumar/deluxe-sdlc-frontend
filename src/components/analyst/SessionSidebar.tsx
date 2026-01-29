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
    MoreHorizontal
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ChatSession } from "@/services/analystApi";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface SessionSidebarProps {
    sessions: ChatSession[];
    currentSessionId: string | null;
    onSelectSession: (sessionId: string) => void;
    onNewSession: () => void;
    onDeleteSession: (sessionId: string) => void;
    onRenameSession: (sessionId: string, newTitle: string) => void;
    isCollapsed?: boolean;
    onToggleCollapse?: () => void;
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
                            {sessions.map((session) => (
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
                            ))}
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
                    className="w-full flex items-center gap-2"
                    size="sm"
                >
                    <Plus className="w-4 h-4" />
                    New Chat
                </Button>
            </div>

            {/* Sessions List */}
            <ScrollArea className="flex-1">
                <div className="p-2">
                    {Object.keys(groupedSessions).length === 0 ? (
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
                                            className={cn(
                                                "group relative rounded-lg transition-colors",
                                                currentSessionId === session.id
                                                    ? "bg-accent"
                                                    : "hover:bg-accent/50"
                                            )}
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
                                                <div className="flex items-center gap-2 p-2 rounded-md hover:bg-accent/50 group/session transition-colors">
                                                    <div
                                                        onClick={() => onSelectSession(session.id)}
                                                        className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer"
                                                    >
                                                        <MessageSquare className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
                                                        <div className="flex-1 min-w-0">
                                                            <div className="text-sm font-medium truncate">
                                                                {session.title}
                                                            </div>
                                                            <div className="text-xs text-muted-foreground">
                                                                {session.messageCount} messages
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center flex-shrink-0">
                                                        <DropdownMenu modal={false}>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-8 w-8 text-muted-foreground hover:text-foreground z-10 relative"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        // Force focus to prevent menu closing immediately
                                                                        e.currentTarget.focus();
                                                                    }}
                                                                >
                                                                    <MoreHorizontal className="h-4 w-4" />
                                                                    <span className="sr-only">Menu</span>
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end" className="w-48 z-[100]">
                                                                <DropdownMenuItem
                                                                    className="cursor-pointer"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleStartEdit(session);
                                                                    }}
                                                                >
                                                                    <Edit2 className="mr-2 h-4 w-4" />
                                                                    <span>Rename</span>
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem
                                                                    className="cursor-pointer"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        if (window.confirm(`Delete "${session.title}"?`)) {
                                                                            onDeleteSession(session.id);
                                                                        }
                                                                    }}
                                                                >
                                                                    <Trash2 className="mr-2 h-4 w-4 text-red-500" />
                                                                    <span className="text-red-500">Delete</span>
                                                                </DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
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
        </div>
    );
};
