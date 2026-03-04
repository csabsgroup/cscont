import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Loader2, Gift, CheckCircle2, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

const statusLabels: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' }> = {
  pending: { label: 'Pendente', variant: 'secondary' },
  approved: { label: 'Aprovado', variant: 'default' },
  denied: { label: 'Negado', variant: 'destructive' },
};

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
      office_id: officeId,
      catalog_item_id: selectedCatalogId,
      quantity: parseFloat(quantity),
      available: parseFloat(quantity),
      expires_at: expiresAt,
    });
    if (error) toast.error('Erro: ' + error.message);
    else { toast.success('Bônus concedido!'); setGrantDialogOpen(false); fetchAll(); }
    setSaving(false);
  };

  const handleRequestAction = async (requestId: string, status: 'approved' | 'denied') => {
    const { error } = await supabase.from('bonus_requests').update({
      status: status as any,
      reviewed_by: session?.user?.id,
    }).eq('id', requestId);
    if (error) toast.error('Erro: ' + error.message);
    else { toast.success(status === 'approved' ? 'Aprovado!' : 'Negado!'); fetchAll(); }
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;

  const totalAvailable = grants.reduce((sum, g) => sum + Number(g.available), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Gift className="h-5 w-5 text-primary" />
          <div>
            <h3 className="font-semibold">Bônus/Cashback</h3>
            <p className="text-sm text-muted-foreground">Saldo disponível: {totalAvailable}</p>
          </div>
        </div>
        {!isViewer && (
          <Button size="sm" onClick={() => setGrantDialogOpen(true)}><Plus className="mr-1 h-4 w-4" />Conceder Bônus</Button>
        )}
      </div>

      {/* Grants */}
      <Card>
        <CardHeader><CardTitle className="text-base">Bônus Concedidos</CardTitle></CardHeader>
        <CardContent>
          {grants.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum bônus concedido.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead><TableHead>Qtd</TableHead><TableHead>Usado</TableHead>
                  <TableHead>Disponível</TableHead><TableHead>Expira</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {grants.map(g => (
                  <TableRow key={g.id}>
                    <TableCell className="font-medium">{g.bonus_catalog?.name}</TableCell>
                    <TableCell>{g.quantity} {g.bonus_catalog?.unit}</TableCell>
                    <TableCell>{g.used}</TableCell>
                    <TableCell className="font-medium">{g.available}</TableCell>
                    <TableCell className="text-muted-foreground">{g.expires_at ? format(new Date(g.expires_at), 'dd/MM/yyyy') : '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
                  <TableRow key={r.id}>
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
