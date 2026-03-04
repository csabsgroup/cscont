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
import { Loader2, Gift, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

const statusLabels: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' }> = {
  pending: { label: 'Pendente', variant: 'secondary' },
  approved: { label: 'Aprovado', variant: 'default' },
  denied: { label: 'Negado', variant: 'destructive' },
};

export default function PortalBonus() {
  const { user } = useAuth();
  const [officeId, setOfficeId] = useState<string | null>(null);
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
    if (!user) return;
    const { data: links } = await supabase.from('client_office_links').select('office_id').eq('user_id', user.id);
    const oid = links?.[0]?.office_id;
    setOfficeId(oid || null);
    if (!oid) { setLoading(false); return; }

    const [gRes, rRes, cRes] = await Promise.all([
      supabase.from('bonus_grants').select('*, bonus_catalog(name, unit)').eq('office_id', oid).order('granted_at', { ascending: false }),
      supabase.from('bonus_requests').select('*, bonus_catalog(name, unit)').eq('office_id', oid).order('created_at', { ascending: false }),
      supabase.from('bonus_catalog').select('*').eq('visible_in_portal', true).order('name'),
    ]);
    setGrants(gRes.data || []);
    setRequests(rRes.data || []);
    setCatalog(cRes.data || []);
    setLoading(false);
  }, [user]);

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
    if (error) toast.error('Erro: ' + error.message);
    else { toast.success('Solicitação enviada!'); setDialogOpen(false); setSelectedItem(''); setQty('1'); setNotes(''); fetchAll(); }
    setSaving(false);
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  const totalAvailable = grants.reduce((sum, g) => sum + Number(g.available), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Bônus/Cashback</h1>
          <p className="text-sm text-muted-foreground">Saldo disponível: {totalAvailable}</p>
        </div>
        {catalog.length > 0 && (
          <Button size="sm" onClick={() => setDialogOpen(true)}><Plus className="mr-1 h-4 w-4" />Solicitar</Button>
        )}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Meus Bônus</CardTitle></CardHeader>
        <CardContent>
          {grants.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum bônus concedido.</p>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Item</TableHead><TableHead>Disponível</TableHead><TableHead>Expira</TableHead></TableRow></TableHeader>
              <TableBody>
                {grants.map(g => (
                  <TableRow key={g.id}>
                    <TableCell className="font-medium">{g.bonus_catalog?.name}</TableCell>
                    <TableCell>{g.available} {g.bonus_catalog?.unit}</TableCell>
                    <TableCell className="text-muted-foreground">{g.expires_at ? format(new Date(g.expires_at), 'dd/MM/yyyy') : '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

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
                  <TableRow key={r.id}>
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
