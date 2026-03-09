import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AppLayout } from "@/components/AppLayout";
import { PortalLayout } from "@/components/portal/PortalLayout";
import { PortalProvider } from "@/contexts/PortalContext";
import Auth from "@/pages/Auth";
import Dashboard from "@/pages/Dashboard";
import Cliente360 from "@/pages/Cliente360";
import Clientes from "@/pages/Clientes";
import Jornada from "@/pages/Jornada";
import Atividades from "@/pages/Atividades";
import Reunioes from "@/pages/Reunioes";
import Eventos from "@/pages/Eventos";
import ContratosGlobal from "@/pages/ContratosGlobal";
import ContatosGlobal from "@/pages/ContatosGlobal";
import Configuracoes from "@/pages/Configuracoes";
import Relatorios from "@/pages/Relatorios";
import AuditLogs from "@/pages/AuditLogs";
import Financeiro from "@/pages/Financeiro";
import Notificacoes from "@/pages/Notificacoes";
import ComingSoon from "@/pages/ComingSoon";
import NotFound from "@/pages/NotFound";
import TarefasInternas from "@/pages/TarefasInternas";
import Formularios from "@/pages/Formularios";
import PortalHome from "@/pages/portal/PortalHome";
import PortalContrato from "@/pages/portal/PortalContrato";
import PortalOKR from "@/pages/portal/PortalOKR";
import PortalReunioes from "@/pages/portal/PortalReunioes";
import PortalEventos from "@/pages/portal/PortalEventos";
import PortalBonus from "@/pages/portal/PortalBonus";
import PortalContatos from "@/pages/portal/PortalContatos";
import PortalMembros from "@/pages/portal/PortalMembros";
import PortalArquivos from "@/pages/portal/PortalArquivos";
import PortalLogin from "@/pages/portal/PortalLogin";
import FormPublic from "@/pages/FormPublic";


const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading, isClient } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!session) return <Navigate to="/auth" replace />;
  if (isClient) return <Navigate to="/portal" replace />;

  return <AppLayout>{children}</AppLayout>;
}

function PortalRoute({ children }: { children: React.ReactNode }) {
  const { session, loading, isClient } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!session) return <Navigate to="/auth" replace />;
  if (!isClient) return <Navigate to="/" replace />;

  return (
    <PortalProvider>
      <PortalLayout>{children}</PortalLayout>
    </PortalProvider>
  );
}

const App = () => (
  <ThemeProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/portal/login" element={<PortalLogin />} />
            <Route path="/forms/:formHash" element={<FormPublic />} />
            <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/clientes" element={<ProtectedRoute><Clientes /></ProtectedRoute>} />
            <Route path="/clientes/:id" element={<ProtectedRoute><Cliente360 /></ProtectedRoute>} />
            <Route path="/jornada" element={<ProtectedRoute><Jornada /></ProtectedRoute>} />
            <Route path="/atividades" element={<ProtectedRoute><Atividades /></ProtectedRoute>} />
            <Route path="/reunioes" element={<ProtectedRoute><Reunioes /></ProtectedRoute>} />
            <Route path="/eventos" element={<ProtectedRoute><Eventos /></ProtectedRoute>} />
            <Route path="/contratos" element={<ProtectedRoute><ContratosGlobal /></ProtectedRoute>} />
            <Route path="/contatos" element={<ProtectedRoute><ContatosGlobal /></ProtectedRoute>} />
            <Route path="/financeiro" element={<ProtectedRoute><Financeiro /></ProtectedRoute>} />
            <Route path="/relatorios" element={<ProtectedRoute><Relatorios /></ProtectedRoute>} />
            <Route path="/configuracoes" element={<ProtectedRoute><Configuracoes /></ProtectedRoute>} />
            <Route path="/auditoria" element={<ProtectedRoute><AuditLogs /></ProtectedRoute>} />
            <Route path="/tarefas-internas" element={<ProtectedRoute><TarefasInternas /></ProtectedRoute>} />
            <Route path="/formularios" element={<ProtectedRoute><Formularios /></ProtectedRoute>} />
            <Route path="/notificacoes" element={<ProtectedRoute><Notificacoes /></ProtectedRoute>} />
            {/* Portal do Cliente */}
            <Route path="/portal" element={<PortalRoute><PortalHome /></PortalRoute>} />
            <Route path="/portal/contrato" element={<PortalRoute><PortalContrato /></PortalRoute>} />
            <Route path="/portal/plano-de-acao" element={<PortalRoute><PortalOKR /></PortalRoute>} />
            <Route path="/portal/reunioes" element={<PortalRoute><PortalReunioes /></PortalRoute>} />
            <Route path="/portal/eventos" element={<PortalRoute><PortalEventos /></PortalRoute>} />
            <Route path="/portal/bonus" element={<PortalRoute><PortalBonus /></PortalRoute>} />
            <Route path="/portal/contatos" element={<PortalRoute><PortalContatos /></PortalRoute>} />
            <Route path="/portal/membros" element={<PortalRoute><PortalMembros /></PortalRoute>} />
            <Route path="/portal/arquivos" element={<PortalRoute><PortalArquivos /></PortalRoute>} />
            <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
