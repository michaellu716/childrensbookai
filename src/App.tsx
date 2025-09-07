import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Landing from "./pages/Landing";
import CreateStory from "./pages/CreateStory";
import ReviewStory from "./pages/ReviewStory";
import Library from "./pages/Library";
import NotFound from "./pages/NotFound";
import Auth from "./pages/Auth";
import { AuthGuard } from "./components/AuthGuard";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route path="/" element={
            <AuthGuard>
              <Index />
            </AuthGuard>
          } />
          <Route path="/landing" element={<Landing />} />
          <Route path="/create" element={
            <AuthGuard>
              <CreateStory />
            </AuthGuard>
          } />
          <Route path="/review" element={
            <AuthGuard>
              <ReviewStory />
            </AuthGuard>
          } />
          <Route path="/library" element={
            <AuthGuard>
              <Library />
            </AuthGuard>
          } />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
