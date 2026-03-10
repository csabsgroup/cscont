import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Eye } from 'lucide-react';
import { format } from 'date-fns';
import type { FormFieldDef } from './FormFieldRenderer';

interface Props {
  templateId: string;
  fields: FormFieldDef[];
}

interface Submission {
  id: string;
  submitted_at: string;
  office_id: string;
  user_id: string | null;
  data: Record<string, any>;
}

export function FormBuilderResponses({ templateId, fields }: Props) {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [offices, setOffices] = useState<Record<string, string>>({});
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [viewSub, setViewSub] = useState<Submission | null>(null);

  useEffect(() => {
    if (!templateId) return;
    Promise.all([
      supabase.from('form_submissions').select('id, submitted_at, office_id, user_id, data')
        .eq('template_id', templateId).order('submitted_at', { ascending: false }).limit(100),
      supabase.from('offices').select('id, name'),
      supabase.from('profiles').select('id, full_name'),
    ]).then(([{ data: subs }, { data: offs }, { data: profs }]) => {
      setSubmissions((subs as any[]) || []);
      const om: Record<string, string> = {};
      (offs || []).forEach((o: any) => { om[o.id] = o.name; });
      setOffices(om);
      const pm: Record<string, string> = {};
      (profs || []).forEach((p: any) => { pm[p.id] = p.full_name; });
      setProfiles(pm);
    });
  }, [templateId]);

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <p className="text-sm text-muted-foreground">{submissions.length} resposta{submissions.length !== 1 ? 's' : ''}</p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Data</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>CSM</TableHead>
            <TableHead className="w-12"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {submissions.map(s => (
            <TableRow key={s.id}>
              <TableCell className="text-sm">{format(new Date(s.submitted_at), 'dd/MM/yy HH:mm')}</TableCell>
              <TableCell className="text-sm">{offices[s.office_id] || '—'}</TableCell>
              <TableCell className="text-sm">{s.user_id ? profiles[s.user_id] || '—' : '—'}</TableCell>
              <TableCell>
                <Button size="sm" variant="ghost" onClick={() => setViewSub(s)}>
                  <Eye className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {submissions.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="text-center py-8 text-muted-foreground text-sm">
                Nenhuma resposta ainda
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {/* View submission drawer */}
      <Sheet open={!!viewSub} onOpenChange={open => { if (!open) setViewSub(null); }}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Resposta</SheetTitle>
            {viewSub && (
              <p className="text-xs text-muted-foreground">
                {offices[viewSub.office_id] || '—'} • {viewSub.user_id ? profiles[viewSub.user_id] || '' : ''} • {format(new Date(viewSub.submitted_at), 'dd/MM/yyyy HH:mm')}
              </p>
            )}
          </SheetHeader>
          <div className="mt-6 space-y-4">
            {viewSub && fields.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map(field => {
              const val = viewSub.data[field.id];
              return (
                <div key={field.id} className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">{field.label}</label>
                  <p className="text-sm">
                    {val === null || val === undefined || val === '' ? (
                      <span className="text-muted-foreground italic">—</span>
                    ) : typeof val === 'boolean' ? (
                      val ? 'Sim ✅' : 'Não ❌'
                    ) : Array.isArray(val) ? (
                      val.join(', ')
                    ) : typeof val === 'object' ? (
                      JSON.stringify(val)
                    ) : (
                      String(val)
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
