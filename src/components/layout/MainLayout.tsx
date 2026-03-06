import { ReactNode, useState, useEffect } from "react";
import { Sidebar } from "./Sidebar";
import { TopHeader } from "@/components/header/TopHeader";
import { type Project } from "@/services/projectApi";

interface MainLayoutProps {
  children: ReactNode;
  showBackButton?: boolean;
  onBack?: () => void;
  currentView?: string;
}

export const MainLayout = ({ children, showBackButton, onBack, currentView }: MainLayoutProps) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth < 1024);
      if (window.innerWidth < 1024) {
        setSidebarCollapsed(true);
      }
    };
    
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  return (
    <div className="flex h-screen bg-background">
      {/* Mobile overlay */}
      {isMobile && mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 lg:hidden" 
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
      
      {/* Sidebar */}
      <div className={`${
        isMobile 
          ? `fixed left-0 top-0 bottom-0 z-40 transform transition-transform duration-300 ${
              mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
            }`
          : 'fixed left-0 top-0 bottom-0 z-40'
      }`}>
        <Sidebar 
          showBackButton={showBackButton}
          onBack={onBack}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          currentView={currentView}
          isMobile={isMobile}
          onMobileClose={() => setMobileMenuOpen(false)}
        />
      </div>
      
      {/* Main content */}
      <div className={`flex-1 overflow-auto transition-all duration-300 bg-white ${
        isMobile ? 'ml-0' : (sidebarCollapsed ? 'ml-16' : 'ml-60')
      }`}>
        {/* Header */}
        <div className={`fixed top-0 right-0 z-50 transition-all duration-300 ${
          isMobile ? 'left-0' : (sidebarCollapsed ? 'left-16' : 'left-60')
        }`}>
          <TopHeader 
            onMenuClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            isMobile={isMobile}
            currentView={currentView}
          />
        </div>
        
        <div className="pt-16">
          {children}
        </div>
      </div>
    </div>
  );
};