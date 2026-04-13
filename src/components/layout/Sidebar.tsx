import { useState, useEffect } from "react";
import {
  FileText,
  BookOpen,
  Ticket,
  Palette,
  HelpCircle,
  ChevronLeft,
  X,
  Code2,
  FlaskConical,
  Workflow,
  Loader2,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { THEME } from "@/config/theme";
import { useAuth } from "@/contexts/AuthContext";
import { apiGet } from "@/services/api";

const navigationItems = [
  {
    icon: FileText,
    label: "BRD Assistant",
    description: "Create & manage BRDs",
    id: "brd",
    path: "/brd-assistant",
  },
  {
    icon: BookOpen,
    label: "Confluence",
    description: "Browse & integrate docs",
    id: "confluence",
    path: "/confluence",
  },
  {
    icon: Ticket,
    label: "Jira",
    description: "Project tracking & issues",
    id: "jira",
    path: "/jira",
  },
  {
    icon: Palette,
    label: "Design Assistant",
    description: "Technical architecture planning",
    id: "design",
    path: "/design-assistant",
  },
  {
    icon: Code2,
    label: "Pair Programming",
    description: "MCP setup & IDE integration",
    id: "pair-programming",
    path: "/pair-programming",
  },
  {
    icon: FlaskConical,
    label: "Testing",
    description: "Test scenarios & Katalon pipeline",
    id: "testing",
    path: "/testing",
  },
  {
    icon: Workflow,
    label: "DevOps",
    description: "Pipelines, deployments & logs",
    id: "harness",
    path: "/harness",
  },
];


interface SidebarProps {
  showBackButton?: boolean;
  onBack?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  currentView?: string;
  isMobile?: boolean;
  onMobileClose?: () => void;
}

export const Sidebar = ({ showBackButton, onBack, collapsed, onToggleCollapse, currentView, isMobile, onMobileClose }: SidebarProps) => {
  const navigate = useNavigate();
  const { hasModuleAccess } = useAuth();
  const [supportOpen, setSupportOpen] = useState(false);
  const [supportHtml, setSupportHtml] = useState("");
  const [supportLoading, setSupportLoading] = useState(false);
  const [pendingScroll, setPendingScroll] = useState<string | null>(null);

  // Filter navigation items based on user's group memberships
  const visibleItems = navigationItems.filter((item) => hasModuleAccess(item.id));

  // Map current page to heading text to search for in the user guide
  const MODULE_HEADING_MAP: Record<string, string> = {
    overview: "Veluxe Home Page",
    brd: "BRD Generation Module",
    analyst: "BRD Generation by conversing with AI",
    confluence: "Planning Module",
    jira: "Planning Module",
    design: "Planning Module",
    "pair-programming": "Pair Programming Module",
    testing: "Pair Programming Module",
  };

  // Scroll to the matching heading after HTML renders (retry up to 5 times)
  useEffect(() => {
    if (!pendingScroll || supportLoading || !supportHtml) return;
    let attempts = 0;
    const tryScroll = () => {
      const container = document.getElementById("support-guide-scroll");
      if (!container) {
        if (attempts < 5) { attempts++; setTimeout(tryScroll, 300); }
        return;
      }
      const headings = container.querySelectorAll("h1, h2, h3, h4");
      for (const heading of headings) {
        const text = heading.textContent?.trim() || "";
        if (text.toLowerCase().includes(pendingScroll.toLowerCase())) {
          const containerRect = container.getBoundingClientRect();
          const elRect = heading.getBoundingClientRect();
          container.scrollTo({ top: container.scrollTop + (elRect.top - containerRect.top) - 20, behavior: "smooth" });
          setPendingScroll(null);
          return;
        }
      }
      // Heading not found yet — HTML might still be rendering
      if (attempts < 5) { attempts++; setTimeout(tryScroll, 300); }
      else { setPendingScroll(null); }
    };
    const timer = setTimeout(tryScroll, 400);
    return () => clearTimeout(timer);
  }, [pendingScroll, supportLoading, supportHtml]);

  const handleSupportClick = async () => {
    const heading = currentView ? MODULE_HEADING_MAP[currentView] : null;
    setSupportOpen(true);
    setPendingScroll(heading);

    if (!supportHtml) {
      setSupportLoading(true);
      try {
        const { API_CONFIG } = await import("@/config/api");
        const resp = await apiGet(`${API_CONFIG.BASE_URL}/api/support/user-guide`);
        const data = await resp.json();
        setSupportHtml(data.html || "");
      } catch {
        setSupportHtml("<p style='color:red'>Failed to load user guide. Please try again later.</p>");
      } finally {
        setSupportLoading(false);
      }
    }
  };

  return (
    <div className={`${isMobile ? 'w-60' : (collapsed ? 'w-16' : 'w-60')} h-full bg-sidebar-bg border-r border-sidebar-border flex flex-col transition-all duration-300 overflow-hidden`}>
      {/* Header */}
      <div className="py-0 border-b border-sidebar-border h-16 flex items-center justify-between flex-shrink-0 bg-primary-soft">
        <Link
          to="/"
          className={`flex items-center hover:opacity-80 transition-opacity ${collapsed && !isMobile ? 'justify-center w-full' : 'gap-2 px-4'}`}
        >
          {THEME === "siriusai" && (collapsed && !isMobile) && (
            <img
              src="/Logo - S Only (2).png"
              alt="SiriusAI"
              className="h-[32px] w-auto"
            />
          )}
          {THEME === "siriusai" && (!collapsed || isMobile) && (
            <img
              src="/Logo - SiriusAI (2).png"
              alt="SiriusAI"
              className="h-[32px] w-auto"
            />
          )}
          {THEME === "deluxe" && (collapsed && !isMobile) && (
            <span className="text-[1.35rem] font-semibold tracking-[0.06em] text-gray-900 select-none">
              vl<span className="text-primary">x</span>
            </span>
          )}
          {THEME === "deluxe" && (!collapsed || isMobile) && (
            <div className="flex flex-col">
              <span className="text-[1.35rem] font-semibold tracking-tight text-gray-900 leading-none">
                Velu<span className="text-primary">x</span>e
              </span>
              <span className="text-[0.65rem] font-semibold tracking-wider text-gray-500 mt-0.5">
                Drive Engineering Excellence @dlx
              </span>
            </div>
          )}
        </Link>

        {isMobile && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onMobileClose}
            className="mr-4"
          >
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        {/* Tools Section */}
        <div className="p-4 border-b border-sidebar-border">
          {!isMobile && showBackButton && (
            <Button
              variant="ghost"
              onClick={onToggleCollapse}
              className={`w-full ${collapsed ? 'justify-center' : 'justify-between'} p-0 h-auto mb-3 text-muted-foreground hover:text-foreground hover:bg-transparent`}
            >
              {!collapsed && (
                <div className="text-xs font-medium uppercase tracking-wide">
                  TOOLS
                </div>
              )}
              <ChevronLeft className={`w-4 h-4 transition-transform ${collapsed ? 'rotate-180' : 'rotate-0'}`} />
            </Button>
          )}
          {!isMobile && !showBackButton && (
            <Button
              variant="ghost"
              onClick={onToggleCollapse}
              className={`w-full ${collapsed ? 'justify-center' : 'justify-between'} p-0 h-auto mb-3 text-muted-foreground hover:text-foreground hover:bg-transparent`}
            >
              {!collapsed && (
                <div className="text-xs font-medium uppercase tracking-wide">
                  TOOLS
                </div>
              )}
              <ChevronLeft className={`w-4 h-4 transition-transform ${collapsed ? 'rotate-180' : 'rotate-0'}`} />
            </Button>
          )}
          {isMobile && (
            <div className="w-full p-0 h-auto mb-3">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                TOOLS
              </div>
            </div>
          )}
          {(!collapsed || isMobile) && (
            <div className="space-y-1">
              {visibleItems.map((item) => {
                const isActive = currentView === item.id;
                return (
                  <Link
                    key={item.label}
                    to={item.path}
                    onClick={isMobile ? onMobileClose : undefined}
                    className="block"
                  >
                    <Button
                      variant="ghost"
                      className={`w-full justify-start h-auto p-3 text-left hover:bg-accent`}
                      style={isActive ? { backgroundColor: 'rgba(184, 218, 222, 0.34)' } : undefined}
                    >
                      <div className="flex items-start gap-3 w-full">
                        <item.icon className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-body-dark font-normal">{item.label}</div>
                          <div className="text-xs font-normal text-icon-gray">
                            {item.description}
                          </div>
                        </div>
                      </div>
                    </Button>
                  </Link>
                );
              })}
            </div>
          )}
          {collapsed && !isMobile && (
            <div className="space-y-2 mt-3">
              {visibleItems.map((item) => {
                const isActive = currentView === item.id;
                return (
                  <Link
                    key={item.label}
                    to={item.path}
                  >
                    <Button
                      variant="ghost"
                      className={`w-full h-10 p-0 justify-center hover:bg-accent`}
                      style={isActive ? { backgroundColor: 'rgba(184, 218, 222, 0.34)' } : undefined}
                      title={item.label}
                    >
                      <item.icon className="w-4 h-4" />
                    </Button>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Bottom Navigation */}
        <div className="p-4 space-y-1">
          <Button
            variant="ghost"
            className={`w-full justify-start ${collapsed ? 'p-3 h-10' : 'h-9 p-3'} hover:bg-accent text-sm text-body-dark font-normal`}
            title={collapsed ? "Support" : undefined}
            onClick={handleSupportClick}
          >
            <HelpCircle className={`w-4 h-4 ${(isMobile || !collapsed) ? 'mr-2' : ''}`} />
            {(isMobile || !collapsed) && <span className="text-sm text-body-dark font-normal">Support</span>}
          </Button>
        </div>
      </div>

      {/* Support User Guide — Full-screen overlay */}
      <Dialog open={supportOpen} onOpenChange={setSupportOpen}>
        <DialogContent className="fixed inset-4 max-w-none w-auto h-auto translate-x-0 translate-y-0 top-4 left-4 flex flex-col bg-white rounded-xl shadow-2xl">
          <DialogHeader className="flex-shrink-0 border-b px-8 py-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center">
                <HelpCircle className="w-5 h-5 text-white" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-gray-900">Veluxe User Guide</DialogTitle>
                <p className="text-xs text-gray-500 mt-0.5">Documentation &amp; setup instructions</p>
              </div>
            </div>
          </DialogHeader>
          <div id="support-guide-scroll" className="flex-1 overflow-y-auto px-8 py-6 bg-white">
            {supportLoading ? (
              <div className="flex items-center justify-center py-24">
                <Loader2 className="w-8 h-8 animate-spin mr-3 text-blue-600" />
                <span className="text-gray-500 text-lg">Loading user guide...</span>
              </div>
            ) : (
              <div
                className="support-guide-content"
                dangerouslySetInnerHTML={{ __html: supportHtml }}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
