import { 
  FileText, 
  BookOpen, 
  Ticket, 
  Palette, 
  Bell, 
  Settings, 
  HelpCircle,
  ChevronRight,
  ArrowLeft,
  ChevronLeft,
  X
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import userAvatar from "@/assets/user-avatar.jpg";

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
];

const bottomItems = [
  { icon: Bell, label: "Notifications" },
  { icon: Settings, label: "Settings" },
  { icon: HelpCircle, label: "Support" },
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
  return (
    <div className={`${isMobile ? 'w-60' : (collapsed ? 'w-16' : 'w-60')} h-full bg-sidebar-bg border-r border-sidebar-border flex flex-col transition-all duration-300 overflow-hidden`}>
      {/* Header */}
      <div className="py-0 border-b border-sidebar-border h-16 flex items-center justify-between flex-shrink-0" style={{ backgroundColor: 'rgba(230, 12, 35, 0.06)' }}>
        <Link 
          to="/"
          className="flex items-center gap-2 px-4 hover:opacity-80 transition-opacity"
        >
          <img 
            src="https://www.deluxe.com/etc.clientlibs/deluxe/clientlibs/clientlib-commons/resources/images/sprites/view/svg/sprite.view.svg#deluxe_logo_2020" 
            alt="Deluxe"
            className="w-[65px]"
          />
          {(!collapsed || isMobile) && (
            <div className="text-sm text-muted-foreground hidden sm:block">SDLC Orchestration</div>
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
              {navigationItems.map((item) => {
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
                      style={isActive ? { backgroundColor: 'rgba(184, 218, 222, 0.34)' } : {}}
                    >
                      <div className="flex items-start gap-3 w-full">
                        <item.icon className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div style={{ color: '#3B3B3B', fontSize: '14px', fontWeight: 'normal' }}>{item.label}</div>
                          <div style={{ fontSize: '12px', color: '#858585', fontWeight: 'normal' }}>
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
              {navigationItems.map((item) => {
                const isActive = currentView === item.id;
                return (
                  <Link
                    key={item.label}
                    to={item.path}
                  >
                    <Button
                      variant="ghost"
                      className={`w-full h-10 p-0 justify-center hover:bg-accent`}
                      style={isActive ? { backgroundColor: 'rgba(184, 218, 222, 0.34)' } : {}}
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
          {bottomItems.map((item) => (
            <Button
              key={item.label}
              variant="ghost"
              className={`w-full justify-start ${collapsed ? 'p-3 h-10' : 'h-9 p-3'} hover:bg-accent`}
              style={{ fontSize: '14px', color: '#3B3B3B', fontWeight: 'normal' }}
              title={collapsed ? item.label : undefined}
            >
              <item.icon className={`w-4 h-4 ${(isMobile || !collapsed) ? 'mr-2' : ''}`} />
              {(isMobile || !collapsed) && <span style={{ fontSize: '14px', color: '#3B3B3B', fontWeight: 'normal' }}>{item.label}</span>}
            </Button>
          ))}
        </div>
      </div>

      {/* User Profile - Fixed at bottom */}
      <div className="p-4 border-t border-sidebar-border flex-shrink-0">
        <Button
          variant="ghost"
          className={`w-full ${collapsed ? 'justify-center p-3' : 'justify-between'} h-auto hover:bg-accent`}
        >
          {collapsed ? (
            <Avatar className="w-8 h-8">
              <AvatarImage src={userAvatar} />
              <AvatarFallback>JD</AvatarFallback>
            </Avatar>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <Avatar className="w-8 h-8">
                  <AvatarImage src={userAvatar} />
                  <AvatarFallback>JD</AvatarFallback>
                </Avatar>
                <div className="text-left">
                  <div style={{ color: '#3B3B3B', fontSize: '14px', fontWeight: 'normal' }}>Jane Doe</div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
};