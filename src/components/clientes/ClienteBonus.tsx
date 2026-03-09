import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Loader2, Gift, CheckCircle2, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

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

export function ClienteBonus({ officeId }: { officeId: string }) {
  const { session, isViewer } = useAuth();
  const [grants, setGrants] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [catalog, setCatalog] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [grantDialogOpen, setGrantDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedCatalogId, setSelectedCatalogId] = useState('');
  const [quantity, setQuantity] = useState('1');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [gRes, rRes, cRes] = await Promise.all([
      supabase.from('bonus_grants').select('*, bonus_catalog(name, unit)').eq('office_id', officeId).order('granted_at', { ascending: false }),
      supabase.from('bonus_requests').select('*, bonus_catalog(name, unit)').eq('office_id', officeId).order('created_at', { ascending: false }),
      supabase.from('bonus_catalog').select('*').order('name'),
    ]);
    setGrants(gRes.data || []);
    setRequests(rRes.data || []);
    setCatalog(cRes.data || []);
    setLoading(false);
  }, [officeId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleGrant = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    const catalogItem = catalog.find(c => c.id === selectedCatalogId);
    const expiresAt = catalogItem?.default_validity_days
      ? new Date(Date.now() + catalogItem.default_validity_days * 86400000).toISOString()
      : null;
    const { error } = await supabase.from('bonus_grants').insert({
      office_id: officeId, catalog_item_id: selectedCatalogId,
      quantity: parseFloat(quantity), available: parseFloat(quantity), expires_at: expiresAt,
    });
    if (error) toast.error('Erro: ' + error.message);
    else {
      toast.success('Bônus concedido!');
      try {
        await supabase.functions.invoke('execute-automations', {
          body: { action: 'triggerV2', trigger_type: 'bonus.requested', office_id: officeId, context: { suffix: `bonus_${Date.now()}` } },
        });
      } catch (autoErr) { console.error('Automation trigger failed:', autoErr); }
      setGrantDialogOpen(false); fetchAll();
    }
    setSaving(false);
  };

  const handleRequestAction = async (requestId: string, status: 'approved' | 'denied') => {
    const { error } = await supabase.from('bonus_requests').update({
      status: status as any, reviewed_by: session?.user?.id,
    }).eq('id', requestId);
    if (error) toast.error('Erro: ' + error.message);
    else { toast.success(status === 'approved' ? 'Aprovado!' : 'Negado!'); fetchAll(); }
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;

  const grouped = groupGrants(grants);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Gift className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Bônus/Cashback</h3>
        </div>
        {!isViewer && (
          <Button size="sm" onClick={() => setGrantDialogOpen(true)}><Plus className="mr-1 h-4 w-4" />Conceder Bônus</Button>
        )}
      </div>

      {/* Cards agrupados por tipo */}
      <Card>
        <CardHeader><CardTitle className="text-base">Bônus Concedidos</CardTitle></CardHeader>
        <CardContent>
          {grouped.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum bônus concedido.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {grouped.map(g => {
                const usedPercent = g.totalQuantity > 0 ? Math.round((g.totalUsed / g.totalQuantity) * 100) : 0;
                return (
                  <div key={g.catalogItemId} className="rounded-lg border border-border/60 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Gift className="h-4 w-4 text-primary" />
                      <span className="font-medium text-sm">{g.name}</span>
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
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Requests */}
      <Card>
        <CardHeader><CardTitle className="text-base">Solicitações</CardTitle></CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhuma solicitação.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead><TableHead>Qtd</TableHead><TableHead>Status</TableHead>
                  <TableHead>Data</TableHead><TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map(r => (
                  <TableRow key={r.id} className={r.status === 'pending' ? 'bg-amber-50/50' : ''}>
                    <TableCell className="font-medium">{r.bonus_catalog?.name}</TableCell>
                    <TableCell>{r.quantity}</TableCell>
                    <TableCell><Badge variant={statusLabels[r.status]?.variant || 'secondary'}>{statusLabels[r.status]?.label || r.status}</Badge></TableCell>
                    <TableCell className="text-muted-foreground">{format(new Date(r.created_at), 'dd/MM/yyyy')}</TableCell>
                    <TableCell>
                      {r.status === 'pending' && !isViewer && (
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => handleRequestAction(r.id, 'approved')}><CheckCircle2 className="h-4 w-4 text-green-600" /></Button>
                          <Button size="sm" variant="ghost" onClick={() => handleRequestAction(r.id, 'denied')}><XCircle className="h-4 w-4 text-destructive" /></Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={grantDialogOpen} onOpenChange={setGrantDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Conceder Bônus</DialogTitle></DialogHeader>
          <form onSubmit={handleGrant} className="space-y-4">
            <div className="space-y-2">
              <Label>Item do catálogo *</Label>
              <Select value={selectedCatalogId} onValueChange={setSelectedCatalogId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{catalog.map(c => <SelectItem key={c.id} value={c.id}>{c.name} ({c.unit})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Quantidade</Label>
              <Input type="number" value={quantity} onChange={e => setQuantity(e.target.value)} min="1" step="1" />
            </div>
            <Button type="submit" className="w-full" disabled={saving || !selectedCatalogId}>{saving ? 'Salvando...' : 'Conceder'}</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
