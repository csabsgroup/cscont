import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { ClienteHeader } from '@/components/clientes/ClienteHeader';
import { ClienteResumo } from '@/components/clientes/ClienteResumo';
import { ClienteContatos } from '@/components/clientes/ClienteContatos';
import { ClienteContratos } from '@/components/clientes/ClienteContratos';
import { ClienteNotas } from '@/components/clientes/ClienteNotas';
import { EditOfficeDialog } from '@/components/clientes/EditOfficeDialog';

export default function Cliente360() {
  const { id } = useParams<{ id: string }>();
  const [office, setOffice] = useState<any>(null);
  const [contacts, setContacts] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const [officeRes, contactsRes, contractsRes] = await Promise.all([
      supabase.from('offices').select('*, products:active_product_id(name)').eq('id', id).single(),
      supabase.from('contacts').select('*').eq('office_id', id).order('is_main_contact', { ascending: false }).order('name'),
      supabase.from('contracts').select('*, products:product_id(name)').eq('office_id', id).order('created_at', { ascending: false }),
    ]);
    if (officeRes.data) setOffice(officeRes.data);
    setContacts(contactsRes.data || []);
    setContracts(contractsRes.data || []);
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
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
      <ClienteHeader office={office} onEdit={() => setEditOpen(true)} />

      <Tabs defaultValue="resumo" className="space-y-4">
        <TabsList>
          <TabsTrigger value="resumo">Resumo</TabsTrigger>
          <TabsTrigger value="contatos">Contatos ({contacts.length})</TabsTrigger>
          <TabsTrigger value="contratos">Contratos ({contracts.length})</TabsTrigger>
          <TabsTrigger value="notas">Notas</TabsTrigger>
        </TabsList>

        <TabsContent value="resumo">
          <ClienteResumo office={office} activeContract={activeContract} mainContact={mainContact} />
        </TabsContent>

        <TabsContent value="contatos">
          <Card className="p-6">
            <ClienteContatos officeId={office.id} contacts={contacts} onRefresh={fetchAll} />
          </Card>
        </TabsContent>

        <TabsContent value="contratos">
          <Card className="p-6">
            <ClienteContratos officeId={office.id} contracts={contracts} onRefresh={fetchAll} />
          </Card>
        </TabsContent>

        <TabsContent value="notas">
          <Card className="p-6">
            <ClienteNotas officeId={office.id} initialNotes={office.notes} />
          </Card>
        </TabsContent>
      </Tabs>

      <EditOfficeDialog office={office} open={editOpen} onOpenChange={setEditOpen} onSaved={fetchAll} />
    </div>
  );
}
