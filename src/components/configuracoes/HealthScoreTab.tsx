import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Loader2, Trash2, Edit2, Heart, AlertTriangle, BookOpen } from 'lucide-react';
import { toast } from 'sonner';

export function HealthScoreTab() {
  const [products, setProducts] = useState<any[]>([]);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from('products').select('id, name').eq('is_active', true).order('name')
      .then(({ data }) => {
        const prods = data || [];
        setProducts(prods);
        if (prods.length > 0) setSelectedProduct(prods[0].id);
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Select value={selectedProduct} onValueChange={setSelectedProduct}>
          <SelectTrigger className="w-[220px]"><SelectValue placeholder="Produto" /></SelectTrigger>
          <SelectContent>
            {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {selectedProduct && (
        <Tabs defaultValue="pillars" className="space-y-4">
          <TabsList>
            <TabsTrigger value="pillars" className="gap-1"><Heart className="h-3.5 w-3.5" />Pilares</TabsTrigger>
            <TabsTrigger value="overrides" className="gap-1"><AlertTriangle className="h-3.5 w-3.5" />Overrides</TabsTrigger>
            <TabsTrigger value="playbooks" className="gap-1"><BookOpen className="h-3.5 w-3.5" />Playbooks</TabsTrigger>
          </TabsList>
          <TabsContent value="pillars"><PillarsSection productId={selectedProduct} /></TabsContent>
          <TabsContent value="overrides"><OverridesSection productId={selectedProduct} /></TabsContent>
          <TabsContent value="playbooks"><PlaybooksSection productId={selectedProduct} /></TabsContent>
        </Tabs>
      )}
    </div>
  );
}

// ─── Pillars + Indicators ─────────────────────────────────
function PillarsSection({ productId }: { productId: string }) {
  const [pillars, setPillars] = useState<any[]>([]);
  const [indicators, setIndicators] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editPillar, setEditPillar] = useState<any>(null);
  const [name, setName] = useState('');
  const [weight, setWeight] = useState('');
  const [position, setPosition] = useState('');
  const [saving, setSaving] = useState(false);
  // Indicator dialog
  const [indDialogOpen, setIndDialogOpen] = useState(false);
  const [editInd, setEditInd] = useState<any>(null);
  const [indPillarId, setIndPillarId] = useState('');
  const [indName, setIndName] = useState('');
  const [indWeight, setIndWeight] = useState('');
  const [indSource, setIndSource] = useState('');
  const [indKey, setIndKey] = useState('');

  const fetch = useCallback(async () => {
    setLoading(true);
    const [pRes, iRes] = await Promise.all([
      supabase.from('health_pillars').select('*').eq('product_id', productId).order('position'),
      supabase.from('health_indicators').select('*').in('pillar_id',
        (await supabase.from('health_pillars').select('id').eq('product_id', productId)).data?.map(p => p.id) || ['__none__']
      ),
    ]);
    setPillars(pRes.data || []);
    setIndicators(iRes.data || []);
    setLoading(false);
  }, [productId]);

  useEffect(() => { fetch(); }, [fetch]);

  const openNewPillar = () => { setEditPillar(null); setName(''); setWeight(''); setPosition(String(pillars.length)); setDialogOpen(true); };
  const openEditPillar = (p: any) => { setEditPillar(p); setName(p.name); setWeight(String(p.weight)); setPosition(String(p.position)); setDialogOpen(true); };

  const savePillar = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    const payload = { name, weight: parseFloat(weight) || 0, position: parseInt(position) || 0, product_id: productId };
    if (editPillar) {
      await supabase.from('health_pillars').update(payload).eq('id', editPillar.id);
      toast.success('Pilar atualizado!');
    } else {
      await supabase.from('health_pillars').insert(payload);
      toast.success('Pilar criado!');
    }
    setSaving(false); setDialogOpen(false); fetch();
  };

  const deletePillar = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja remover este pilar e todos os seus indicadores?')) return;
    await supabase.from('health_pillars').delete().eq('id', id);
    toast.success('Pilar removido!'); fetch();
  };

  const openNewInd = (pillarId: string) => { setEditInd(null); setIndPillarId(pillarId); setIndName(''); setIndWeight(''); setIndSource(''); setIndKey(''); setIndDialogOpen(true); };
  const openEditInd = (ind: any) => { setEditInd(ind); setIndPillarId(ind.pillar_id); setIndName(ind.name); setIndWeight(String(ind.weight)); setIndSource(ind.data_source || ''); setIndKey(ind.data_key || ''); setIndDialogOpen(true); };

  const saveInd = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    const payload = { name: indName, weight: parseFloat(indWeight) || 0, pillar_id: indPillarId, data_source: indSource || null, data_key: indKey || null };
    if (editInd) {
      await supabase.from('health_indicators').update(payload).eq('id', editInd.id);
      toast.success('Indicador atualizado!');
    } else {
      await supabase.from('health_indicators').insert(payload);
      toast.success('Indicador criado!');
    }
    setSaving(false); setIndDialogOpen(false); fetch();
  };

  const deleteInd = async (id: string) => {
    await supabase.from('health_indicators').delete().eq('id', id);
    toast.success('Indicador removido!'); fetch();
  };

  if (loading) return <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;

  const totalWeight = pillars.reduce((s, p) => s + Number(p.weight), 0);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <p className="text-sm text-muted-foreground">{pillars.length} pilar(es)</p>
          <Badge variant={totalWeight === 100 ? 'default' : 'destructive'} className="text-xs">
            Peso total: {totalWeight}%
          </Badge>
        </div>
        <Button size="sm" onClick={openNewPillar}><Plus className="mr-1 h-4 w-4" />Novo Pilar</Button>
      </div>

      {pillars.map(pillar => {
        const inds = indicators.filter(i => i.pillar_id === pillar.id);
        const indTotalWeight = inds.reduce((s, i) => s + Number(i.weight), 0);
        return (
          <Card key={pillar.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">{pillar.name} — Peso: {pillar.weight}%</CardTitle>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => openEditPillar(pillar)}><Edit2 className="h-4 w-4" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => deletePillar(pillar.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-center mb-2">
                <Badge variant={indTotalWeight === 100 ? 'secondary' : 'destructive'} className="text-xs">
                  Indicadores: {indTotalWeight}%
                </Badge>
                <Button size="sm" variant="outline" onClick={() => openNewInd(pillar.id)}>
                  <Plus className="mr-1 h-3 w-3" />Indicador
                </Button>
              </div>
              {inds.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhum indicador</p>
              ) : (
                <Table>
                  <TableHeader><TableRow>
                    <TableHead className="text-xs">Indicador</TableHead>
                    <TableHead className="text-xs">Peso</TableHead>
                    <TableHead className="text-xs">Fonte</TableHead>
                    <TableHead className="text-xs">Chave</TableHead>
                    <TableHead></TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {inds.map(ind => (
                      <TableRow key={ind.id}>
                        <TableCell className="text-sm">{ind.name}</TableCell>
                        <TableCell className="text-sm">{ind.weight}%</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{ind.data_source || '—'}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{ind.data_key || '—'}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" onClick={() => openEditInd(ind)}><Edit2 className="h-3 w-3" /></Button>
                            <Button size="sm" variant="ghost" onClick={() => deleteInd(ind.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        );
      })}

      {/* Pillar dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editPillar ? 'Editar Pilar' : 'Novo Pilar'}</DialogTitle></DialogHeader>
          <form onSubmit={savePillar} className="space-y-4">
            <div className="space-y-2"><Label>Nome *</Label><Input value={name} onChange={e => setName(e.target.value)} required /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Peso (%)</Label><Input type="number" value={weight} onChange={e => setWeight(e.target.value)} /></div>
              <div className="space-y-2"><Label>Posição</Label><Input type="number" value={position} onChange={e => setPosition(e.target.value)} /></div>
            </div>
            <Button type="submit" className="w-full" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Indicator dialog */}
      <Dialog open={indDialogOpen} onOpenChange={setIndDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editInd ? 'Editar Indicador' : 'Novo Indicador'}</DialogTitle></DialogHeader>
          <form onSubmit={saveInd} className="space-y-4">
            <div className="space-y-2"><Label>Nome *</Label><Input value={indName} onChange={e => setIndName(e.target.value)} required /></div>
            <div className="space-y-2"><Label>Peso (%)</Label><Input type="number" value={indWeight} onChange={e => setIndWeight(e.target.value)} /></div>
            <div className="space-y-2"><Label>Fonte de dados</Label><Input value={indSource} onChange={e => setIndSource(e.target.value)} placeholder="ex: form_submission, meetings" /></div>
            <div className="space-y-2"><Label>Chave do dado</Label><Input value={indKey} onChange={e => setIndKey(e.target.value)} placeholder="ex: nps_score, satisfaction" /></div>
            <Button type="submit" className="w-full" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Overrides ────────────────────────────────────────────
function OverridesSection({ productId }: { productId: string }) {
  const [overrides, setOverrides] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [edit, setEdit] = useState<any>(null);
  const [conditionType, setConditionType] = useState('');
  const [threshold, setThreshold] = useState('');
  const [action, setAction] = useState('force_red');
  const [reductionPoints, setReductionPoints] = useState('');
  const [saving, setSaving] = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('health_overrides').select('*').eq('product_id', productId);
    setOverrides(data || []);
    setLoading(false);
  }, [productId]);

  useEffect(() => { fetch(); }, [fetch]);

  const openNew = () => { setEdit(null); setConditionType(''); setThreshold(''); setAction('force_red'); setReductionPoints(''); setDialogOpen(true); };
  const openEdit = (o: any) => { setEdit(o); setConditionType(o.condition_type); setThreshold(String(o.threshold)); setAction(o.action); setReductionPoints(String(o.reduction_points || '')); setDialogOpen(true); };

  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    const payload = { product_id: productId, condition_type: conditionType, threshold: parseFloat(threshold) || 0, action: action as any, reduction_points: parseFloat(reductionPoints) || 0 };
    if (edit) { await supabase.from('health_overrides').update(payload).eq('id', edit.id); }
    else { await supabase.from('health_overrides').insert(payload); }
    toast.success(edit ? 'Override atualizado!' : 'Override criado!');
    setSaving(false); setDialogOpen(false); fetch();
  };

  const remove = async (id: string) => { await supabase.from('health_overrides').delete().eq('id', id); toast.success('Removido!'); fetch(); };

  if (loading) return <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;

  const conditionLabels: Record<string, string> = {
    installments_overdue: 'Parcelas vencidas >=',
    days_without_meeting: 'Dias sem reunião >=',
    days_without_perception: 'Dias sem percepção >=',
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{overrides.length} override(s)</p>
        <Button size="sm" onClick={openNew}><Plus className="mr-1 h-4 w-4" />Novo Override</Button>
      </div>
      {overrides.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">Nenhum override configurado.</CardContent></Card>
      ) : (
        <Card>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Condição</TableHead><TableHead>Threshold</TableHead><TableHead>Ação</TableHead><TableHead>Redução</TableHead><TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {overrides.map(o => (
                <TableRow key={o.id}>
                  <TableCell className="text-sm">{conditionLabels[o.condition_type] || o.condition_type}</TableCell>
                  <TableCell>{o.threshold}</TableCell>
                  <TableCell><Badge variant={o.action === 'force_red' ? 'destructive' : 'secondary'}>{o.action === 'force_red' ? 'Forçar Vermelho' : 'Reduzir Score'}</Badge></TableCell>
                  <TableCell>{o.action === 'reduce_score' ? `${o.reduction_points} pts` : '—'}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(o)}><Edit2 className="h-4 w-4" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => remove(o.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
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
          <DialogHeader><DialogTitle>{edit ? 'Editar Override' : 'Novo Override'}</DialogTitle></DialogHeader>
          <form onSubmit={save} className="space-y-4">
            <div className="space-y-2">
              <Label>Condição</Label>
              <Select value={conditionType} onValueChange={setConditionType}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="installments_overdue">Parcelas vencidas</SelectItem>
                  <SelectItem value="days_without_meeting">Dias sem reunião</SelectItem>
                  <SelectItem value="days_without_perception">Dias sem percepção</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Threshold</Label><Input type="number" value={threshold} onChange={e => setThreshold(e.target.value)} /></div>
            <div className="space-y-2">
              <Label>Ação</Label>
              <Select value={action} onValueChange={setAction}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="force_red">Forçar Vermelho</SelectItem>
                  <SelectItem value="reduce_score">Reduzir Score</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {action === 'reduce_score' && (
              <div className="space-y-2"><Label>Pontos de redução</Label><Input type="number" value={reductionPoints} onChange={e => setReductionPoints(e.target.value)} /></div>
            )}
            <Button type="submit" className="w-full" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Playbooks ────────────────────────────────────────────
function PlaybooksSection({ productId }: { productId: string }) {
  const [playbooks, setPlaybooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [edit, setEdit] = useState<any>(null);
  const [band, setBand] = useState('red');
  const [actTitle, setActTitle] = useState('');
  const [actType, setActType] = useState('task');
  const [actDays, setActDays] = useState('');
  const [saving, setSaving] = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('health_playbooks').select('*').eq('product_id', productId);
    setPlaybooks(data || []);
    setLoading(false);
  }, [productId]);

  useEffect(() => { fetch(); }, [fetch]);

  const openNew = () => { setEdit(null); setBand('red'); setActTitle(''); setActType('task'); setActDays('3'); setDialogOpen(true); };

  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    const payload = { product_id: productId, band: band as any, activity_template: { title: actTitle, type: actType, due_days: parseInt(actDays) || 3 } };
    if (edit) { await supabase.from('health_playbooks').update(payload).eq('id', edit.id); }
    else { await supabase.from('health_playbooks').insert(payload); }
    toast.success(edit ? 'Playbook atualizado!' : 'Playbook criado!');
    setSaving(false); setDialogOpen(false); fetch();
  };

  const remove = async (id: string) => { await supabase.from('health_playbooks').delete().eq('id', id); toast.success('Removido!'); fetch(); };

  if (loading) return <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;

  const bandLabels: Record<string, string> = { red: 'Vermelho', yellow: 'Amarelo', green: 'Verde' };
  const bandColors: Record<string, string> = { red: 'destructive', yellow: 'secondary', green: 'default' };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{playbooks.length} playbook(s)</p>
        <Button size="sm" onClick={openNew}><Plus className="mr-1 h-4 w-4" />Novo Playbook</Button>
      </div>
      {playbooks.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">Nenhum playbook configurado.</CardContent></Card>
      ) : (
        <Card>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Faixa</TableHead><TableHead>Atividade</TableHead><TableHead>Tipo</TableHead><TableHead>Prazo</TableHead><TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {playbooks.map(p => {
                const tpl = p.activity_template as any || {};
                return (
                  <TableRow key={p.id}>
                    <TableCell><Badge variant={bandColors[p.band] as any}>{bandLabels[p.band]}</Badge></TableCell>
                    <TableCell className="text-sm">{tpl.title || '—'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{tpl.type || '—'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{tpl.due_days ? `${tpl.due_days} dias` : '—'}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" onClick={() => remove(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo Playbook</DialogTitle></DialogHeader>
          <form onSubmit={save} className="space-y-4">
            <div className="space-y-2">
              <Label>Faixa</Label>
              <Select value={band} onValueChange={setBand}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="red">Vermelho (0-39)</SelectItem>
                  <SelectItem value="yellow">Amarelo (40-69)</SelectItem>
                  <SelectItem value="green">Verde (70-100)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Título da atividade</Label><Input value={actTitle} onChange={e => setActTitle(e.target.value)} required /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={actType} onValueChange={setActType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="task">Tarefa</SelectItem>
                    <SelectItem value="follow_up">Follow-up</SelectItem>
                    <SelectItem value="onboarding">Onboarding</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Prazo (dias)</Label><Input type="number" value={actDays} onChange={e => setActDays(e.target.value)} /></div>
            </div>
            <Button type="submit" className="w-full" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
