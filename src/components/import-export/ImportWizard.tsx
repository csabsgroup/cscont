import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Upload, Download, CheckCircle2, AlertCircle, Loader2, Undo2, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  EntityTemplate, autoMapColumns, validateRow, generateTemplateCSV,
  parseBoolean, parseDateBR, getMappingStatus,
} from '@/lib/import-templates';
import { sanitizeValue, normalizeStatus } from '@/lib/import-sanitize';
import { parseUploadedFile, downloadCSV } from '@/lib/export-helpers';

interface ImportWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: EntityTemplate;
}

type Step = 'upload' | 'map' | 'preview' | 'validate' | 'execute';

export function ImportWizard({ open, onOpenChange, template }: ImportWizardProps) {
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>('upload');
  const [fileHeaders, setFileHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, any>[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [autoMapping, setAutoMapping] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<string[]>([]);
  const [validCount, setValidCount] = useState(0);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ success: number; errors: number; skipped: number; batchId?: string } | null>(null);

  const reset = () => {
    setStep('upload'); setFileHeaders([]); setRows([]); setMapping({});
    setAutoMapping({}); setErrors([]); setValidCount(0); setImporting(false); setProgress(0); setResult(null);
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
      setAutoMapping(autoMap);
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

  // Get mapped preview rows
  const getMappedRows = () => {
    return rows.map(row => {
      const mapped: Record<string, any> = {};
      for (const field of template.fields) {
        const fileCol = mapping[field.key];
        const rawVal = fileCol ? row[fileCol] : '';
        mapped[field.key] = rawVal ? sanitizeValue(rawVal, field) : '';
      }
      return mapped;
    });
  };

  const handlePreview = () => {
    setStep('preview');
  };

  const handleValidate = () => {
    const mappedRows = getMappedRows();
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
    const mappedRows = getMappedRows().filter((row, i) => {
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

    if (user) {
      await supabase.from('audit_logs').insert({
        user_id: user.id,
        entity_type: template.table,
        action: 'bulk_import',
        details: { entity: template.key, success, errors: errorCount, skipped },
      });

      // Fire onNewOffice automations for imported offices
      if (template.key === 'offices' && insertedIds.length > 0) {
        for (const officeId of insertedIds) {
          try {
            const { data: office } = await supabase.from('offices').select('active_product_id').eq('id', officeId).single();
            if (office?.active_product_id) {
              await supabase.functions.invoke('execute-automations', {
                body: { action: 'onNewOffice', office_id: officeId, product_id: office.active_product_id },
              });
            }
          } catch (e) {
            console.warn('Automation trigger failed for imported office', officeId, e);
          }
        }
      }
    }

    setResult({ success, errors: errorCount, skipped, batchId });
    setStep('execute');
    setImporting(false);
  };

  const handleUndoImport = async () => {
    if (!result?.batchId) return;
    setImporting(true);
    try {
      const { data: batch } = await supabase.from('import_batches' as any).select('*').eq('id', result.batchId).single();
      if (!batch) throw new Error('Batch not found');
      const ids = (batch as any).record_ids as string[];
      const chunkSize = 50;
      for (let i = 0; i < ids.length; i += chunkSize) {
        await supabase.from((batch as any).table_name as any).delete().in('id', ids.slice(i, i + chunkSize));
      }
      await supabase.from('import_batches' as any).update({ undone_at: new Date().toISOString() } as any).eq('id', result.batchId);
      if (user) {
        await supabase.from('audit_logs').insert({
          user_id: user.id, entity_type: template.table, action: 'undo_import',
          details: { batch_id: result.batchId, count: ids.length },
        });
      }
      toast.success('Importação desfeita com sucesso.');
      reset();
      onOpenChange(false);
    } catch { toast.error('Erro ao desfazer importação.'); } finally { setImporting(false); }
  };

  const mappingStatusBadge = (status: string) => {
    if (status === 'auto') return <Badge variant="default" className="text-[10px] h-4 bg-success/20 text-success border-success/30">Auto</Badge>;
    if (status === 'manual') return <Badge variant="default" className="text-[10px] h-4 bg-warning/20 text-warning border-warning/30">Manual</Badge>;
    return <Badge variant="destructive" className="text-[10px] h-4">Sem mapa</Badge>;
  };

  const mappedCount = template.fields.filter(f => mapping[f.key]).length;
  const requiredUnmapped = template.fields.filter(f => f.required && !mapping[f.key]);
  const autoMappedCount = Object.keys(autoMapping).length;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
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
            <p className="text-xs text-muted-foreground">Máximo 5MB, 5000 linhas. Formatos: CSV, XLSX. O sistema detecta automaticamente os nomes das colunas.</p>
          </div>
        )}

        {step === 'map' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{rows.length} linhas encontradas. Mapeie as colunas:</p>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">{mappedCount}/{template.fields.length} mapeados</Badge>
                {autoMappedCount > 0 && (
                  <Badge variant="default" className="text-xs bg-success/20 text-success border-success/30">
                    {autoMappedCount} auto-detectados
                  </Badge>
                )}
                {requiredUnmapped.length > 0 && (
                  <Badge variant="destructive" className="text-xs">{requiredUnmapped.length} obrigatórios sem mapa</Badge>
                )}
              </div>
            </div>
            <div className="space-y-2">
              {template.fields.map(field => {
                const status = getMappingStatus(field.key, mapping, autoMapping);
                return (
                  <div key={field.key} className="flex items-center gap-3">
                    <div className="w-44 shrink-0 flex items-center gap-1.5">
                      {mappingStatusBadge(status)}
                      <span className="text-sm truncate">
                        {field.label} {field.required && <span className="text-destructive">*</span>}
                      </span>
                    </div>
                    <span className="text-muted-foreground">→</span>
                    <Select value={mapping[field.key] || '__none__'} onValueChange={(v) => setMapping(prev => ({ ...prev, [field.key]: v === '__none__' ? '' : v }))}>
                      <SelectTrigger className="flex-1"><SelectValue placeholder="Selecionar coluna..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">— Não mapear —</SelectItem>
                        {fileHeaders.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep('upload')}>Voltar</Button>
              <Button onClick={handlePreview} disabled={requiredUnmapped.length > 0}>
                <Eye className="mr-2 h-4 w-4" />Pré-visualizar
              </Button>
            </div>
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Pré-visualização das primeiras 5 linhas mapeadas:</p>
            <ScrollArea className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs w-10">#</TableHead>
                    {template.fields.filter(f => mapping[f.key]).map(f => (
                      <TableHead key={f.key} className="text-xs whitespace-nowrap">{f.label}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {getMappedRows().slice(0, 5).map((row, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                      {template.fields.filter(f => mapping[f.key]).map(f => (
                        <TableCell key={f.key} className="text-xs max-w-[150px] truncate">
                          {row[f.key] !== '' && row[f.key] !== null && row[f.key] !== undefined
                            ? String(row[f.key])
                            : <span className="text-muted-foreground/50">—</span>}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep('map')}>Voltar</Button>
              <Button onClick={handleValidate}>Validar dados</Button>
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
              <Button variant="outline" onClick={() => setStep('preview')}>Voltar</Button>
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

// ── Fuzzy product matching ──────────────────────────────────
async function fuzzyMatchProduct(value: string): Promise<string | null> {
  if (!value || !value.trim()) return null;
  const normalized = value.toLowerCase().trim();
  const { data: products } = await supabase.from('products').select('id, name');
  if (!products || products.length === 0) return null;

  // Exact match
  let match = products.find(p => p.name.toLowerCase() === normalized);
  if (match) return match.id;

  // Contains match
  match = products.find(p =>
    normalized.includes(p.name.toLowerCase()) ||
    p.name.toLowerCase().includes(normalized)
  );
  if (match) return match.id;

  // Partial word match (words > 3 chars)
  const words = normalized.split(/\s+/);
  match = products.find(p =>
    words.some(w => w.length > 3 && p.name.toLowerCase().includes(w))
  );
  if (match) return match.id;

  return null;
}

async function insertRow(template: EntityTemplate, row: Record<string, any>): Promise<string | null> {
  const t = template.key;

  if (t === 'offices') {
    // Product matching: try product_name field with fuzzy matching
    let productId: string | null = null;
    if (row.product_name) {
      productId = await fuzzyMatchProduct(row.product_name);
    }

    // CSM lookup by email
    let csmId: string | null = null;
    if (row.csm_email) {
      const { data } = await supabase.from('profiles').select('id').ilike('full_name', `%${row.csm_email.trim().split('@')[0]}%`).maybeSingle();
      csmId = data?.id || null;
    }
    // Lookup CSM by name if csm_email didn't resolve
    if (!csmId && row.csm_name) {
      const { data } = await supabase.from('profiles').select('id').ilike('full_name', `%${row.csm_name.trim()}%`).maybeSingle();
      csmId = data?.id || null;
    }

    // Ensure status is valid — default to 'ativo'
    const validStatuses = ['ativo', 'churn', 'nao_renovado', 'nao_iniciado', 'upsell', 'bonus_elite', 'pausado'];
    let status = row.status ? normalizeStatus(String(row.status)) : 'ativo';
    if (!validStatuses.includes(status)) status = 'ativo';

    const insertData: Record<string, any> = {
      name: row.name,
      email: row.email || null,
      phone: row.phone || null,
      whatsapp: row.whatsapp || null,
      city: row.city || null,
      state: row.state || null,
      cnpj: row.cnpj || null,
      cpf: row.cpf || null,
      cep: row.cep || null,
      address: row.address || null,
      segment: row.segment || null,
      instagram: row.instagram || null,
      active_product_id: productId,
      csm_id: csmId,
      status: status as any,
      activation_date: parseDateBR(row.activation_date),
      first_signature_date: parseDateBR(row.first_signature_date),
      onboarding_date: parseDateBR(row.onboarding_date),
      cycle_start_date: parseDateBR(row.cycle_start_date),
      cycle_end_date: parseDateBR(row.cycle_end_date),
      churn_date: parseDateBR(row.churn_date),
      churn_observation: row.churn_observation || null,
      last_meeting_date: parseDateBR(row.last_meeting_date),
      notes: row.notes || null,
      office_code: row.office_code || null,
    };

    // Add numeric fields if present
    if (row.qtd_clientes) insertData.qtd_clientes = typeof row.qtd_clientes === 'number' ? row.qtd_clientes : (Number(row.qtd_clientes) || null);
    if (row.qtd_colaboradores) insertData.qtd_colaboradores = typeof row.qtd_colaboradores === 'number' ? row.qtd_colaboradores : (Number(row.qtd_colaboradores) || null);
    if (row.faturamento_mensal) insertData.faturamento_mensal = typeof row.faturamento_mensal === 'number' ? row.faturamento_mensal : (Number(row.faturamento_mensal) || null);
    if (row.faturamento_anual) insertData.faturamento_anual = typeof row.faturamento_anual === 'number' ? row.faturamento_anual : (Number(row.faturamento_anual) || null);
    // MRR from monthly_value if provided
    if (row.monthly_value && !insertData.faturamento_mensal) {
      insertData.mrr = typeof row.monthly_value === 'number' ? row.monthly_value : (Number(row.monthly_value) || null);
    }

    // Clean nulls
    Object.keys(insertData).forEach(k => { if (insertData[k] === null || insertData[k] === undefined || insertData[k] === '') delete insertData[k]; });
    if (!insertData.name) throw new Error('Name required');

    const { data, error } = await supabase.from('offices').insert(insertData as any).select('id').single();
    if (error) throw error;
    const officeId = data?.id;

    // Auto-create linked contact if contact_name is present
    if (officeId && row.contact_name && String(row.contact_name).trim()) {
      try {
        await supabase.from('contacts').insert({
          office_id: officeId,
          name: row.contact_name,
          email: row.contact_email || null,
          phone: row.contact_phone || null,
          cpf: row.contact_cpf || null,
          birthday: parseDateBR(row.contact_birthday),
          is_main_contact: true,
        });
      } catch (e) {
        console.warn('Failed to create linked contact for office', officeId, e);
      }
    }

    // Auto-create linked contract if contract_value or monthly_value is present
    if (officeId && productId && (row.contract_value || row.monthly_value)) {
      try {
        await supabase.from('contracts').insert({
          office_id: officeId,
          product_id: productId,
          value: typeof row.contract_value === 'number' ? row.contract_value : (Number(row.contract_value) || 0),
          monthly_value: typeof row.monthly_value === 'number' ? row.monthly_value : (Number(row.monthly_value) || 0),
          status: 'ativo' as any,
          start_date: parseDateBR(row.activation_date) || new Date().toISOString().split('T')[0],
        });
      } catch (e) {
        console.warn('Failed to create linked contract for office', officeId, e);
      }
    }

    return officeId || null;
  } else if (t === 'contacts') {
    const { data: office } = await supabase.from('offices').select('id').ilike('name', row.office_name.trim()).maybeSingle();
    if (!office) throw new Error('Office not found');
    const { data, error } = await supabase.from('contacts').insert({
      office_id: office.id,
      name: row.name,
      role_title: row.role_title || null,
      contact_type: row.contact_type || null,
      email: row.email || null,
      phone: row.phone || null,
      whatsapp: row.whatsapp || null,
      instagram: row.instagram || null,
      cpf: row.cpf || null,
      birthday: parseDateBR(row.birthday),
      is_main_contact: parseBoolean(row.is_main_contact || 'sim'),
      notes: row.notes || null,
    }).select('id').single();
    if (error) throw error;
    return data?.id || null;
  } else if (t === 'contracts') {
    const { data: office } = await supabase.from('offices').select('id').ilike('name', row.office_name.trim()).maybeSingle();
    if (!office) throw new Error('Office not found');
    let productId: string | null = null;
    if (row.product_name) {
      productId = await fuzzyMatchProduct(row.product_name);
    }
    if (!productId) throw new Error('Product not found');
    const { data, error } = await supabase.from('contracts').insert({
      office_id: office.id,
      product_id: productId,
      start_date: parseDateBR(row.start_date),
      end_date: parseDateBR(row.end_date),
      renewal_date: parseDateBR(row.renewal_date),
      value: typeof row.value === 'number' ? row.value : (Number(row.value) || 0),
      monthly_value: typeof row.monthly_value === 'number' ? row.monthly_value : (Number(row.monthly_value) || 0),
      installments_total: Number(row.installments_total) || 0,
      installments_overdue: Number(row.installments_overdue) || 0,
      status: row.status as any,
      negotiation_notes: row.negotiation_notes || null,
      asaas_link: row.asaas_link || null,
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
      duration_minutes: row.duration_minutes ? Number(row.duration_minutes) : 30,
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
