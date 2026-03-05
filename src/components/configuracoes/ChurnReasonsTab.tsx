import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Plus, Edit2, Loader2, GripVertical } from 'lucide-react';
import { toast } from 'sonner';

interface ChurnReason {
  id: string;
  name: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export function ChurnReasonsTab() {
  const [reasons, setReasons] = useState<ChurnReason[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<ChurnReason | null>(null);
  const [name, setName] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchReasons = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('churn_reasons')
      .select('*')
      .order('sort_order');
    setReasons((data as ChurnReason[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchReasons(); }, [fetchReasons]);

  const openNew = () => { setEditItem(null); setName(''); setIsActive(true); setDialogOpen(true); };
  const openEdit = (r: ChurnReason) => { setEditItem(r); setName(r.name); setIsActive(r.is_active); setDialogOpen(true); };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    if (editItem) {
      const { error } = await supabase.from('churn_reasons').update({ name, is_active: isActive } as any).eq('id', editItem.id);
      if (error) toast.error('Erro: ' + error.message); else toast.success('Motivo atualizado!');
    } else {
      const maxOrder = reasons.length > 0 ? Math.max(...reasons.map(r => r.sort_order)) + 1 : 0;
      const { error } = await supabase.from('churn_reasons').insert({ name, is_active: isActive, sort_order: maxOrder } as any);
      if (error) toast.error('Erro: ' + error.message); else toast.success('Motivo criado!');
    }
    setSaving(false);
    setDialogOpen(false);
    fetchReasons();
  };

  const toggleActive = async (r: ChurnReason) => {
    await supabase.from('churn_reasons').update({ is_active: !r.is_active } as any).eq('id', r.id);
    fetchReasons();
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{reasons.length} motivo{reasons.length !== 1 ? 's' : ''} cadastrado{reasons.length !== 1 ? 's' : ''}</p>
        <Button size="sm" onClick={openNew}><Plus className="mr-1 h-4 w-4" />Novo Motivo</Button>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10"></TableHead>
              <TableHead>Nome</TableHead>
              <TableHead className="w-20">Ativo</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {reasons.map(r => (
              <TableRow key={r.id}>
                <TableCell><GripVertical className="h-4 w-4 text-muted-foreground/50" /></TableCell>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell>
                  <Switch checked={r.is_active} onCheckedChange={() => toggleActive(r)} />
                </TableCell>
                <TableCell>
                  <Button size="sm" variant="ghost" onClick={() => openEdit(r)}><Edit2 className="h-4 w-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editItem ? 'Editar Motivo' : 'Novo Motivo de Churn'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input value={name} onChange={e => setName(e.target.value)} required placeholder="Ex: Insatisfação com o serviço" />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={isActive} onCheckedChange={setIsActive} />
              <Label>Ativo</Label>
            </div>
            <Button type="submit" className="w-full" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
