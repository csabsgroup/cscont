import { useParams, Navigate, Routes, Route, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { PortalProvider } from '@/contexts/PortalContext';
import { PortalPreviewLayout } from '@/components/portal/PortalPreviewLayout';
import PortalHome from './PortalHome';
import PortalContrato from './PortalContrato';
import PortalOKR from './PortalOKR';
import PortalReunioes from './PortalReunioes';
import PortalEventos from './PortalEventos';
import PortalBonus from './PortalBonus';
import PortalContatos from './PortalContatos';
import PortalMembros from './PortalMembros';
import PortalArquivos from './PortalArquivos';

export default function PortalPreview() {
  const { officeId } = useParams<{ officeId: string }>();
  const { session, loading, isAdmin, isManager, isCSM } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!session) return <Navigate to="/auth" replace />;
  if (!isAdmin && !isManager && !isCSM) return <Navigate to="/" replace />;
  if (!officeId) return <Navigate to="/" replace />;

  return (
    <PortalProvider previewOfficeId={officeId}>
      <PortalPreviewLayout>
        <Routes>
          <Route index element={<PortalHome />} />
          <Route path="contrato" element={<PortalContrato />} />
          <Route path="plano-de-acao" element={<PortalOKR />} />
          <Route path="reunioes" element={<PortalReunioes />} />
          <Route path="eventos" element={<PortalEventos />} />
          <Route path="bonus" element={<PortalBonus />} />
          <Route path="contatos" element={<PortalContatos />} />
          <Route path="membros" element={<PortalMembros />} />
          <Route path="arquivos" element={<PortalArquivos />} />
        </Routes>
      </PortalPreviewLayout>
    </PortalProvider>
  );
}
