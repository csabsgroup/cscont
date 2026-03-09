import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { usePortal } from '@/contexts/PortalContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Gift, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { PaginationWithPageSize } from '@/components/shared/PaginationWithPageSize';

const statusLabels: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' }> = {
  pending: { label: 'Pendente', variant: 'secondary' },
  approved: { label: 'Aprovado', variant: 'default' },
  denied: { label: 'Negado', variant: 'destructive' },
};

interface GroupedGrant {
  catalogItemId: string;
  name: string;
  unit: string;
  totalQuantity: number;
  totalUsed: number;
  totalAvailable: number;
  nearestExpiry: string | null;
}

function groupGrants(grants: any[]): GroupedGrant[] {
  const map = new Map<string, GroupedGrant>();
  for (const g of grants) {
    const key = g.catalog_item_id;
    const existing = map.get(key);
    if (existing) {
      existing.totalQuantity += Number(g.quantity);
      existing.totalUsed += Number(g.used);
      existing.totalAvailable += Number(g.available);
      if (g.expires_at && (!existing.nearestExpiry || g.expires_at < existing.nearestExpiry)) {
        existing.nearestExpiry = g.expires_at;
      }
    } else {
      map.set(key, {
        catalogItemId: key,
        name: g.bonus_catalog?.name || 'Item',
        unit: g.bonus_catalog?.unit || 'unidade',
        totalQuantity: Number(g.quantity),
        totalUsed: Number(g.used),
        totalAvailable: Number(g.available),
        nearestExpiry: g.expires_at || null,
      });
    }
  }
  return Array.from(map.values());
}

export default function PortalBonus() {
  const { officeId } = usePortal();
  const [grants, setGrants] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [catalog, setCatalog] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedItem, setSelectedItem] = useState('');
  const [qty, setQty] = useState('1');
  const [notes, setNotes] = useState('');

  const fetchAll = useCallback(async () => {
    if (!officeId) { setLoading(false); return; }
    const { data: office } = await supabase.from('offices').select('active_product_id').eq('id', officeId).single();
    const [gRes, rRes, cRes] = await Promise.all([
      supabase.from('bonus_grants').select('*, bonus_catalog(name, unit)').eq('office_id', officeId).order('granted_at', { ascending: false }),
      supabase.from('bonus_requests').select('*, bonus_catalog(name, unit)').eq('office_id', officeId).order('created_at', { ascending: false }),
      supabase.from('bonus_catalog').select('*').eq('visible_in_portal', true).order('name'),
    ]);
    const allCatalog = cRes.data || [];
    const productId = office?.active_product_id;
    const filteredCatalog = allCatalog.filter(item => {
      const eligible = item.eligible_product_ids as string[] | null;
      if (!eligible || eligible.length === 0) return true;
      return productId ? eligible.includes(productId) : true;
    });
    setGrants(gRes.data || []);
    setRequests(rRes.data || []);
    setCatalog(filteredCatalog);
    setLoading(false);
  }, [officeId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!officeId) return;
    setSaving(true);
    const { error } = await supabase.from('bonus_requests').insert({
      office_id: officeId,
      catalog_item_id: selectedItem,
      quantity: parseFloat(qty),
      notes: notes || null,
    });
    if (error) { toast.error('Erro: ' + error.message); setSaving(false); return; }

    const { data: officeData } = await supabase.from('offices').select('csm_id, name').eq('id', officeId).single();
    const catalogItem = catalog.find(c => c.id === selectedItem);
    if (officeData?.csm_id) {
      await supabase.from('activities').insert({
        title: `Solicitação de bônus: ${catalogItem?.name || 'Item'} (${qty}x)`,
        description: `O cliente ${officeData.name} solicitou ${qty}x ${catalogItem?.name}. ${notes ? 'Obs: ' + notes : ''}`,
        user_id: officeData.csm_id,
        office_id: officeId,
        type: 'task' as any,
        priority: 'high' as any,
      });
      try {
        await supabase.functions.invoke('integration-slack', {
          body: { action: 'sendNotification', message: `🎁 *Nova solicitação de bônus*\nCliente: ${officeData.name}\nItem: ${catalogItem?.name} (${qty}x)\n${notes ? 'Obs: ' + notes : ''}` },
        });
      } catch { /* Slack not configured */ }
    }
    toast.success('Solicitação enviada!');
    setDialogOpen(false); setSelectedItem(''); setQty('1'); setNotes('');
    fetchAll(); setSaving(false);
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  const grouped = groupGrants(grants);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Bônus/Cashback</h1>
        {catalog.length > 0 && (
          <Button size="sm" onClick={() => setDialogOpen(true)}><Plus className="mr-1 h-4 w-4" />Solicitar</Button>
        )}
      </div>

      {/* Cards agrupados por tipo */}
      {grouped.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">Nenhum bônus concedido.</CardContent></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {grouped.map(g => {
            const usedPercent = g.totalQuantity > 0 ? Math.round((g.totalUsed / g.totalQuantity) * 100) : 0;
            return (
              <Card key={g.catalogItemId} className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Gift className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold text-sm">{g.name}</h3>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center mb-3">
                  <div>
                    <p className="text-lg font-bold text-foreground">{g.totalQuantity}</p>
                    <p className="text-xs text-muted-foreground">Ganho</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-primary">{g.totalUsed}</p>
                    <p className="text-xs text-muted-foreground">Utilizado</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-green-600">{g.totalAvailable}</p>
                    <p className="text-xs text-muted-foreground">Restante</p>
                  </div>
                </div>
                <Progress value={usedPercent} className="h-2 mb-1" />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{usedPercent}% utilizado</span>
                  <span>{g.unit}</span>
                </div>
                {g.nearestExpiry && (
                  <p className="text-xs text-muted-foreground mt-2">Expira: {format(new Date(g.nearestExpiry), 'dd/MM/yyyy')}</p>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Solicitações */}
      <Card>
        <CardHeader><CardTitle className="text-base">Solicitações</CardTitle></CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhuma solicitação.</p>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Item</TableHead><TableHead>Qtd</TableHead><TableHead>Status</TableHead><TableHead>Data</TableHead></TableRow></TableHeader>
              <TableBody>
                {requests.map(r => (
                  <TableRow key={r.id} className={r.status === 'pending' ? 'bg-amber-50/50 dark:bg-amber-900/20' : ''}>
                    <TableCell className="font-medium">{r.bonus_catalog?.name}</TableCell>
                    <TableCell>{r.quantity}</TableCell>
                    <TableCell><Badge variant={statusLabels[r.status]?.variant}>{statusLabels[r.status]?.label}</Badge></TableCell>
                    <TableCell className="text-muted-foreground">{format(new Date(r.created_at), 'dd/MM/yyyy')}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Solicitar Bônus</DialogTitle></DialogHeader>
          <form onSubmit={handleRequest} className="space-y-4">
            <div className="space-y-2">
              <Label>Item *</Label>
              <Select value={selectedItem} onValueChange={setSelectedItem}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{catalog.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Quantidade</Label><Input type="number" value={qty} onChange={e => setQty(e.target.value)} min="1" /></div>
            <div className="space-y-2"><Label>Observação</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} /></div>
            <Button type="submit" className="w-full" disabled={saving || !selectedItem}>{saving ? 'Enviando...' : 'Solicitar'}</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
