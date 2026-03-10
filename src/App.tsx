import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
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
import EventoDetalhe from "@/pages/EventoDetalhe";
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
import FormBuilder from "@/pages/FormBuilder";
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

function ProtectedRoute() {
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

  return <AppLayout />;
}

function PortalRoute() {
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
      <PortalLayout />
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

              {/* Protected CSM routes — layout stays mounted */}
              <Route element={<ProtectedRoute />}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/clientes" element={<Clientes />} />
                <Route path="/clientes/:id" element={<Cliente360 />} />
                <Route path="/jornada" element={<Jornada />} />
                <Route path="/atividades" element={<Atividades />} />
                <Route path="/reunioes" element={<Reunioes />} />
                <Route path="/eventos" element={<Eventos />} />
                <Route path="/eventos/:id" element={<EventoDetalhe />} />
                <Route path="/contratos" element={<ContratosGlobal />} />
                <Route path="/contatos" element={<ContatosGlobal />} />
                <Route path="/financeiro" element={<Financeiro />} />
                <Route path="/relatorios" element={<Relatorios />} />
                <Route path="/configuracoes" element={<Configuracoes />} />
                <Route path="/auditoria" element={<AuditLogs />} />
                <Route path="/tarefas-internas" element={<TarefasInternas />} />
                <Route path="/formularios" element={<Formularios />} />
                <Route path="/formularios/builder/:id" element={<FormBuilder />} />
                <Route path="/notificacoes" element={<Notificacoes />} />
              </Route>

              {/* Portal do Cliente — layout stays mounted */}
              <Route element={<PortalRoute />}>
                <Route path="/portal" element={<PortalHome />} />
                <Route path="/portal/contrato" element={<PortalContrato />} />
                <Route path="/portal/plano-de-acao" element={<PortalOKR />} />
                <Route path="/portal/reunioes" element={<PortalReunioes />} />
                <Route path="/portal/eventos" element={<PortalEventos />} />
                <Route path="/portal/bonus" element={<PortalBonus />} />
                <Route path="/portal/contatos" element={<PortalContatos />} />
                <Route path="/portal/membros" element={<PortalMembros />} />
                <Route path="/portal/arquivos" element={<PortalArquivos />} />
              </Route>

              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
