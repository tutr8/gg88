import "./global.css";

import { Toaster } from "@/components/ui/toaster";
import { createRoot } from "react-dom/client";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import { Analytics } from "@vercel/analytics/react";
import NotFound from "./pages/NotFound";
import Take from "./pages/Take";
import Learn from "./pages/Learn";
import Profile from "./pages/Profile";
import CreateOffer from "./pages/CreateOffer";
import Offer from "./pages/Offer";
import Header from "@/components/layout/Header";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import Chat from "./pages/Chat";
import ChatRoom from "./pages/ChatRoom";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Analytics />
        <Header>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/take" element={<Take />} />
            <Route path="/learn" element={<Learn />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/offer/new" element={<CreateOffer />} />
            <Route path="/offer/:id" element={<Offer />} />
            <Route path="/chat" element={<Chat />} />
            <Route path="/chat/:id" element={<ChatRoom />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/privacy" element={<Privacy />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Header>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

createRoot(document.getElementById("root")!).render(<App />);
