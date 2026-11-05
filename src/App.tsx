import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { WorkshopProvider } from "@/contexts/WorkshopContext";
import Navigation from "@/components/Navigation";
import Home from "./pages/Home";
import Phases from "./pages/Phases";
import Learnings from "./pages/Learnings";
import CheatSheet from "./pages/CheatSheet";
import MissionControl from "./pages/MissionControl";
import AITools from "./pages/AITools";
import TeamsDashboard from "./pages/TeamsDashboard";
import AboutUs from "./pages/AboutUs";
import TeamAdmin from "./pages/TeamAdmin";
import GlobalAdmin from "./pages/GlobalAdmin";
import NotFound from "./pages/NotFound";
import Portal from "./negotiation/Portal";
import SupplierSite from "./negotiation/SupplierSite";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <WorkshopProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Navigation />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/phases" element={<Phases />} />
            <Route path="/learnings" element={<Learnings />} />
            {/* Link-only: deliberately not in Navigation */}
            <Route path="/cheat" element={<CheatSheet />} />
            {/* Link-only big-screen dashboard: not in Navigation, no Narcos navigation bar */}
            <Route path="/live" element={<MissionControl />} />
            <Route path="/ai-tools" element={<AITools />} />
            <Route path="/teams" element={<TeamsDashboard />} />
            <Route path="/about" element={<AboutUs />} />
            <Route path="/team/:token" element={<TeamAdmin />} />
            <Route path="/admin" element={<GlobalAdmin />} />
            <Route path="/admin-xyz789" element={<Navigate to="/admin" replace />} />
            {/* Negotiation Room: own corporate look, no Narcos navigation */}
            <Route path="/negotiation" element={<Portal />} />
            <Route path="/negotiation/:token" element={<Portal />} />
            <Route path="/negotiation/:token/s/:supplierKey" element={<SupplierSite />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </WorkshopProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
