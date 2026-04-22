import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import AppShell from "./layouts/AppShell";
import Index from "./pages/Index.tsx";
import VisaoGeral from "./pages/VisaoGeral.tsx";
import BridgePvm from "./pages/BridgePvm.tsx";
import Canais from "./pages/Canais.tsx";
import Abc from "./pages/Abc.tsx";
import Detalhe from "./pages/Detalhe.tsx";
import Upload from "./pages/Upload.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/" element={<Index />} />
            <Route path="/visao-geral" element={<VisaoGeral />} />
            <Route path="/bridge-pvm" element={<BridgePvm />} />
            <Route path="/canais" element={<Canais />} />
            <Route path="/abc" element={<Abc />} />
            <Route path="/detalhe" element={<Detalhe />} />
            <Route path="/upload" element={<Upload />} />
          </Route>
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
