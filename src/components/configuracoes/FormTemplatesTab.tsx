import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Plus, Edit2, Copy, Trash2, Link2, Globe, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmDeleteDialog } from '@/components/shared/ConfirmDeleteDialog';

export function FormTemplatesTab() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [templates, setTemplates] = useState<any[]>([]);
  const [products, setProducts] = useState<Record<string, string>>({});

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const [{ data: tplData }, { data: prodData }] = await Promise.all([
      supabase.from('form_templates').select('*').order('name'),
      supabase.from('products').select('id, name').eq('is_active', true),
    ]);
    setTemplates((tplData as any[]) || []);
    const pm: Record<string, string> = {};
    (prodData || []).forEach((p: any) => { pm[p.id] = p.name; });
    setProducts(pm);
  };

  const handleDuplicate = async (t: any) => {
    if (!session?.user?.id) return;
    const { error } = await supabase.from('form_templates').insert({
      name: t.name + ' (cópia)',
      type: t.type,
      form_type: t.form_type || 'internal',
      product_id: t.product_id,
      fields: t.fields,
      sections: t.sections || [],
      post_actions: t.post_actions,
      settings: t.settings || {},
      theme: t.theme || {},
      description: t.description || null,
      is_active: true,
      is_published: false,
      form_hash: t.form_type === 'external' ? crypto.randomUUID().replace(/-/g, '').slice(0, 16) : null,
      created_by: session.user.id,
    } as any);
    if (error) toast.error('Erro: ' + error.message);
    else { toast.success('Duplicado!'); loadData(); }
  };

  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('form_templates').delete().eq('id', id);
    if (error) toast.error('Erro: ' + error.message);
    else { toast.success('Removido!'); loadData(); }
    setDeleteId(null);
  };

  const handleToggle = async (id: string, current: boolean) => {
    const { error } = await supabase.from('form_templates').update({ is_active: !current } as any).eq('id', id);
    if (error) toast.error('Erro: ' + error.message);
    else loadData();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{templates.length} formulário{templates.length !== 1 ? 's' : ''}</p>
        <Button size="sm" onClick={() => navigate('/formularios/builder/new')}>
          <Plus className="h-4 w-4 mr-1" /> Novo formulário
        </Button>
      </div>

      {templates.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center space-y-3">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground/30" />
            <p className="text-muted-foreground">Nenhum formulário criado</p>
            <Button variant="outline" onClick={() => navigate('/formularios/builder/new')}>Criar primeiro formulário</Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead>Campos</TableHead>
                <TableHead>Publicação</TableHead>
                <TableHead>Ativo</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map(t => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell>
                    <Badge variant={t.form_type === 'external' ? 'default' : 'outline'} className="text-xs">
                      {t.form_type === 'external' ? '📊 Externo' : '📋 Interno'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {t.product_id ? products[t.product_id] || '—' : 'Todos'}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{Array.isArray(t.fields) ? t.fields.length : 0}</TableCell>
                  <TableCell>
                    <Badge variant={t.is_published ? 'default' : 'secondary'} className="text-xs">
                      {t.is_published ? <><Globe className="h-3 w-3 mr-1" />Publicado</> : 'Rascunho'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Switch checked={t.is_active !== false} onCheckedChange={() => handleToggle(t.id, t.is_active !== false)} />
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => navigate(`/formularios/builder/${t.id}`)} title="Editar">
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDuplicate(t)} title="Duplicar">
                        <Copy className="h-4 w-4" />
                      </Button>
                      {t.form_type === 'external' && t.form_hash && (
                        <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/forms/${t.form_hash}`); toast.success('Link copiado!'); }} title="Link">
                          <Link2 className="h-4 w-4" />
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => setDeleteId(t.id)} title="Excluir">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
      <ConfirmDeleteDialog open={!!deleteId} onOpenChange={o => !o && setDeleteId(null)} onConfirm={() => deleteId && handleDelete(deleteId)} title="Excluir formulário" description="Tem certeza que deseja excluir este formulário?" />
    </div>
  );
}
