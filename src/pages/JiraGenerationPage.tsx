import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useAppState } from '@/contexts/AppStateContext';
import { jiraGenerationApi, Epic, UserStory } from '@/services/jiraGenerationApi';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ChevronDown, ChevronRight, CheckCircle2, XCircle } from 'lucide-react';
import { BoardSelectionModal } from '@/components/modals/BoardSelectionModal';

export const JiraGenerationPage = () => {
    const { confluencePageId } = useParams<{ confluencePageId: string }>();
    const navigate = useNavigate();
    const { accessToken } = useAuth();
    const { selectedProject } = useAppState();
    const { toast } = useToast();

    const [isLoading, setIsLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [epics, setEpics] = useState<Epic[]>([]);
    const [expandedEpics, setExpandedEpics] = useState<Set<string>>(new Set());
    const [totalEpics, setTotalEpics] = useState(0);
    const [totalStories, setTotalStories] = useState(0);
    const [showBoardModal, setShowBoardModal] = useState(false);

    useEffect(() => {
        if (!confluencePageId || !selectedProject || !accessToken) {
            toast({
                title: 'Missing information',
                description: 'Please select a project and ensure you are logged in.',
                variant: 'destructive',
            });
            navigate('/');
            return;
        }

        generateJiraItems();
    }, [confluencePageId, selectedProject, accessToken]);

    const generateJiraItems = async () => {
        if (!confluencePageId || !selectedProject || !accessToken) return;

        setIsLoading(true);
        try {
            const response = await jiraGenerationApi.generateFromConfluence(
                confluencePageId,
                selectedProject.project_id,
                accessToken
            );

            setEpics(response.epics);
            setTotalEpics(response.total_epics);
            setTotalStories(response.total_stories);

            // Expand all epics by default
            setExpandedEpics(new Set(response.epics.map(e => e.epic_id)));

            toast({
                title: 'Generation complete',
                description: `Generated ${response.total_epics} epics and ${response.total_stories} user stories`,
            });
        } catch (error: any) {
            console.error('Error generating Jira items:', error);
            const raw = error.response?.data?.detail;
            const description = typeof raw === 'string'
                ? raw
                : Array.isArray(raw)
                    ? raw.map((x: any) => x?.msg ?? x).join('. ')
                    : raw?.message || 'Failed to generate Jira items. Please try again.';
            toast({
                title: 'Generation failed',
                description: description || 'Failed to generate Jira items. Please try again.',
                variant: 'destructive',
            });
        } finally {
            setIsLoading(false);
        }
    };

    const toggleEpic = (epicId: string) => {
        const newExpanded = new Set(expandedEpics);
        if (newExpanded.has(epicId)) {
            newExpanded.delete(epicId);
        } else {
            newExpanded.add(epicId);
        }
        setExpandedEpics(newExpanded);
    };

    const toggleStorySelection = (epicId: string, storyId: string) => {
        setEpics(epics.map(epic => {
            if (epic.epic_id === epicId) {
                return {
                    ...epic,
                    user_stories: epic.user_stories.map(story =>
                        story.story_id === storyId
                            ? { ...story, selected: !story.selected }
                            : story
                    )
                };
            }
            return epic;
        }));
    };

    const toggleAllStoriesInEpic = (epicId: string, selected: boolean) => {
        setEpics(epics.map(epic => {
            if (epic.epic_id === epicId) {
                return {
                    ...epic,
                    user_stories: epic.user_stories.map(story => ({ ...story, selected }))
                };
            }
            return epic;
        }));
    };

    const getSelectedCount = () => {
        let count = 0;
        epics.forEach(epic => {
            epic.user_stories.forEach(story => {
                if (story.selected) count++;
            });
        });
        return count;
    };

    const handleCreateInJiraClicked = () => {
        if (!selectedProject || !accessToken) return;

        const selectedCount = getSelectedCount();
        if (selectedCount === 0) {
            toast({
                title: 'No items selected',
                description: 'Please select at least one user story to create in Jira.',
                variant: 'destructive',
            });
            return;
        }

        if (!selectedProject.jira_project_key) {
            toast({
                title: 'Jira project not configured',
                description: 'Please select a Jira project when creating or editing your project in the Project Workspace.',
                variant: 'destructive',
            });
            return;
        }

        setShowBoardModal(true);
    };

    const handleBoardConfirmed = async (boardId: number, boardName: string) => {
        if (!selectedProject || !accessToken) return;

        setShowBoardModal(false);
        setIsCreating(true);

        try {
            const response = await jiraGenerationApi.createInJira(
                selectedProject.project_id,
                selectedProject.jira_project_key,
                epics,
                accessToken,
                boardId || undefined
            );

            const { summary, failed } = response;
            const boardLabel = boardName ? ` on board "${boardName}"` : '';

            if (failed && failed.length > 0) {
                toast({
                    title: 'Partially created',
                    description: `Created ${summary.total_epics_created} epics and ${summary.total_stories_created} stories, but ${summary.total_failed} item(s) failed${boardLabel}. Check console for details.`,
                    variant: 'destructive',
                });
                console.error('[JIRA] Failed items:', failed);
            } else {
                toast({
                    title: 'Jira items created',
                    description: `Created ${summary.total_epics_created} epics and ${summary.total_stories_created} user stories in Jira${boardLabel}.`,
                });
            }

            navigate('/jira', { replace: true });
        } catch (error: any) {
            console.error('Error creating Jira items:', error);
            toast({
                title: 'Creation failed',
                description: error.response?.data?.detail || 'Failed to create items in Jira. Please try again.',
                variant: 'destructive',
            });
        } finally {
            setIsCreating(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-primary" />
                    <h2 className="text-xl font-semibold mb-2">Generating Jira Items...</h2>
                    <p className="text-muted-foreground">
                        AI is analyzing the Confluence page and creating Epics and User Stories
                    </p>
                </div>
            </div>
        );
    }

    const selectedCount = getSelectedCount();

    return (
        <div className="container mx-auto p-6 max-w-7xl">
            <div className="mb-6">
                <h1 className="text-3xl font-bold mb-2">Review Generated Jira Items</h1>
                <p className="text-muted-foreground">
                    Select the Epics and User Stories you want to create in Jira
                </p>
            </div>

            <div className="mb-6 p-4 bg-muted rounded-lg">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm font-medium">
                            Total: {totalEpics} Epics, {totalStories} User Stories
                        </p>
                        <p className="text-sm text-muted-foreground">
                            Selected: {selectedCount} User Stories
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            onClick={() => navigate(-1)}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleCreateInJiraClicked}
                            disabled={isCreating || selectedCount === 0}
                        >
                            {isCreating ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Creating...
                                </>
                            ) : (
                                `Create Selected in Jira (${selectedCount})`
                            )}
                        </Button>
                    </div>
                </div>
            </div>

            <div className="space-y-4">
                {epics.map((epic) => {
                    const isExpanded = expandedEpics.has(epic.epic_id);
                    const selectedInEpic = epic.user_stories.filter(s => s.selected).length;
                    const totalInEpic = epic.user_stories.length;
                    const allSelected = selectedInEpic === totalInEpic;

                    return (
                        <Card key={epic.epic_id}>
                            <CardHeader className="cursor-pointer" onClick={() => toggleEpic(epic.epic_id)}>
                                <div className="flex items-start justify-between">
                                    <div className="flex items-start gap-3 flex-1">
                                        {isExpanded ? (
                                            <ChevronDown className="w-5 h-5 mt-1 flex-shrink-0" />
                                        ) : (
                                            <ChevronRight className="w-5 h-5 mt-1 flex-shrink-0" />
                                        )}
                                        <div className="flex-1">
                                            <CardTitle className="text-lg mb-2">
                                                📋 {epic.title}
                                            </CardTitle>
                                            <p className="text-sm text-muted-foreground mb-2">
                                                {epic.description}
                                            </p>
                                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                                <span>Mapped to: {epic.mapped_to_brd_section}</span>
                                                <span>•</span>
                                                <span>{totalInEpic} User Stories</span>
                                                <span>•</span>
                                                <span>{selectedInEpic} Selected</span>
                                            </div>
                                        </div>
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            toggleAllStoriesInEpic(epic.epic_id, !allSelected);
                                        }}
                                    >
                                        {allSelected ? 'Deselect All' : 'Select All'}
                                    </Button>
                                </div>
                            </CardHeader>

                            {isExpanded && (
                                <CardContent>
                                    <div className="space-y-3">
                                        {epic.user_stories.map((story) => (
                                            <div
                                                key={story.story_id}
                                                className={`p-4 border rounded-lg ${story.selected ? 'bg-primary/5 border-primary' : 'bg-background'
                                                    }`}
                                            >
                                                <div className="flex items-start gap-3">
                                                    <Checkbox
                                                        checked={story.selected}
                                                        onCheckedChange={() => toggleStorySelection(epic.epic_id, story.story_id)}
                                                        className="mt-1"
                                                    />
                                                    <div className="flex-1">
                                                        <h4 className="font-medium mb-2">{story.title}</h4>
                                                        <p className="text-sm text-muted-foreground mb-3">
                                                            {story.description}
                                                        </p>

                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
                                                            <div className="text-xs">
                                                                <span className="font-medium">BRD Requirement:</span>
                                                                <br />
                                                                <span className="text-muted-foreground">{story.mapped_to_requirement}</span>
                                                            </div>
                                                            <div className="text-xs">
                                                                <span className="font-medium">Priority:</span>
                                                                <br />
                                                                <span className={`font-medium ${story.priority === 'High' ? 'text-red-600' :
                                                                        story.priority === 'Medium' ? 'text-yellow-600' :
                                                                            'text-green-600'
                                                                    }`}>
                                                                    {story.priority}
                                                                </span>
                                                            </div>
                                                        </div>

                                                        {story.acceptance_criteria.length > 0 && (
                                                            <div className="text-xs">
                                                                <span className="font-medium">Acceptance Criteria:</span>
                                                                <ul className="list-disc list-inside mt-1 text-muted-foreground">
                                                                    {story.acceptance_criteria.map((criteria, idx) => (
                                                                        <li key={idx}>{criteria}</li>
                                                                    ))}
                                                                </ul>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            )}
                        </Card>
                    );
                })}
            </div>

            {epics.length === 0 && (
                <Card>
                    <CardContent className="p-12 text-center">
                        <XCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                        <h3 className="text-lg font-medium mb-2">No items generated</h3>
                        <p className="text-muted-foreground">
                            The AI couldn't generate any Epics or User Stories from the Confluence page.
                        </p>
                    </CardContent>
                </Card>
            )}

            {selectedProject?.jira_project_key && (
                <BoardSelectionModal
                    open={showBoardModal}
                    onOpenChange={setShowBoardModal}
                    jiraProjectKey={selectedProject.jira_project_key}
                    selectedCount={getSelectedCount()}
                    onConfirm={handleBoardConfirmed}
                />
            )}
        </div>
    );
};

export default JiraGenerationPage;
