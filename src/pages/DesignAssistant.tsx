import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { DesignDashboard } from "@/components/dashboard/DesignDashboard";
import { LucidDashboard } from "@/components/dashboard/LucidDashboard";
import { PenLine, LayoutDashboard } from "lucide-react";

const DesignAssistant = () => {
  const [activeTab, setActiveTab] = useState<"drawio" | "lucidchart">("drawio");

  return (
    <MainLayout currentView="design">
      <div className="flex flex-col h-[calc(100vh-4rem)] overflow-hidden">

        {/* Tab strip */}
        <div className="flex items-center gap-1 px-6 py-2 border-b border-gray-200 bg-white flex-shrink-0">
          <button
            onClick={() => setActiveTab("drawio")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeTab === "drawio"
                ? "bg-primary text-white shadow-sm"
                : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
            }`}
          >
            <PenLine className="w-3.5 h-3.5" />Draw.io
          </button>
          <button
            onClick={() => setActiveTab("lucidchart")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeTab === "lucidchart"
                ? "bg-primary text-white shadow-sm"
                : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
            }`}
          >
            <LayoutDashboard className="w-3.5 h-3.5" />Lucidchart
          </button>
        </div>

        {/* Active dashboard */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {activeTab === "drawio" ? <DesignDashboard /> : <LucidDashboard />}
        </div>

      </div>
    </MainLayout>
  );
};

export default DesignAssistant;
