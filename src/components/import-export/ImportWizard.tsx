import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Upload, Download, CheckCircle2, AlertCircle, Loader2, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  EntityTemplate, autoMapColumns, validateRow, generateTemplateCSV,
  parseBoolean, parseDateBR,
} from '@/lib/import-templates';
import { parseUploadedFile, downloadCSV } from '@/lib/export-helpers';

interface ImportWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: EntityTemplate;
}

type Step = 'upload' | 'map' | 'validate' | 'execute';

export function ImportWizard({ open, onOpenChange, template }: ImportWizardProps) {
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>('upload');
  const [fileHeaders, setFileHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, any>[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<string[]>([]);
  const [validCount, setValidCount] = useState(0);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ success: number; errors: number; skipped: number; batchId?: string } | null>(null);

  const reset = () => {
    setStep('upload'); setFileHeaders([]); setRows([]); setMapping({});
    setErrors([]); setValidCount(0); setImporting(false); setProgress(0); setResult(null);
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('Arquivo muito grande. Máximo 5MB.'); return; }
    try {
      const parsed = await parseUploadedFile(file);
      if (parsed.rows.length > 5000) { toast.error('Máximo 5000 linhas.'); return; }
      setFileHeaders(parsed.headers);
      setRows(parsed.rows);
      const autoMap = autoMapColumns(parsed.headers, template.fields);
      setMapping(autoMap);
      setStep('map');
    } catch { toast.error('Erro ao ler o arquivo.'); }
  };

  const handleDownloadTemplate = () => {
    const csv = generateTemplateCSV(template);
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `template_${template.key}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleValidate = () => {
    const mappedRows = rows.map(row => {
      const mapped: Record<string, any> = {};
      for (const field of template.fields) {
        const fileCol = mapping[field.key];
        mapped[field.key] = fileCol ? row[fileCol] : '';
      }
      return mapped;
    });
    const allErrors: string[] = [];
    let valid = 0;
    mappedRows.forEach((row, i) => {
      const rowErrors = validateRow(row, template.fields, i);
      if (rowErrors.length === 0) valid++;
      allErrors.push(...rowErrors);
    });
    setErrors(allErrors);
    setValidCount(valid);
    setStep('validate');
  };

  const handleImport = async () => {
    setImporting(true); setProgress(0);
    const mappedRows = rows.map(row => {
      const mapped: Record<string, any> = {};
      for (const field of template.fields) {
        const fileCol = mapping[field.key];
        mapped[field.key] = fileCol ? row[fileCol] : '';
      }
      return mapped;
    }).filter((row, i) => {
      const rowErrors = validateRow(row, template.fields, i);
      return rowErrors.length === 0;
    });

    let success = 0, errorCount = 0, skipped = 0;
    const insertedIds: string[] = [];
    const chunkSize = 50;

    for (let i = 0; i < mappedRows.length; i += chunkSize) {
      const chunk = mappedRows.slice(i, i + chunkSize);
      for (const row of chunk) {
        try {
          const id = await insertRow(template, row);
          if (id) insertedIds.push(id);
          success++;
        } catch {
          errorCount++;
        }
      }
      setProgress(Math.round(((i + chunk.length) / mappedRows.length) * 100));
    }

    // Save batch for undo
    let batchId: string | undefined;
    if (user && insertedIds.length > 0) {
      const { data: batchData } = await supabase.from('import_batches' as any).insert({
        user_id: user.id,
        entity_type: template.key,
        table_name: template.table,
        record_ids: insertedIds,
        record_count: insertedIds.length,
      } as any).select('id').single();
      batchId = (batchData as any)?.id;
    }

    // Audit log
    if (user) {
      await supabase.from('audit_logs').insert({
        user_id: user.id,
        entity_type: template.table,
        action: 'bulk_import',
        details: { entity: template.key, success, errors: errorCount, skipped },
      });
    }

    setResult({ success, errors: errorCount, skipped, batchId });
    setStep('execute');
    setImporting(false);
  };

  const handleUndoImport = async () => {
    if (!result?.batchId) return;
    setImporting(true);
    try {
      const { data: batch } = await supabase.from('import_batches' as any)
        .select('*').eq('id', result.batchId).single();
      if (!batch) throw new Error('Batch not found');
      const ids = (batch as any).record_ids as string[];
      const chunkSize = 50;
      for (let i = 0; i < ids.length; i += chunkSize) {
        await supabase.from((batch as any).table_name as any).delete().in('id', ids.slice(i, i + chunkSize));
      }
      await supabase.from('import_batches' as any)
        .update({ undone_at: new Date().toISOString() } as any)
        .eq('id', result.batchId);
      if (user) {
        await supabase.from('audit_logs').insert({
          user_id: user.id,
          entity_type: template.table,
          action: 'undo_import',
          details: { batch_id: result.batchId, count: ids.length },
        });
      }
      toast.success('Importação desfeita com sucesso.');
      reset();
      onOpenChange(false);
    } catch {
      toast.error('Erro ao desfazer importação.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar {template.label}</DialogTitle>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-4">
            <div className="border-2 border-dashed border-border rounded-xl p-8 text-center space-y-3">
              <Upload className="h-10 w-10 mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Arraste um arquivo .csv ou .xlsx ou clique para selecionar</p>
              <Button variant="outline" onClick={() => fileRef.current?.click()}>Selecionar arquivo</Button>
              <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFile} />
            </div>
            <Button variant="ghost" size="sm" onClick={handleDownloadTemplate} className="gap-1.5">
              <Download className="h-4 w-4" />Baixar template
            </Button>
            <p className="text-xs text-muted-foreground">Máximo 5MB, 5000 linhas. Formatos: CSV, XLSX.</p>
          </div>
        )}

        {step === 'map' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{rows.length} linhas encontradas. Mapeie as colunas:</p>
            <div className="space-y-2">
              {template.fields.map(field => (
                <div key={field.key} className="flex items-center gap-3">
                  <span className="text-sm w-40 shrink-0">
                    {field.label} {field.required && <span className="text-destructive">*</span>}
                  </span>
                  <span className="text-muted-foreground">→</span>
                  <Select value={mapping[field.key] || ''} onValueChange={(v) => setMapping(prev => ({ ...prev, [field.key]: v }))}>
                    <SelectTrigger className="flex-1"><SelectValue placeholder="Selecionar coluna..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">— Não mapear —</SelectItem>
                      {fileHeaders.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep('upload')}>Voltar</Button>
              <Button onClick={handleValidate}>Validar</Button>
            </div>
          </div>
        )}

        {step === 'validate' && (
          <div className="space-y-4">
            <div className="flex gap-3">
              <Badge variant="default" className="gap-1"><CheckCircle2 className="h-3 w-3" />{validCount} válidas</Badge>
              <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" />{rows.length - validCount} com erro</Badge>
            </div>
            {errors.length > 0 && (
              <ScrollArea className="h-48 border rounded-lg p-3">
                <div className="space-y-1">
                  {errors.slice(0, 100).map((err, i) => (
                    <p key={i} className="text-xs text-destructive">{err}</p>
                  ))}
                  {errors.length > 100 && <p className="text-xs text-muted-foreground">...e mais {errors.length - 100} erros</p>}
                </div>
              </ScrollArea>
            )}
            <p className="text-sm">Serão importados <strong>{validCount}</strong> registros válidos. Linhas com erro serão ignoradas.</p>
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep('map')}>Voltar</Button>
              <Button onClick={handleImport} disabled={validCount === 0 || importing}>
                {importing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Importando...</> : 'Importar'}
              </Button>
            </div>
            {importing && <Progress value={progress} className="h-2" />}
          </div>
        )}

        {step === 'execute' && result && (
          <div className="space-y-4 text-center py-4">
            <CheckCircle2 className="h-12 w-12 mx-auto text-green-500" />
            <h3 className="text-lg font-semibold">Importação concluída</h3>
            <div className="flex justify-center gap-4 text-sm">
              <span className="text-green-600">{result.success} importados</span>
              {result.errors > 0 && <span className="text-destructive">{result.errors} erros</span>}
              {result.skipped > 0 && <span className="text-muted-foreground">{result.skipped} ignorados</span>}
            </div>
            <div className="flex justify-center gap-3">
              {result.batchId && (
                <Button variant="outline" onClick={handleUndoImport} disabled={importing} className="gap-1.5">
                  {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Undo2 className="h-4 w-4" />}
                  Desfazer importação
                </Button>
              )}
              <Button onClick={() => { reset(); onOpenChange(false); }}>Fechar</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

async function insertRow(template: EntityTemplate, row: Record<string, any>): Promise<string | null> {
  const t = template.key;

  if (t === 'offices') {
    let productId: string | null = null;
    if (row.product_name) {
      const { data } = await supabase.from('products').select('id').ilike('name', row.product_name.trim()).maybeSingle();
      productId = data?.id || null;
    }
    let csmId: string | null = null;
    if (row.csm_email) {
      const { data } = await supabase.from('profiles').select('id').ilike('full_name', `%${row.csm_email.trim().split('@')[0]}%`).maybeSingle();
      csmId = data?.id || null;
    }
    const { data, error } = await supabase.from('offices').insert({
      name: row.name,
      email: row.email,
      phone: row.phone || null,
      city: row.city || null,
      state: row.state || null,
      active_product_id: productId,
      csm_id: csmId,
      status: row.status as any,
      activation_date: parseDateBR(row.activation_date),
    }).select('id').single();
    if (error) throw error;
    return data?.id || null;
  } else if (t === 'contacts') {
    const { data: office } = await supabase.from('offices').select('id').ilike('name', row.office_name.trim()).maybeSingle();
    if (!office) throw new Error('Office not found');
    const { data, error } = await supabase.from('contacts').insert({
      office_id: office.id,
      name: row.name,
      role_title: row.role_title || null,
      email: row.email || null,
      phone: row.phone || null,
      instagram: row.instagram || null,
      birthday: parseDateBR(row.birthday),
      is_main_contact: parseBoolean(row.is_main_contact || 'sim'),
    }).select('id').single();
    if (error) throw error;
    return data?.id || null;
  } else if (t === 'contracts') {
    const { data: office } = await supabase.from('offices').select('id').ilike('name', row.office_name.trim()).maybeSingle();
    if (!office) throw new Error('Office not found');
    let productId: string | null = null;
    if (row.product_name) {
      const { data } = await supabase.from('products').select('id').ilike('name', row.product_name.trim()).maybeSingle();
      productId = data?.id || null;
    }
    if (!productId) throw new Error('Product not found');
    const { data, error } = await supabase.from('contracts').insert({
      office_id: office.id,
      product_id: productId,
      start_date: parseDateBR(row.start_date),
      end_date: parseDateBR(row.end_date),
      value: Number(row.value) || 0,
      monthly_value: Number(row.monthly_value) || 0,
      installments_total: Number(row.installments_total) || 0,
      installments_overdue: Number(row.installments_overdue) || 0,
      status: row.status as any,
    }).select('id').single();
    if (error) throw error;
    return data?.id || null;
  } else if (t === 'meetings') {
    const { data: office } = await supabase.from('offices').select('id').ilike('name', row.office_name.trim()).maybeSingle();
    if (!office) throw new Error('Office not found');
    let userId: string | null = null;
    if (row.csm_email) {
      const { data } = await supabase.from('profiles').select('id').ilike('full_name', `%${row.csm_email.trim().split('@')[0]}%`).maybeSingle();
      userId = data?.id || null;
    }
    if (!userId) throw new Error('User not found');
    const { data, error } = await supabase.from('meetings').insert({
      office_id: office.id,
      user_id: userId,
      title: row.title || 'Reunião importada',
      scheduled_at: parseDateBR(row.scheduled_at) || new Date().toISOString(),
      status: row.status as any,
      share_with_client: parseBoolean(row.share_with_client || 'nao'),
      notes: row.notes || null,
    }).select('id').single();
    if (error) throw error;
    return data?.id || null;
  } else if (t === 'nps_csat') {
    const { data: office } = await supabase.from('offices').select('id').ilike('name', row.office_name.trim()).maybeSingle();
    if (!office) throw new Error('Office not found');
    const { data: tmpl } = await supabase.from('form_templates').select('id').ilike('name', `%${row.survey_type}%`).maybeSingle();
    const templateId = tmpl?.id;
    if (!templateId) throw new Error('Template not found for ' + row.survey_type);
    const { data, error } = await supabase.from('form_submissions').insert({
      office_id: office.id,
      template_id: templateId,
      user_id: (await supabase.auth.getUser()).data.user?.id || '',
      data: { type: row.survey_type, score: Number(row.score), comment: row.comment || '' },
      submitted_at: parseDateBR(row.submitted_at) || new Date().toISOString(),
    }).select('id').single();
    if (error) throw error;
    return data?.id || null;
  }
  return null;
}
