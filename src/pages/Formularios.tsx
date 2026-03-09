import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FormFillDialog } from '@/components/reunioes/FormFillDialog';
import { FileText, Eye, Link2, ClipboardList, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface FormTemplate {
  id: string;
  name: string;
  description: string | null;
  form_type: string;
  fields: any[];
  form_hash: string | null;
  product_id: string | null;
}

interface Submission {
  id: string;
  submitted_at: string;
  template_id: string;
  office_id: string;
  user_id: string | null;
  data: Record<string, any>;
}

export default function Formularios() {
  const { session, role } = useAuth();
  const [templates, setTemplates] = useState<FormTemplate[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [offices, setOffices] = useState<Record<string, string>>({});
  const [profiles, setProfiles] = useState<Record<string, string>>({});

  // Fill dialog state
  const [fillOpen, setFillOpen] = useState(false);
  const [fillTemplateId, setFillTemplateId] = useState<string | undefined>();

  // View submission drawer
  const [viewSubmission, setViewSubmission] = useState<Submission | null>(null);
  const [viewTemplate, setViewTemplate] = useState<FormTemplate | null>(null);

  const isViewer = role === 'viewer';
  const canFill = !isViewer;

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [{ data: tplData }, { data: subData }, { data: offData }, { data: profData }] = await Promise.all([
      supabase.from('form_templates').select('id, name, description, form_type, fields, form_hash, product_id').eq('is_active', true),
      supabase.from('form_submissions').select('id, submitted_at, template_id, office_id, user_id, data').order('submitted_at', { ascending: false }).limit(50),
      supabase.from('offices').select('id, name'),
      supabase.from('profiles').select('id, full_name'),
    ]);

    setTemplates((tplData as any[]) || []);
    setSubmissions((subData as any[]) || []);

    const offMap: Record<string, string> = {};
    (offData || []).forEach((o: any) => { offMap[o.id] = o.name; });
    setOffices(offMap);

    const profMap: Record<string, string> = {};
    (profData || []).forEach((p: any) => { profMap[p.id] = p.full_name; });
    setProfiles(profMap);
  };

  const internalTemplates = templates.filter(t => (t.form_type || 'internal') === 'internal');
  const externalTemplates = templates.filter(t => t.form_type === 'external');

  const handleCopyLink = (hash: string | null) => {
    if (!hash) {
      toast.error('Formulário sem link público');
      return;
    }
    const url = `${window.location.origin}/forms/${hash}`;
    navigator.clipboard.writeText(url);
    toast.success('Link copiado!');
  };

  const openViewSubmission = (sub: Submission) => {
    const tpl = templates.find(t => t.id === sub.template_id);
    setViewTemplate(tpl || null);
    setViewSubmission(sub);
  };

  const tplMap = useMemo(() => {
    const m: Record<string, FormTemplate> = {};
    templates.forEach(t => { m[t.id] = t; });
    return m;
  }, [templates]);

  return (
    <div className="space-y-8">
      {/* Available forms */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Formulários disponíveis</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {internalTemplates.map(t => (
            <Card key={t.id} className="flex flex-col">
              <CardContent className="flex-1 pt-5 pb-4 space-y-2">
                <div className="flex items-start gap-2">
                  <ClipboardList className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <h3 className="font-medium text-sm leading-tight">{t.name}</h3>
                    {t.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{t.description}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="text-[10px]">Interno</Badge>
                  <span className="text-[10px] text-muted-foreground">{Array.isArray(t.fields) ? t.fields.length : 0} campos</span>
                </div>
                {canFill && (
                  <Button
                    size="sm" className="w-full mt-2"
                    onClick={() => { setFillTemplateId(t.id); setFillOpen(true); }}
                  >
                    Preencher →
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}

          {externalTemplates.map(t => (
            <Card key={t.id} className="flex flex-col">
              <CardContent className="flex-1 pt-5 pb-4 space-y-2">
                <div className="flex items-start gap-2">
                  <ExternalLink className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <h3 className="font-medium text-sm leading-tight">{t.name}</h3>
                    {t.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{t.description}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="secondary" className="text-[10px]">Externo</Badge>
                  <span className="text-[10px] text-muted-foreground">{Array.isArray(t.fields) ? t.fields.length : 0} campos</span>
                </div>
                <Button
                  size="sm" variant="outline" className="w-full mt-2"
                  onClick={() => handleCopyLink(t.form_hash)}
                >
                  <Link2 className="h-3.5 w-3.5 mr-1" /> Copiar link
                </Button>
              </CardContent>
            </Card>
          ))}

          {templates.length === 0 && (
            <div className="col-span-full text-center py-8 text-muted-foreground text-sm">
              Nenhum formulário disponível
            </div>
          )}
        </div>
      </section>

      {/* Recent submissions */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Últimos preenchimentos</h2>
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Formulário</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>CSM</TableHead>
                  <TableHead className="w-12">Ver</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {submissions.map(s => (
                  <TableRow key={s.id}>
                    <TableCell className="text-sm">{format(new Date(s.submitted_at), 'dd/MM/yy')}</TableCell>
                    <TableCell className="text-sm">{tplMap[s.template_id]?.name || '—'}</TableCell>
                    <TableCell className="text-sm">{offices[s.office_id] || '—'}</TableCell>
                    <TableCell className="text-sm">{s.user_id ? profiles[s.user_id] || '—' : '—'}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" onClick={() => openViewSubmission(s)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {submissions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-6 text-muted-foreground text-sm">
                      Nenhum preenchimento encontrado
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>

      {/* Fill dialog */}
      <FormFillDialog
        open={fillOpen}
        onOpenChange={setFillOpen}
        templateId={fillTemplateId}
        onSubmitted={loadData}
      />

      {/* View submission drawer */}
      <Sheet open={!!viewSubmission} onOpenChange={open => { if (!open) setViewSubmission(null); }}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{viewTemplate?.name || 'Submissão'}</SheetTitle>
            {viewSubmission && (
              <p className="text-xs text-muted-foreground">
                {offices[viewSubmission.office_id] || '—'} • {viewSubmission.user_id ? profiles[viewSubmission.user_id] || '' : ''} • {format(new Date(viewSubmission.submitted_at), 'dd/MM/yyyy HH:mm')}
              </p>
            )}
          </SheetHeader>
          <div className="mt-6 space-y-4">
            {viewTemplate && viewSubmission && (Array.isArray(viewTemplate.fields) ? viewTemplate.fields : [])
              .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0))
              .map((field: any) => {
                const value = viewSubmission.data[field.id];
                const hasMapped = field.header_mapping?.enabled && field.header_mapping?.target_field;
                return (
                  <div key={field.id} className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Label className="text-xs font-medium text-muted-foreground">{field.label}</Label>
                      {hasMapped && <Badge variant="outline" className="text-[9px]">Mapeado</Badge>}
                    </div>
                    <p className="text-sm">
                      {value === null || value === undefined || value === '' ? (
                        <span className="text-muted-foreground italic">—</span>
                      ) : typeof value === 'boolean' ? (
                        value ? 'Sim ✅' : 'Não ❌'
                      ) : Array.isArray(value) ? (
                        value.join(', ')
                      ) : (
                        String(value)
                      )}
                    </p>
                  </div>
                );
              })}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return <label className={className}>{children}</label>;
}
