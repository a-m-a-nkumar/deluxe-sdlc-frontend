import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useAppState } from '@/contexts/AppStateContext';
import { testGenerationApi } from '@/services/testGenerationApi';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Upload, ExternalLink, ArrowLeft } from 'lucide-react';

const TestScenarioPage = () => {
  const { confluencePageId } = useParams<{ confluencePageId: string }>();
  const navigate = useNavigate();
  const { accessToken } = useAuth();
  const { selectedProject } = useAppState();
  const { toast } = useToast();

  const [isGenerating, setIsGenerating] = useState(true);
  const [isPushing, setIsPushing] = useState(false);
  const [content, setContent] = useState('');
  const [pageTitle, setPageTitle] = useState('');
  const [pushedPageUrl, setPushedPageUrl] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!isGenerating) { setElapsedSeconds(0); return; }
    const interval = setInterval(() => setElapsedSeconds(s => s + 1), 1000);
    return () => clearInterval(interval);
  }, [isGenerating]);

  useEffect(() => {
    if (!confluencePageId || !selectedProject || !accessToken) {
      toast({
        title: 'Missing information',
        description: 'Please select a project and ensure you are logged in.',
        variant: 'destructive',
      });
      navigate('/confluence');
      return;
    }
    generateScenarios();
  }, [confluencePageId, selectedProject, accessToken]);

  const generateScenarios = async () => {
    if (!confluencePageId || !selectedProject || !accessToken) return;
    setIsGenerating(true);
    try {
      const response = await testGenerationApi.generateFromConfluence(
        confluencePageId,
        selectedProject.project_id,
        accessToken
      );
      setContent(response.content);
      setPageTitle(`Test Scenarios - ${response.page_title}`);
    } catch (error: any) {
      toast({
        title: 'Generation failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePushToConfluence = async () => {
    if (!selectedProject || !accessToken) return;
    setIsPushing(true);
    try {
      const response = await testGenerationApi.pushToConfluence(
        selectedProject.project_id,
        pageTitle,
        content,
        accessToken
      );
      setPushedPageUrl(response.web_url);
      toast({
        title: 'Pushed to Confluence!',
        description: `Page "${response.page_title}" created successfully.`,
      });
    } catch (error: any) {
      toast({
        title: 'Push failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsPushing(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="border-b border-[#CCCCCC] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/confluence')}
            className="flex-shrink-0"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
          {!isGenerating && (
            <input
              className="text-base font-semibold bg-transparent border-b border-transparent hover:border-gray-300 focus:border-gray-400 focus:outline-none px-1 flex-1 min-w-0 truncate"
              value={pageTitle}
              onChange={(e) => setPageTitle(e.target.value)}
              title={pageTitle}
            />
          )}
          {isGenerating && (
            <span className="text-base font-semibold text-gray-400">Generating...</span>
          )}
        </div>
        <div className="flex gap-3 flex-shrink-0 ml-4">
          <Button
            onClick={handlePushToConfluence}
            disabled={isGenerating || isPushing || !content}
            style={{ backgroundColor: '#1B3C71', color: '#fff' }}
            onMouseEnter={(e) => {
              if (!isGenerating && !isPushing && content) {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#EDF4FF';
                (e.currentTarget as HTMLButtonElement).style.color = '#1B3C71';
              }
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#1B3C71';
              (e.currentTarget as HTMLButtonElement).style.color = '#fff';
            }}
          >
            {isPushing
              ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              : <Upload className="w-4 h-4 mr-2" />
            }
            <span className="hidden sm:inline">Push to Confluence</span>
            <span className="sm:hidden">Push</span>
          </Button>
          {pushedPageUrl && (
            <Button
              variant="outline"
              onClick={() => window.open(pushedPageUrl, '_blank')}
              style={{ borderColor: '#1B3C71', color: '#1B3C71' }}
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">View in Confluence</span>
              <span className="sm:hidden">View</span>
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        {isGenerating ? (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <Loader2 className="w-10 h-10 animate-spin text-[#1B3C71]" />
            <p className="text-gray-500 text-sm">Generating test scenarios from BRD...</p>
            <p className="text-gray-400 text-xs">
              {elapsedSeconds < 120
                ? 'Please wait 1–2 minutes while we analyse your BRD.'
                : 'Large BRD detected — this is taking longer than usual, please wait...'}
            </p>
          </div>
        ) : (
          <textarea
            className="w-full font-mono text-sm text-gray-800 border border-[#DEDCDC] rounded-lg p-6 focus:outline-none focus:ring-2 focus:ring-[#1B3C71] resize-none leading-relaxed"
            style={{ minHeight: 'calc(100vh - 160px)' }}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Test scenarios will appear here..."
            spellCheck={false}
          />
        )}
      </div>
    </div>
  );
};

export default TestScenarioPage;
