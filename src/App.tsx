import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppStateProvider } from "./contexts/AppStateContext";
import Dashboard from "./pages/Dashboard";
import BRDAssistant from "./pages/BRDAssistant";
import ConfluencePage from "./pages/ConfluencePage";
import JiraPage from "./pages/JiraPage";
import DesignAssistant from "./pages/DesignAssistant";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AppStateProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/brd-assistant" element={<BRDAssistant />} />
            <Route path="/confluence" element={<ConfluencePage />} />
            <Route path="/jira" element={<JiraPage />} />
            <Route path="/design-assistant" element={<DesignAssistant />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AppStateProvider>
  </QueryClientProvider>
);

export default App;
