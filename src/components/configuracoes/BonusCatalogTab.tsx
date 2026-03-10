import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Loader2, Trash2, Edit2 } from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmDeleteDialog } from '@/components/shared/ConfirmDeleteDialog';

export function BonusCatalogTab() {
  const [items, setItems] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [unit, setUnit] = useState('unidade');
  const [validityDays, setValidityDays] = useState('90');
  const [visibleInPortal, setVisibleInPortal] = useState(true);
  const [requiresApproval, setRequiresApproval] = useState(true);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [cRes, pRes] = await Promise.all([
      supabase.from('bonus_catalog').select('*').order('name'),
      supabase.from('products').select('id, name').eq('is_active', true).order('name'),
    ]);
    setItems(cRes.data || []);
    setProducts(pRes.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const openNew = () => {
    setEditItem(null);
    setName(''); setUnit('unidade'); setValidityDays('90'); setVisibleInPortal(true); setRequiresApproval(true); setSelectedProductIds([]);
    setDialogOpen(true);
  };

  const openEdit = (item: any) => {
    setEditItem(item);
    setName(item.name); setUnit(item.unit); setValidityDays(String(item.default_validity_days || 90));
    setVisibleInPortal(item.visible_in_portal); setRequiresApproval(item.requires_approval);
    setSelectedProductIds(item.eligible_product_ids || []);
    setDialogOpen(true);
  };

  const toggleProduct = (pid: string) => {
    setSelectedProductIds(prev => prev.includes(pid) ? prev.filter(p => p !== pid) : [...prev, pid]);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    const payload = {
      name, unit,
      default_validity_days: parseInt(validityDays) || 90,
      visible_in_portal: visibleInPortal,
      requires_approval: requiresApproval,
      eligible_product_ids: selectedProductIds,
    };
    if (editItem) {
      const { error } = await supabase.from('bonus_catalog').update(payload).eq('id', editItem.id);
      if (error) toast.error('Erro: ' + error.message); else toast.success('Item atualizado!');
    } else {
      const { error } = await supabase.from('bonus_catalog').insert(payload);
      if (error) toast.error('Erro: ' + error.message); else toast.success('Item criado!');
    }
    setSaving(false); setDialogOpen(false); fetchAll();
  };

  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('bonus_catalog').delete().eq('id', id);
    if (error) toast.error('Erro: ' + error.message); else { toast.success('Item removido!'); fetchAll(); }
    setDeleteId(null);
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{items.length} ite{items.length !== 1 ? 'ns' : 'm'} no catálogo</p>
        <Button size="sm" onClick={openNew}><Plus className="mr-1 h-4 w-4" />Novo Item</Button>
      </div>

      {items.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">Nenhum item no catálogo de bônus.</CardContent></Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead><TableHead>Unidade</TableHead><TableHead>Validade</TableHead>
                <TableHead>Portal</TableHead><TableHead>Aprovação</TableHead><TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map(item => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell className="text-muted-foreground">{item.unit}</TableCell>
                  <TableCell className="text-muted-foreground">{item.default_validity_days} dias</TableCell>
                  <TableCell>{item.visible_in_portal ? <Badge variant="default">Sim</Badge> : <Badge variant="secondary">Não</Badge>}</TableCell>
                  <TableCell>{item.requires_approval ? <Badge variant="default">Sim</Badge> : <Badge variant="secondary">Não</Badge>}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(item)}><Edit2 className="h-4 w-4" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => setDeleteId(item.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editItem ? 'Editar Item' : 'Novo Item do Catálogo'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2"><Label>Nome *</Label><Input value={name} onChange={e => setName(e.target.value)} required /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Unidade</Label><Input value={unit} onChange={e => setUnit(e.target.value)} /></div>
              <div className="space-y-2"><Label>Validade (dias)</Label><Input type="number" value={validityDays} onChange={e => setValidityDays(e.target.value)} /></div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2"><Switch checked={visibleInPortal} onCheckedChange={setVisibleInPortal} /><Label>Visível no portal</Label></div>
              <div className="flex items-center gap-2"><Switch checked={requiresApproval} onCheckedChange={setRequiresApproval} /><Label>Requer aprovação</Label></div>
            </div>
            <div className="space-y-2">
              <Label>Produtos elegíveis</Label>
              <div className="flex flex-wrap gap-2">
                {products.map(p => (
                  <Badge key={p.id} variant={selectedProductIds.includes(p.id) ? 'default' : 'outline'} className="cursor-pointer" onClick={() => toggleProduct(p.id)}>
                    {p.name}
                  </Badge>
                ))}
              </div>
              {products.length === 0 && <p className="text-xs text-muted-foreground">Nenhum produto ativo.</p>}
            </div>
            <Button type="submit" className="w-full" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
          </form>
        </DialogContent>
      </Dialog>
      <ConfirmDeleteDialog open={!!deleteId} onOpenChange={o => !o && setDeleteId(null)} onConfirm={() => deleteId && handleDelete(deleteId)} title="Remover item" description="Tem certeza que deseja remover este item do catálogo?" />
    </div>
  );
}
