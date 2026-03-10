import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileText, ClipboardEdit, Link2, Globe } from 'lucide-react';
import { toast } from 'sonner';
import { FormFillDialog } from '@/components/reunioes/FormFillDialog';

interface FormTemplate {
  id: string;
  name: string;
  form_type: string;
  form_hash: string | null;
  product_id: string | null;
  fields: any[];
  sections: any[];
  is_published: boolean;
}

export default function Formularios() {
  const [templates, setTemplates] = useState<FormTemplate[]>([]);
  const [products, setProducts] = useState<Record<string, string>>({});
  const [fillDialogOpen, setFillDialogOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | undefined>();

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const [{ data: tplData }, { data: prodData }] = await Promise.all([
      supabase.from('form_templates').select('*').eq('is_active', true).order('name'),
      supabase.from('products').select('id, name').eq('is_active', true),
    ]);
    setTemplates((tplData as any[]) || []);
    const pm: Record<string, string> = {};
    (prodData || []).forEach((p: any) => { pm[p.id] = p.name; });
    setProducts(pm);
  };

  const handleFill = (templateId: string) => {
    setSelectedTemplateId(templateId);
    setFillDialogOpen(true);
  };

  const internalForms = templates.filter(t => t.form_type !== 'external');
  const externalForms = templates.filter(t => t.form_type === 'external');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Formulários</h1>
        <p className="text-sm text-muted-foreground">Preencha formulários para seus clientes ou copie links de formulários externos.</p>
      </div>

      {/* Internal forms - fill directly */}
      {internalForms.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Formulários internos</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {internalForms.map(t => (
              <Card key={t.id} className="hover:shadow-sm transition-shadow">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <p className="font-medium text-sm">{t.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {t.product_id ? products[t.product_id] || '—' : 'Todos os produtos'} · {Array.isArray(t.fields) ? t.fields.length : 0} campos
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs shrink-0">📋 Interno</Badge>
                  </div>
                  <Button size="sm" className="w-full" onClick={() => handleFill(t.id)}>
                    <ClipboardEdit className="h-4 w-4 mr-1" /> Preencher
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* External forms - copy link */}
      {externalForms.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Formulários externos</h2>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {externalForms.map(t => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium text-sm">{t.name}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {t.product_id ? products[t.product_id] || '—' : 'Todos'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={t.is_published ? 'default' : 'secondary'} className="text-xs">
                        {t.is_published ? <><Globe className="h-3 w-3 mr-1" />Publicado</> : 'Rascunho'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {t.form_hash ? (
                        <Button size="sm" variant="outline" onClick={() => {
                          navigator.clipboard.writeText(`${window.location.origin}/forms/${t.form_hash}`);
                          toast.success('Link copiado!');
                        }}>
                          <Link2 className="h-4 w-4 mr-1" /> Copiar link
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">Sem link</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </div>
      )}

      {templates.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center space-y-3">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground/30" />
            <p className="text-muted-foreground">Nenhum formulário ativo encontrado</p>
            <p className="text-xs text-muted-foreground">Crie formulários em Configurações → Formulários</p>
          </CardContent>
        </Card>
      )}

      <FormFillDialog
        open={fillDialogOpen}
        onOpenChange={setFillDialogOpen}
        templateId={selectedTemplateId}
        onSubmitted={() => { setFillDialogOpen(false); toast.success('Formulário enviado!'); }}
      />
    </div>
  );
}
