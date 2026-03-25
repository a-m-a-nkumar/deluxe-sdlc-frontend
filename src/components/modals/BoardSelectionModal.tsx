import { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Loader2, LayoutGrid } from 'lucide-react';
import { integrationsApi, type JiraBoard } from '@/services/integrationsApi';
import { useAuth } from '@/contexts/AuthContext';

interface BoardSelectionModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    jiraProjectKey: string;
    selectedCount: number;
    onConfirm: (boardId: number, boardName: string) => void;
}

export const BoardSelectionModal = ({
    open,
    onOpenChange,
    jiraProjectKey,
    selectedCount,
    onConfirm,
}: BoardSelectionModalProps) => {
    const { accessToken } = useAuth();
    const [boards, setBoards] = useState<JiraBoard[]>([]);
    const [selectedBoardId, setSelectedBoardId] = useState<string>('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (open && jiraProjectKey && accessToken) {
            fetchBoards();
        }
    }, [open, jiraProjectKey, accessToken]);

    const fetchBoards = async () => {
        if (!accessToken) return;
        setIsLoading(true);
        setError(null);
        setSelectedBoardId('');
        try {
            const boardList = await integrationsApi.getJiraBoards(jiraProjectKey, accessToken);
            setBoards(boardList);
            if (boardList.length === 1) {
                setSelectedBoardId(String(boardList[0].id));
            }
        } catch (err: any) {
            console.error('Error fetching boards:', err);
            setError(
                err.response?.data?.detail || 'Failed to fetch Jira boards. Please try again.'
            );
        } finally {
            setIsLoading(false);
        }
    };

    const handleConfirm = () => {
        const board = boards.find((b) => String(b.id) === selectedBoardId);
        if (board) {
            onConfirm(board.id, board.name);
        }
    };

    const getBoardTypeLabel = (type: string) => {
        switch (type) {
            case 'scrum': return 'Scrum';
            case 'kanban': return 'Kanban';
            case 'simple': return 'Simple';
            default: return type;
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[420px] bg-white">
                <div>
                    <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
                        <LayoutGrid className="w-5 h-5" style={{ color: '#D61120' }} />
                        Select Jira Board
                    </DialogTitle>
                    <DialogDescription className="mt-1 text-sm text-muted-foreground">
                        Choose which board to push {selectedCount} selected {selectedCount === 1 ? 'story' : 'stories'} to
                        in project <span className="font-semibold">{jiraProjectKey}</span>
                    </DialogDescription>
                </div>

                <div className="py-4">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#D61120' }} />
                            <span className="ml-3 text-sm text-muted-foreground">Fetching boards...</span>
                        </div>
                    ) : error ? (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                            <p className="text-sm text-red-800">{error}</p>
                            <Button variant="outline" size="sm" className="mt-2" onClick={fetchBoards}>
                                Retry
                            </Button>
                        </div>
                    ) : boards.length === 0 ? (
                        <div className="text-center py-6 text-sm text-muted-foreground">
                            No boards found for project {jiraProjectKey}.
                            Stories will be created in the project without board association.
                        </div>
                    ) : (
                        <Select onValueChange={setSelectedBoardId} value={selectedBoardId}>
                            <SelectTrigger className="bg-white border-border h-10">
                                <SelectValue placeholder="Select a board..." />
                            </SelectTrigger>
                            <SelectContent className="bg-white">
                                {boards.map((board) => (
                                    <SelectItem key={board.id} value={String(board.id)} className="text-sm">
                                        {board.name} ({getBoardTypeLabel(board.type)})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                </div>

                <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    {boards.length === 0 && !isLoading && !error ? (
                        <Button
                            onClick={() => onConfirm(0, '')}
                            style={{ backgroundColor: '#D61120' }}
                            className="text-white hover:opacity-90"
                        >
                            Continue Without Board
                        </Button>
                    ) : (
                        <Button
                            onClick={handleConfirm}
                            disabled={!selectedBoardId || isLoading}
                            style={{ backgroundColor: '#D61120' }}
                            className="text-white hover:opacity-90"
                        >
                            Create in Jira
                        </Button>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};
