import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Upload, Download, CheckCircle2, AlertCircle, AlertTriangle, Loader2, Undo2, Eye, ChevronDown, FileDown, RotateCcw, XCircle } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  EntityTemplate, autoMapColumns, validateRow, generateTemplateCSV,
  parseBoolean, parseDateBR, getMappingStatus,
} from '@/lib/import-templates';
import { sanitizeValue, normalizeStatus, isNullValue } from '@/lib/import-sanitize';
import { parseUploadedFile, downloadCSV } from '@/lib/export-helpers';

// ── Types for structured import results ─────────────────────
interface ImportRowResult {
  lineNumber: number;
  officeName: string;
  status: 'success' | 'error' | 'warning';
  errors: string[];
  warnings: string[];
}

// ── Translate Supabase errors to friendly Portuguese ────────
function translateSupabaseError(error: any): string {
  const msg = error?.message || '';
  const detail = error?.details || '';

  if (msg.includes('duplicate key') || msg.includes('unique')) {
    if (msg.includes('cnpj') || detail.includes('cnpj')) {
      const match = detail.match(/\(cnpj\)=\(([^)]+)\)/);
      return `CNPJ duplicado: ${match?.[1] || 'valor'} já existe no sistema`;
    }
    if (msg.includes('email') || detail.includes('email')) return 'Email duplicado: já existe um registro com este email';
    if (msg.includes('name') || detail.includes('name')) return 'Nome duplicado: já existe um registro com este nome';
    return `Registro duplicado: ${detail || msg}`;
  }
  if (msg.includes('not-null') || msg.includes('null value')) {
    const colMatch = msg.match(/column "(\w+)"/);
    return `Campo obrigatório "${colMatch?.[1] || 'desconhecido'}" está vazio`;
  }
  if (msg.includes('foreign key') || msg.includes('violates foreign key')) return `Referência inválida: ${detail || msg}`;
  if (msg.includes('RLS') || msg.includes('policy') || msg.includes('permission') || msg.includes('row-level security')) return 'Sem permissão para inserir. Verifique suas permissões.';
  if (msg.includes('invalid input syntax')) {
    const typeMatch = msg.match(/type (\w+)/);
    return `Formato de dado inválido para o tipo ${typeMatch?.[1] || 'desconhecido'}`;
  }
  return `Erro no banco: ${msg}${detail ? ' — ' + detail : ''}`;
}

// ── Group errors by type for summary ────────────────────────
function groupErrorsByType(results: ImportRowResult[]): Record<string, number> {
  const groups: Record<string, number> = {};
  for (const r of results.filter(r => r.status === 'error')) {
    for (const err of r.errors) {
      let type = 'Outro';
      if (err.includes('duplicado') || err.includes('duplicate')) type = 'Registro duplicado';
      else if (err.includes('obrigatório') || err.includes('vazio') || err.includes('required')) type = 'Campo obrigatório vazio';
      else if (err.includes('inválido') || err.includes('formato') || err.includes('syntax')) type = 'Formato de dado inválido';
      else if (err.includes('permissão') || err.includes('RLS') || err.includes('security')) type = 'Sem permissão';
      else if (err.includes('CNPJ')) type = 'CNPJ inválido/duplicado';
      else if (err.includes('não encontrad')) type = 'Referência não encontrada';
      groups[type] = (groups[type] || 0) + 1;
    }
  }
  return groups;
}

// ── Export errors as CSV ────────────────────────────────────
function exportErrorsCSV(results: ImportRowResult[]) {
  const problemRows = results.filter(r => r.status === 'error' || r.status === 'warning');
  if (problemRows.length === 0) return;
  const csvLines = ['Linha,Escritório,Status,Detalhes'];
  for (const r of problemRows) {
    const status = r.status === 'error' ? 'Erro' : 'Aviso';
    const details = [...r.errors, ...r.warnings].join(' | ');
    csvLines.push(`${r.lineNumber},"${r.officeName.replace(/"/g, '""')}",${status},"${details.replace(/"/g, '""')}"`);
  }
  const blob = new Blob(['\uFEFF' + csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'erros_importacao.csv';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

interface ImportWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: EntityTemplate;
}

type Step = 'upload' | 'map' | 'preview' | 'validate' | 'execute';

// ── Check if a row is entirely empty / null-like ────────────
function isEmptyRow(row: Record<string, any>): boolean {
  return Object.values(row).every(val => {
    if (val === null || val === undefined) return true;
    const str = String(val).trim().toLowerCase();
    return ['', 'none', 'null', 'n/a', 'na', 'nan', 'undefined', '-'].includes(str);
  });
}

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
  const [result, setResult] = useState<{ success: number; errors: number; skipped: number; batchId?: string; warnings?: string[]; rowResults?: ImportRowResult[] } | null>(null);
  const [filteredEmptyCount, setFilteredEmptyCount] = useState(0);
  const [enableAutomations, setEnableAutomations] = useState(false);

  const reset = () => {
    setStep('upload'); setFileHeaders([]); setRows([]); setMapping({});
    setAutoMapping({}); setErrors([]); setValidCount(0); setImporting(false); setProgress(0); setResult(null);
    setFilteredEmptyCount(0); setEnableAutomations(false);
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('Arquivo muito grande. Máximo 5MB.'); return; }
    try {
      const parsed = await parseUploadedFile(file);
      // Filter out empty rows (Python/Pandas exports often have hundreds of empty rows)
      const dataRows = parsed.rows.filter(row => !isEmptyRow(row));
      const emptyCount = parsed.rows.length - dataRows.length;
      setFilteredEmptyCount(emptyCount);

      if (dataRows.length > 5000) { toast.error('Máximo 5000 linhas.'); return; }
      if (dataRows.length === 0) { toast.error('Nenhuma linha com dados encontrada no arquivo.'); return; }

      console.log(`Import: ${parsed.rows.length} linhas lidas, ${dataRows.length} com dados, ${emptyCount} vazias ignoradas`);

      setFileHeaders(parsed.headers);
      setRows(dataRows);
      const autoMap = autoMapColumns(parsed.headers, template.fields);
      setMapping(autoMap);
      setAutoMapping(autoMap);

      if (emptyCount > 0) {
        toast.info(`${dataRows.length} linhas com dados encontradas (${emptyCount} linhas vazias ignoradas)`);
      }

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

  // Get mapped preview rows — cleans "None" before sanitizing
  const getMappedRows = () => {
    return rows.map(row => {
      const mapped: Record<string, any> = {};
      for (const field of template.fields) {
        const fileCol = mapping[field.key];
        const rawVal = fileCol ? row[fileCol] : '';
        // Treat Python null exports as null BEFORE sanitizing
        if (isNullValue(rawVal)) {
          mapped[field.key] = null;
        } else {
          mapped[field.key] = sanitizeValue(rawVal, field);
        }
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
    try {
      const allMappedRows = getMappedRows();
      const rowResults: ImportRowResult[] = [];
      const insertedIds: string[] = [];
      let batchId: string | undefined;

      console.log(`[IMPORT] Starting import of ${allMappedRows.length} rows`);
      toast.info(`Importando ${allMappedRows.length} registros...`);

      for (let i = 0; i < allMappedRows.length; i++) {
        const row = allMappedRows[i];
        const rowResult: ImportRowResult = {
          lineNumber: i + 2, // +2: line 1 = header
          officeName: row.name || row.office_name || row.title || `Linha ${i + 2}`,
          status: 'success',
          errors: [],
          warnings: [],
        };

        // Pre-insert validation
        const validationErrors = validateRow(row, template.fields, i);
        if (validationErrors.length > 0) {
          rowResult.errors = validationErrors;
          rowResult.status = 'error';
          rowResults.push(rowResult);
          setProgress(Math.round(((i + 1) / allMappedRows.length) * 100));
          continue;
        }

        try {
          const rowWarnings: string[] = [];
          const insertedId = await insertRow(template, row, rowWarnings);

          if (rowWarnings.length > 0) {
            rowResult.warnings = rowWarnings;
          }

          if (insertedId) {
            insertedIds.push(insertedId);
            rowResult.status = rowWarnings.length > 0 ? 'warning' : 'success';
          } else {
            rowResult.errors.push('Inserção retornou sem ID');
            rowResult.status = 'error';
          }
        } catch (err: any) {
          const friendlyMsg = err?.code ? translateSupabaseError(err) : (err?.message || String(err));
          rowResult.errors.push(friendlyMsg);
          rowResult.status = 'error';
        }

        rowResults.push(rowResult);

        // Progress toast every 20 rows
        if ((i + 1) % 20 === 0) {
          toast.info(`Processando ${i + 1}/${allMappedRows.length}...`, { id: 'import-progress' });
        }
        setProgress(Math.round(((i + 1) / allMappedRows.length) * 100));
      }

      const successCount = rowResults.filter(r => r.status === 'success').length;
      const warningCount = rowResults.filter(r => r.status === 'warning').length;
      const errorCount = rowResults.filter(r => r.status === 'error').length;

      console.log(`[IMPORT] DONE: ${successCount} success, ${warningCount} warnings, ${errorCount} errors`);

      // Save batch
      if (user && insertedIds.length > 0) {
        try {
          const { data: batchData } = await supabase.from('import_batches' as any).insert({
            user_id: user.id,
            entity_type: template.key,
            table_name: template.table,
            record_ids: insertedIds,
            record_count: insertedIds.length,
          } as any).select('id').single();
          batchId = (batchData as any)?.id;
        } catch (batchErr: any) {
          console.error('[IMPORT] Batch log failed:', batchErr?.message);
        }
      }

      // Audit log
      if (user) {
        try {
          await supabase.from('audit_logs').insert({
            user_id: user.id,
            entity_type: template.table,
            action: 'bulk_import',
            details: { entity: template.key, success: successCount, errors: errorCount, warnings: warningCount },
          });
        } catch (auditErr: any) {
          console.error('[IMPORT] Audit log failed:', auditErr?.message);
        }
      }

      // Toast result
      if (errorCount === 0 && successCount > 0) {
        toast.success(`${successCount + warningCount} registros importados com sucesso!`);
      } else if (successCount > 0 && errorCount > 0) {
        toast.warning(`${successCount + warningCount} importados, ${errorCount} com erro. Veja os detalhes.`);
      } else if (successCount === 0) {
        toast.error(`Nenhum registro importado. ${errorCount} erros encontrados.`);
      }

      setResult({ success: successCount + warningCount, errors: errorCount, skipped: 0, batchId, rowResults });
      setStep('execute');
    } catch (err: any) {
      const msg = err?.message || String(err);
      console.error('[IMPORT] FATAL ERROR:', msg, err?.stack);
      toast.error('Erro fatal na importação: ' + msg);
    } finally {
      setImporting(false);
    }
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
              <div className="text-sm text-muted-foreground">
                <span>{rows.length} linhas com dados encontradas.</span>
                {filteredEmptyCount > 0 && (
                  <span className="ml-1 text-warning">({filteredEmptyCount} linhas vazias ignoradas)</span>
                )}
              </div>
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

        {step === 'execute' && result && (() => {
          const rowResults = result.rowResults || [];
          const errorRows = rowResults.filter(r => r.status === 'error');
          const warningRows = rowResults.filter(r => r.status === 'warning');
          const errorGroups = groupErrorsByType(rowResults);
          const hasErrors = result.errors > 0;
          const hasProblems = errorRows.length > 0 || warningRows.length > 0;

          return (
            <div className="space-y-5 py-4">
              {/* Header icon */}
              <div className="text-center">
                {hasErrors ? (
                  <XCircle className="h-12 w-12 mx-auto text-destructive" />
                ) : (
                  <CheckCircle2 className="h-12 w-12 mx-auto text-success" />
                )}
                <h3 className="text-lg font-semibold mt-2">
                  {result.success === 0 ? 'Importação falhou' : hasErrors ? 'Importação parcial' : 'Importação concluída'}
                </h3>
              </div>

              {/* Counters */}
              <div className="flex justify-center gap-4 text-sm">
                {result.success > 0 && (
                  <span className="flex items-center gap-1 text-success">
                    <CheckCircle2 className="h-4 w-4" />{result.success} importados
                  </span>
                )}
                {warningRows.length > 0 && (
                  <span className="flex items-center gap-1 text-warning">
                    <AlertTriangle className="h-4 w-4" />{warningRows.length} com avisos
                  </span>
                )}
                {errorRows.length > 0 && (
                  <span className="flex items-center gap-1 text-destructive">
                    <AlertCircle className="h-4 w-4" />{errorRows.length} com erro
                  </span>
                )}
              </div>

              {/* Error details collapsible */}
              {errorRows.length > 0 && (
                <Collapsible defaultOpen={errorRows.length <= 20}>
                  <CollapsibleTrigger className="flex items-center gap-2 w-full text-sm font-medium text-destructive hover:underline">
                    <ChevronDown className="h-4 w-4" />
                    Detalhes dos erros ({errorRows.length} linhas)
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <ScrollArea className="h-48 border border-destructive/20 rounded-lg p-3 mt-2">
                      <div className="space-y-3">
                        {errorRows.slice(0, 100).map((r, i) => (
                          <div key={i} className="text-left">
                            <p className="text-xs font-medium text-foreground">
                              Linha {r.lineNumber} — "{r.officeName}"
                            </p>
                            {r.errors.map((err, j) => (
                              <p key={j} className="text-xs text-destructive ml-3">├─ ❌ {err}</p>
                            ))}
                          </div>
                        ))}
                        {errorRows.length > 100 && (
                          <p className="text-xs text-muted-foreground">...e mais {errorRows.length - 100} linhas com erro</p>
                        )}
                      </div>
                    </ScrollArea>
                  </CollapsibleContent>
                </Collapsible>
              )}

              {/* Warnings collapsible */}
              {warningRows.length > 0 && (
                <Collapsible>
                  <CollapsibleTrigger className="flex items-center gap-2 w-full text-sm font-medium text-warning hover:underline">
                    <ChevronDown className="h-4 w-4" />
                    Avisos ({warningRows.length} linhas)
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <ScrollArea className="h-36 border border-warning/20 rounded-lg p-3 mt-2">
                      <div className="space-y-3">
                        {warningRows.slice(0, 50).map((r, i) => (
                          <div key={i} className="text-left">
                            <p className="text-xs font-medium text-foreground">
                              Linha {r.lineNumber} — "{r.officeName}"
                            </p>
                            {r.warnings.map((w, j) => (
                              <p key={j} className="text-xs text-warning ml-3">├─ ⚠️ {w}</p>
                            ))}
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CollapsibleContent>
                </Collapsible>
              )}

              {/* Error summary by type */}
              {Object.keys(errorGroups).length > 0 && (
                <div className="border rounded-lg p-3 bg-muted/30">
                  <p className="text-xs font-semibold text-foreground mb-2">Resumo por tipo de erro</p>
                  <div className="space-y-1">
                    {Object.entries(errorGroups).sort((a, b) => b[1] - a[1]).map(([type, count]) => (
                      <div key={type} className="flex justify-between text-xs">
                        <span className="text-muted-foreground">{type}</span>
                        <Badge variant="destructive" className="text-[10px] h-4">{count}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-wrap justify-center gap-3">
                {hasProblems && (
                  <Button variant="outline" size="sm" onClick={() => exportErrorsCSV(rowResults)} className="gap-1.5">
                    <FileDown className="h-4 w-4" />Exportar erros como CSV
                  </Button>
                )}
                {result.batchId && (
                  <Button variant="outline" size="sm" onClick={handleUndoImport} disabled={importing} className="gap-1.5">
                    {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Undo2 className="h-4 w-4" />}
                    Desfazer importação
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => { reset(); }} className="gap-1.5">
                  <RotateCcw className="h-4 w-4" />Tentar novamente
                </Button>
                <Button size="sm" onClick={() => { reset(); onOpenChange(false); }}>Fechar</Button>
              </div>
            </div>
          );
        })()}
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

async function insertRow(template: EntityTemplate, row: Record<string, any>, warnings: string[]): Promise<string | null> {
  const t = template.key;

  if (t === 'offices') {
    // Product matching: try product_name field with fuzzy matching
    let productId: string | null = null;
    if (row.product_name) {
      productId = await fuzzyMatchProduct(row.product_name);
      if (!productId) {
        warnings.push(`Produto "${row.product_name}" não encontrado para "${row.name}"`);
      }
    }

    // CSM lookup by email
    let csmId: string | null = null;
    if (row.csm_email) {
      const { data } = await supabase.from('profiles').select('id').ilike('full_name', `%${row.csm_email.trim().split('@')[0]}%`).maybeSingle();
      csmId = data?.id || null;
    }
    // Lookup CSM by name if csm_email didn't resolve
    if (!csmId && row.csm_name) {
      const searchName = row.csm_name.trim();
      // Try exact ilike first
      const { data } = await supabase.from('profiles').select('id, full_name').ilike('full_name', `%${searchName}%`).maybeSingle();
      if (data) {
        csmId = data.id;
      } else {
        // Try accent-stripped matching: fetch all profiles and match locally
        const { data: allProfiles } = await supabase.from('profiles').select('id, full_name');
        if (allProfiles) {
          const normalizedSearch = searchName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
          const match = allProfiles.find(p => {
            const normalizedName = (p.full_name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
            return normalizedName.includes(normalizedSearch) || normalizedSearch.includes(normalizedName);
          });
          csmId = match?.id || null;
        }
      }
      if (!csmId) {
        warnings.push(`CSM "${row.csm_name}" não encontrado para "${row.name}"`);
      }
    }

    // Ensure status is valid — default to 'ativo'
    const validStatuses = ['ativo', 'churn', 'nao_renovado', 'nao_iniciado', 'upsell', 'bonus_elite', 'pausado'];
    let status = row.status ? normalizeStatus(String(row.status)) : 'ativo';
    if (!validStatuses.includes(status)) status = 'ativo';

    // Build notes: combine notes + origem
    let notes = row.notes || null;
    if (row.origem) {
      notes = notes ? `${notes}\nOrigem: ${row.origem}` : `Origem: ${row.origem}`;
    }
    if (row.num_socios) {
      const sociosInfo = `Nº sócios: ${row.num_socios}`;
      notes = notes ? `${notes}\n${sociosInfo}` : sociosInfo;
    }

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
      activation_date: row.activation_date || null,
      first_signature_date: row.first_signature_date || null,
      onboarding_date: row.onboarding_date || null,
      cycle_start_date: row.cycle_start_date || null,
      cycle_end_date: row.cycle_end_date || null,
      churn_date: row.churn_date || null,
      churn_observation: row.churn_observation || null,
      last_meeting_date: row.last_meeting_date || null,
      cs_feeling: row.cs_feeling || null,
      last_nps: row.last_nps != null ? (typeof row.last_nps === 'number' ? row.last_nps : Number(row.last_nps) || null) : null,
      notes: notes,
      office_code: row.office_code || null,
    };

    // Add numeric fields if present
    if (row.qtd_clientes != null) insertData.qtd_clientes = typeof row.qtd_clientes === 'number' ? row.qtd_clientes : (Number(row.qtd_clientes) || null);
    if (row.qtd_colaboradores != null) insertData.qtd_colaboradores = typeof row.qtd_colaboradores === 'number' ? row.qtd_colaboradores : (Number(row.qtd_colaboradores) || null);
    if (row.faturamento_mensal != null) insertData.faturamento_mensal = typeof row.faturamento_mensal === 'number' ? row.faturamento_mensal : (Number(row.faturamento_mensal) || null);
    if (row.faturamento_anual != null) insertData.faturamento_anual = typeof row.faturamento_anual === 'number' ? row.faturamento_anual : (Number(row.faturamento_anual) || null);
    // MRR from monthly_value if provided
    if (row.monthly_value != null) {
      insertData.mrr = typeof row.monthly_value === 'number' ? row.monthly_value : (Number(row.monthly_value) || null);
    }

    // Clean nulls — remove keys with null/undefined/empty to let DB use defaults
    Object.keys(insertData).forEach(k => { if (insertData[k] === null || insertData[k] === undefined || insertData[k] === '') delete insertData[k]; });
    // But always keep status
    insertData.status = status;
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
          email: row.contact_email || row.email || null,
          phone: row.contact_phone || row.whatsapp || null,
          cpf: row.contact_cpf || null,
          birthday: row.contact_birthday || null,
          is_main_contact: true,
        });
      } catch (e) {
        console.warn('Failed to create linked contact for office', officeId, e);
      }
    }

    // Auto-create linked contract if contract_value or monthly_value is present AND product exists
    if (officeId && productId && (row.contract_value || row.monthly_value)) {
      try {
        await supabase.from('contracts').insert({
          office_id: officeId,
          product_id: productId,
          value: typeof row.contract_value === 'number' ? row.contract_value : (Number(row.contract_value) || 0),
          monthly_value: typeof row.monthly_value === 'number' ? row.monthly_value : (Number(row.monthly_value) || 0),
          status: 'ativo' as any,
          start_date: row.cycle_start_date || row.activation_date || new Date().toISOString().split('T')[0],
          end_date: row.cycle_end_date || null,
        });
      } catch (e) {
        console.warn('Failed to create linked contract for office', officeId, e);
      }
    } else if (officeId && !productId && (row.contract_value || row.monthly_value)) {
      warnings.push(`Contrato não criado para "${row.name}" — produto não encontrado`);
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
