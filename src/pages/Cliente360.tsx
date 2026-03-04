import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { ClienteHeader } from '@/components/clientes/ClienteHeader';
import { ClienteResumo } from '@/components/clientes/ClienteResumo';
import { ClienteContatos } from '@/components/clientes/ClienteContatos';
import { ClienteContratos } from '@/components/clientes/ClienteContratos';
import { ClienteNotas } from '@/components/clientes/ClienteNotas';
import { ClienteTimeline } from '@/components/clientes/ClienteTimeline';
import { ClienteOKR } from '@/components/clientes/ClienteOKR';
import { ClienteReunioes } from '@/components/clientes/ClienteReunioes';
import { ClienteJornada } from '@/components/clientes/ClienteJornada';
import { ClienteMetricas } from '@/components/clientes/ClienteMetricas';
import { EditOfficeDialog } from '@/components/clientes/EditOfficeDialog';
import { HealthBadge } from '@/components/clientes/HealthBadge';
import { ClienteBonus } from '@/components/clientes/ClienteBonus';

export default function Cliente360() {
  const { id } = useParams<{ id: string }>();
  const { isViewer } = useAuth();
  const [office, setOffice] = useState<any>(null);
  const [contacts, setContacts] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const [officeRes, contactsRes, contractsRes, healthRes] = await Promise.all([
      supabase.from('offices').select('*, products:active_product_id(name)').eq('id', id).single(),
      supabase.from('contacts').select('*').eq('office_id', id).order('is_main_contact', { ascending: false }).order('name'),
      supabase.from('contracts').select('*, products:product_id(name)').eq('office_id', id).order('created_at', { ascending: false }),
      supabase.from('health_scores').select('*').eq('office_id', id).maybeSingle(),
    ]);
    if (officeRes.data) setOffice(officeRes.data);
    setContacts(contactsRes.data || []);
    setContracts(contractsRes.data || []);
    setHealth(healthRes.data);
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl skeleton-shimmer" />
          <div className="space-y-2 flex-1">
            <div className="h-6 w-48 rounded skeleton-shimmer" />
            <div className="h-4 w-32 rounded skeleton-shimmer" />
          </div>
        </div>
        <div className="h-10 w-full rounded-lg skeleton-shimmer" />
        <div className="rounded-xl border border-border/60 bg-card p-6 space-y-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-5 rounded skeleton-shimmer" />)}
        </div>
      </div>
    );
  }

  if (!office) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <p className="text-muted-foreground">Escritório não encontrado.</p>
      </div>
    );
  }

  const activeContract = contracts.find(c => c.status === 'ativo') || null;
  const mainContact = contacts.find(c => c.is_main_contact) || null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex-1"><ClienteHeader office={office} onEdit={isViewer ? undefined : () => setEditOpen(true)} /></div>
        <HealthBadge score={health?.score ?? null} band={health?.band ?? null} size="md" />
      </div>

      <Tabs defaultValue="resumo" className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="resumo">Resumo</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="okr">Plano de Ação</TabsTrigger>
          <TabsTrigger value="reunioes">Reuniões</TabsTrigger>
          <TabsTrigger value="jornada">Jornada</TabsTrigger>
          <TabsTrigger value="contatos">Contatos ({contacts.length})</TabsTrigger>
          <TabsTrigger value="contratos">Contratos ({contracts.length})</TabsTrigger>
          <TabsTrigger value="metricas">Métricas</TabsTrigger>
          <TabsTrigger value="notas">Notas</TabsTrigger>
          <TabsTrigger value="bonus">Bônus/Cashback</TabsTrigger>
        </TabsList>

        <TabsContent value="resumo">
          <ClienteResumo office={office} activeContract={activeContract} mainContact={mainContact} />
        </TabsContent>

        <TabsContent value="timeline">
          <Card className="p-6"><ClienteTimeline officeId={office.id} readOnly={isViewer} /></Card>
        </TabsContent>

        <TabsContent value="okr">
          <Card className="p-6"><ClienteOKR officeId={office.id} /></Card>
        </TabsContent>

        <TabsContent value="reunioes">
          <Card className="p-6"><ClienteReunioes officeId={office.id} /></Card>
        </TabsContent>

        <TabsContent value="jornada">
          <ClienteJornada officeId={office.id} productId={office.active_product_id} />
        </TabsContent>

        <TabsContent value="contatos">
          <Card className="p-6"><ClienteContatos officeId={office.id} contacts={contacts} onRefresh={fetchAll} /></Card>
        </TabsContent>

        <TabsContent value="contratos">
          <Card className="p-6"><ClienteContratos officeId={office.id} contracts={contracts} onRefresh={fetchAll} /></Card>
        </TabsContent>

        <TabsContent value="metricas">
          <ClienteMetricas officeId={office.id} />
        </TabsContent>

        <TabsContent value="notas">
          <Card className="p-6"><ClienteNotas officeId={office.id} initialNotes={office.notes} /></Card>
        </TabsContent>

        <TabsContent value="bonus">
          <Card className="p-6"><ClienteBonus officeId={office.id} /></Card>
        </TabsContent>
      </Tabs>

      {!isViewer && <EditOfficeDialog office={office} open={editOpen} onOpenChange={setEditOpen} onSaved={fetchAll} />}
    </div>
  );
}
