import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/AppLayout";
import Auth from "@/pages/Auth";
import Dashboard from "@/pages/Dashboard";
import Clientes from "@/pages/Clientes";
import ComingSoon from "@/pages/ComingSoon";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!session) return <Navigate to="/auth" replace />;

  return <AppLayout>{children}</AppLayout>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/clientes" element={<ProtectedRoute><Clientes /></ProtectedRoute>} />
            <Route path="/clientes/:id" element={<ProtectedRoute><ComingSoon title="Cliente 360" description="Visão detalhada do escritório" /></ProtectedRoute>} />
            <Route path="/jornada" element={<ProtectedRoute><ComingSoon title="Jornada" description="Kanban por produto" /></ProtectedRoute>} />
            <Route path="/atividades" element={<ProtectedRoute><ComingSoon title="Atividades" description="Sua rotina diária" /></ProtectedRoute>} />
            <Route path="/reunioes" element={<ProtectedRoute><ComingSoon title="Reuniões" description="Gestão de reuniões" /></ProtectedRoute>} />
            <Route path="/eventos" element={<ProtectedRoute><ComingSoon title="Eventos" description="Eventos do programa" /></ProtectedRoute>} />
            <Route path="/contratos" element={<ProtectedRoute><ComingSoon title="Contratos" description="Gestão de contratos" /></ProtectedRoute>} />
            <Route path="/contatos" element={<ProtectedRoute><ComingSoon title="Contatos" description="Sócios e contatos" /></ProtectedRoute>} />
            <Route path="/relatorios" element={<ProtectedRoute><ComingSoon title="Relatórios" description="Análises e métricas" /></ProtectedRoute>} />
            <Route path="/configuracoes" element={<ProtectedRoute><ComingSoon title="Configurações" description="Configurações do sistema" /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
