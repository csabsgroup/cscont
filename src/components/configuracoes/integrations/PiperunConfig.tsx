import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, CheckCircle2, XCircle, Download, ArrowRight, Plus, Trash2, RotateCcw, Search, Zap, Copy, Webhook, Eye } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { IntegrationSetting } from '@/hooks/useIntegrationSettings';
import { PiperunFieldPicker } from './PiperunFieldPicker';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Props {
  setting?: IntegrationSetting;
  onSave: (provider: string, updates: Partial<IntegrationSetting>) => Promise<void>;
}

interface CrmFieldDef {
  value: string;
  label: string;
  group: string;
  icon?: 'zap';
}

const CRM_FIELDS: CrmFieldDef[] = [
  // --- Escritório ---
  { value: 'offices.name', label: 'Nome do escritório', group: 'Escritório' },
  { value: 'offices.email', label: 'Email', group: 'Escritório' },
  { value: 'offices.whatsapp', label: 'WhatsApp', group: 'Escritório' },
  { value: 'offices.phone', label: 'Telefone fixo', group: 'Escritório' },
  { value: 'offices.city', label: 'Cidade', group: 'Escritório' },
  { value: 'offices.state', label: 'Estado', group: 'Escritório' },
  { value: 'offices.cep', label: 'CEP', group: 'Escritório' },
  { value: 'offices.address', label: 'Endereço completo', group: 'Escritório' },
  { value: 'offices.cnpj', label: 'CNPJ', group: 'Escritório' },
  { value: 'offices.cpf', label: 'CPF do responsável', group: 'Escritório' },
  { value: 'offices.segment', label: 'Segmento/Nicho', group: 'Escritório' },
  { value: 'offices.active_product_id', label: '⚡ Produto ativo', group: 'Escritório', icon: 'zap' },
  { value: 'offices.status', label: 'Status', group: 'Escritório' },
  { value: 'offices.csm_id', label: 'CSM responsável', group: 'Escritório' },
  { value: 'offices.first_signature_date', label: 'Data da 1ª assinatura', group: 'Escritório' },
  { value: 'offices.onboarding_date', label: 'Data de ativação', group: 'Escritório' },
  { value: 'offices.faturamento_mensal', label: 'Faturamento mensal', group: 'Escritório' },
  { value: 'offices.faturamento_anual', label: 'Faturamento anual', group: 'Escritório' },
  { value: 'offices.qtd_clientes', label: 'Qtd de clientes', group: 'Escritório' },
  { value: 'offices.qtd_colaboradores', label: 'Qtd de colaboradores', group: 'Escritório' },
  { value: 'offices.notes', label: 'Observações', group: 'Escritório' },
  // --- Contrato ---
  { value: 'contracts.value', label: 'Valor total do contrato', group: 'Contrato' },
  { value: 'contracts.monthly_value', label: 'Valor da parcela/mensalidade', group: 'Contrato' },
  { value: 'contracts.installments_total', label: 'Qtd de parcelas', group: 'Contrato' },
  { value: 'contracts.start_date', label: 'Data início do contrato', group: 'Contrato' },
  { value: 'contracts.end_date', label: 'Data fim do contrato', group: 'Contrato' },
  { value: 'contracts.status', label: 'Status do contrato', group: 'Contrato' },
  // --- Contato Principal ---
  { value: 'contacts.name', label: 'Nome do sócio/contato', group: 'Contato Principal' },
  { value: 'contacts.email', label: 'Email do contato', group: 'Contato Principal' },
  { value: 'contacts.phone', label: 'Telefone do contato', group: 'Contato Principal' },
  { value: 'contacts.whatsapp', label: 'WhatsApp do contato', group: 'Contato Principal' },
  { value: 'contacts.instagram', label: 'Instagram', group: 'Contato Principal' },
  { value: 'contacts.role_title', label: 'Cargo', group: 'Contato Principal' },
  { value: 'contacts.contact_type', label: 'Tipo (decisor/usuário/financeiro)', group: 'Contato Principal' },
  { value: 'contacts.birthday', label: 'Data de aniversário', group: 'Contato Principal' },
  { value: 'contacts.cpf', label: 'CPF do sócio', group: 'Contato Principal' },
  // --- Sócio 2 ---
  { value: 'contacts_2.name', label: 'Sócio 2: Nome', group: 'Sócio 2' },
  { value: 'contacts_2.email', label: 'Sócio 2: Email', group: 'Sócio 2' },
  { value: 'contacts_2.phone', label: 'Sócio 2: Telefone', group: 'Sócio 2' },
  { value: 'contacts_2.whatsapp', label: 'Sócio 2: WhatsApp', group: 'Sócio 2' },
  { value: 'contacts_2.role_title', label: 'Sócio 2: Cargo', group: 'Sócio 2' },
  { value: 'contacts_2.cpf', label: 'Sócio 2: CPF', group: 'Sócio 2' },
  { value: 'contacts_2.birthday', label: 'Sócio 2: Aniversário', group: 'Sócio 2' },
  // --- Sócio 3 ---
  { value: 'contacts_3.name', label: 'Sócio 3: Nome', group: 'Sócio 3' },
  { value: 'contacts_3.email', label: 'Sócio 3: Email', group: 'Sócio 3' },
  { value: 'contacts_3.phone', label: 'Sócio 3: Telefone', group: 'Sócio 3' },
  { value: 'contacts_3.whatsapp', label: 'Sócio 3: WhatsApp', group: 'Sócio 3' },
  { value: 'contacts_3.role_title', label: 'Sócio 3: Cargo', group: 'Sócio 3' },
  { value: 'contacts_3.cpf', label: 'Sócio 3: CPF', group: 'Sócio 3' },
  { value: 'contacts_3.birthday', label: 'Sócio 3: Aniversário', group: 'Sócio 3' },
];

const GROUPS = ['Escritório', 'Contrato', 'Contato Principal', 'Sócio 2', 'Sócio 3'];

const DEFAULT_MAPPINGS: MappingRow[] = [
  { id: '1', crm: 'offices.name', piperun_key: 'deal.title', piperun_label: 'Título da oportunidade' },
  { id: '2', crm: 'offices.email', piperun_key: 'person.email', piperun_label: 'Email do contato' },
  { id: '3', crm: 'offices.phone', piperun_key: 'person.phone', piperun_label: 'Telefone' },
  { id: '4', crm: 'offices.city', piperun_key: 'company.city.name', piperun_label: 'Cidade' },
  { id: '5', crm: 'offices.state', piperun_key: 'company.state.abbr', piperun_label: 'Estado (UF)' },
  { id: '6', crm: 'offices.cnpj', piperun_key: 'company.cnpj', piperun_label: 'CNPJ' },
  { id: '7', crm: 'contracts.value', piperun_key: 'deal.value', piperun_label: 'Valor da oportunidade' },
  { id: '8', crm: 'contacts.name', piperun_key: 'person.name', piperun_label: 'Nome do contato' },
  { id: '9', crm: 'contacts.email', piperun_key: 'person.email', piperun_label: 'Email do contato' },
  { id: '10', crm: 'contacts.phone', piperun_key: 'person.phone', piperun_label: 'Telefone' },
];

interface MappingRow { id: string; crm: string; piperun_key: string; piperun_label: string; }
interface PreviewDeal { id: number; title: string; company_name: string; person_name: string; value: number; won_at: string; }
interface WebhookLog { id: string; payload: any; processed: boolean; error: string | null; created_at: string; }

export function PiperunConfig({ setting, onSave }: Props) {
  const config = (setting?.config || {}) as any;
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean } | null>(null);
  const [pipelines, setPipelines] = useState<any[]>([]);
  const [stages, setStages] = useState<any[]>([]);
  const [pipelineId, setPipelineId] = useState(config.pipeline_id || '');
  const [stageId, setStageId] = useState(config.stage_id || '');
  const [autoImport, setAutoImport] = useState(config.auto_import || false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number; automations_triggered: number } | null>(null);
  const [mappings, setMappings] = useState<MappingRow[]>(() => {
    if (config.field_mappings_v2) return config.field_mappings_v2;
    return DEFAULT_MAPPINGS;
  });
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTargetId, setPickerTargetId] = useState('');

  // Preview state
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewDeals, setPreviewDeals] = useState<PreviewDeal[]>([]);
  const [previewAlreadyImported, setPreviewAlreadyImported] = useState(0);

  // Webhook logs state
  const [webhookLogs, setWebhookLogs] = useState<WebhookLog[]>([]);
  const [webhookLogsLoading, setWebhookLogsLoading] = useState(false);
  const [jsonViewOpen, setJsonViewOpen] = useState(false);
  const [jsonViewData, setJsonViewData] = useState<any>(null);

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const webhookUrl = `https://${projectId}.supabase.co/functions/v1/piperun-webhook`;
  const lastWebhookAt = config.last_webhook_at;

  // Load webhook logs
  const loadWebhookLogs = async () => {
    setWebhookLogsLoading(true);
    try {
      const { data } = await supabase
        .from('webhook_logs')
        .select('*')
        .eq('provider', 'piperun')
        .order('created_at', { ascending: false })
        .limit(10);
      setWebhookLogs((data as any[]) || []);
    } catch { /* ignore */ }
    setWebhookLogsLoading(false);
  };

  useEffect(() => { loadWebhookLogs(); }, []);

  const latestWebhookDate = lastWebhookAt || (webhookLogs.length > 0 ? webhookLogs[0].created_at : null);

  const testConnection = async () => {
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('integration-piperun', { body: { action: 'testConnection' } });
      if (error) throw error;
      setTestResult(data);
      if (data.success) { toast.success(data.message || 'Conectado ao Piperun!'); loadPipelines(); }
      else { toast.error(data.error || 'Falha ao conectar'); }
    } catch (e: any) { setTestResult({ success: false }); toast.error('Falha: ' + e.message); }
    setTesting(false);
  };

  const loadPipelines = async () => {
    const { data } = await supabase.functions.invoke('integration-piperun', { body: { action: 'listPipelines' } });
    setPipelines(data?.pipelines || []);
  };

  useEffect(() => {
    if (pipelineId) {
      supabase.functions.invoke('integration-piperun', { body: { action: 'listStages', pipeline_id: pipelineId } })
        .then(({ data }) => setStages(data?.stages || []));
    } else setStages([]);
  }, [pipelineId]);

  useEffect(() => { if (setting?.is_connected) loadPipelines(); }, [setting?.is_connected]);

  const updateMappingCrm = (id: string, value: string) => {
    setMappings(prev => prev.map(m => m.id === id ? { ...m, crm: value } : m));
  };

  const openPicker = (id: string) => { setPickerTargetId(id); setPickerOpen(true); };
  const addMapping = () => { setMappings(prev => [...prev, { id: crypto.randomUUID(), crm: '', piperun_key: '', piperun_label: '' }]); };
  const removeMapping = (id: string) => { setMappings(prev => prev.filter(m => m.id !== id)); };

  const validateMappings = (): string | null => {
    const crmTargets = mappings.filter(m => m.crm && m.piperun_key).map(m => m.crm);
    const duplicates = crmTargets.filter((item, idx) => crmTargets.indexOf(item) !== idx);
    if (duplicates.length > 0) {
      const labels = duplicates.map(d => CRM_FIELDS.find(f => f.value === d)?.label || d);
      return `Campos CRM duplicados: ${labels.join(', ')}`;
    }
    return null;
  };

  // Preview flow
  const handleImportClick = async () => {
    if (!pipelineId || !stageId) { toast.error('Selecione funil e etapa'); return; }
    setPreviewLoading(true);
    setPreviewOpen(true);
    try {
      const { data } = await supabase.functions.invoke('integration-piperun', {
        body: { action: 'previewDeals', pipeline_id: pipelineId, stage_id: stageId },
      });
      setPreviewDeals(data?.deals || []);
      setPreviewAlreadyImported(data?.already_imported || 0);
    } catch (e: any) { toast.error('Erro ao buscar deals: ' + e.message); }
    setPreviewLoading(false);
  };

  const confirmImport = async () => {
    setImporting(true);
    setPreviewOpen(false);
    try {
      const fieldMappings = mappings.filter(m => m.crm && m.piperun_key).map(m => ({ piperun: m.piperun_key, local: m.crm }));
      const { data } = await supabase.functions.invoke('integration-piperun', {
        body: { action: 'importDeals', pipeline_id: pipelineId, stage_id: stageId, field_mappings: fieldMappings },
      });
      setImportResult(data);
      toast.success(`${data.imported} novos clientes importados, ${data.skipped} já existiam`);
    } catch (e: any) { toast.error('Erro: ' + e.message); }
    setImporting(false);
  };

  const handleSave = async () => {
    const validationError = validateMappings();
    if (validationError) { toast.error(validationError); return; }
    await onSave('piperun', {
      is_connected: testResult?.success || setting?.is_connected || false,
      config: { pipeline_id: pipelineId, stage_id: stageId, auto_import: autoImport, field_mappings_v2: mappings, last_webhook_at: lastWebhookAt },
    });
    toast.success('Configuração do Piperun salva!');
  };

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    toast.success('URL copiada!');
  };

  const groupedFields = GROUPS.map(g => ({ group: g, fields: CRM_FIELDS.filter(f => f.group === g) }));

  const getDealTitle = (payload: any): string => {
    if (!payload) return '—';
    // Try different formats
    const deal = payload.data ? (Array.isArray(payload.data) ? payload.data[0] : payload.data)
      : payload.deal ? (Array.isArray(payload.deal) ? payload.deal[0] : payload.deal)
      : payload.title ? payload : null;
    return deal?.title || `Deal ${deal?.id || '?'}`;
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Configure a integração com o Piperun para importar deals ganhos como clientes.
      </p>

      <Button onClick={testConnection} disabled={testing} variant="outline" size="sm">
        {testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Testar Conexão
      </Button>
      {testResult && (
        <div className="flex items-center gap-2 text-sm">
          {testResult.success ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-destructive" />}
          {testResult.success ? 'Conectado' : 'Falha'}
        </div>
      )}

      <div className="space-y-2">
        <Label>Funil</Label>
        <Select value={pipelineId} onValueChange={setPipelineId}>
          <SelectTrigger><SelectValue placeholder="Selecione o funil" /></SelectTrigger>
          <SelectContent>{pipelines.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Etapa (deal ganho)</Label>
        <Select value={stageId} onValueChange={setStageId}>
          <SelectTrigger><SelectValue placeholder="Selecione a etapa" /></SelectTrigger>
          <SelectContent>{stages.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between">
        <Label>Importação automática (webhook)</Label>
        <Switch checked={autoImport} onCheckedChange={setAutoImport} />
      </div>

      {/* ========== Field Mapping ========== */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-semibold">Mapeamento de Campos</Label>
          <Button variant="ghost" size="sm" onClick={() => setMappings(DEFAULT_MAPPINGS)}>
            <RotateCcw className="mr-1 h-3.5 w-3.5" />Restaurar padrão
          </Button>
        </div>

        <div className="space-y-2">
          {mappings.map(m => {
            const fieldDef = CRM_FIELDS.find(f => f.value === m.crm);
            const isProductField = m.crm === 'offices.active_product_id';
            return (
              <div key={m.id} className={`flex items-center gap-2 ${isProductField ? 'bg-amber-500/10 rounded-md p-1.5 border border-amber-500/30' : ''}`}>
                <Select value={m.crm} onValueChange={v => updateMappingCrm(m.id, v)}>
                  <SelectTrigger className="w-[200px] h-9 text-xs">
                    <SelectValue placeholder="Campo CRM">
                      {fieldDef && (
                        <span className="flex items-center gap-1">
                          {fieldDef.icon === 'zap' && <Zap className="h-3 w-3 text-amber-500" />}
                          {fieldDef.label}
                        </span>
                      )}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {groupedFields.map(g => (
                      <SelectGroup key={g.group}>
                        <SelectLabel className="text-xs font-semibold text-muted-foreground">{g.group}</SelectLabel>
                        {g.fields.map(f => (
                          <SelectItem key={f.value} value={f.value}>
                            <span className="flex items-center gap-1.5">
                              {f.icon === 'zap' && <Zap className="h-3 w-3 text-amber-500" />}
                              {f.label}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>

                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />

                <button
                  onClick={() => openPicker(m.id)}
                  className="flex-1 flex items-center gap-2 h-9 px-3 rounded-md border border-input bg-background text-sm hover:bg-muted/50 transition-colors"
                >
                  {m.piperun_key ? (
                    <Badge variant="secondary" className="text-xs">{m.piperun_label || m.piperun_key}</Badge>
                  ) : (
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <Search className="h-3.5 w-3.5" />Campo Piperun
                    </span>
                  )}
                </button>

                <Button size="sm" variant="ghost" onClick={() => removeMapping(m.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
              </div>
            );
          })}
        </div>

        <Button variant="outline" size="sm" onClick={addMapping}><Plus className="mr-1 h-3.5 w-3.5" />Adicionar mapeamento</Button>
      </div>

      {/* ========== Import Button ========== */}
      <Button variant="outline" onClick={handleImportClick} disabled={importing || !pipelineId || !stageId}>
        {importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
        Importar deals agora
      </Button>

      {importResult && (
        <p className="text-sm text-muted-foreground">
          Resultado: {importResult.imported} importados, {importResult.skipped} já existiam
          {importResult.automations_triggered > 0 && `, ${importResult.automations_triggered} automações disparadas`}
        </p>
      )}

      {/* ========== Webhook Section ========== */}
      <div className="rounded-lg border border-border p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Webhook className="h-4 w-4 text-primary" />
          <Label className="text-sm font-semibold">Webhook (Recebimento em tempo real)</Label>
        </div>
        <p className="text-xs text-muted-foreground">
          Configure no Piperun (Ajustes → Ações Automáticas) para enviar oportunidades ganhas automaticamente.
        </p>
        <div className="space-y-2">
          <Label className="text-xs">URL do Webhook</Label>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs bg-muted px-3 py-2 rounded-md border border-border break-all">
              {webhookUrl}
            </code>
            <Button variant="outline" size="sm" onClick={copyWebhookUrl}>
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        <div className="text-xs text-muted-foreground space-y-1">
          <p className="font-medium">Como configurar:</p>
          <ol className="list-decimal list-inside space-y-0.5">
            <li>No Piperun, vá em <strong>Ajustes → Ações Automáticas</strong></li>
            <li>Crie uma nova ação para o funil selecionado</li>
            <li>Quando: <strong>"Oportunidade for ganha"</strong></li>
            <li>Ação: <strong>"Enviar oportunidade para URL"</strong></li>
            <li>Cole a URL acima</li>
            <li>Header e Valor: <strong>deixe em branco</strong></li>
            <li>Tipo de envio: <strong>Padrão</strong></li>
          </ol>
        </div>
        <div className="flex items-center gap-2 text-xs">
          {latestWebhookDate ? (
            <>
              <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
              <span className="text-muted-foreground">Último webhook: {new Date(latestWebhookDate).toLocaleString('pt-BR')}</span>
            </>
          ) : (
            <>
              <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
              <span className="text-muted-foreground">Aguardando primeiro webhook...</span>
            </>
          )}
        </div>

        {/* Webhook Logs Table */}
        <div className="space-y-2 pt-2 border-t border-border">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold">📋 Últimos webhooks recebidos</Label>
            <Button variant="ghost" size="sm" onClick={loadWebhookLogs} disabled={webhookLogsLoading}>
              {webhookLogsLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
            </Button>
          </div>
          {webhookLogs.length > 0 ? (
            <div className="max-h-[200px] overflow-y-auto rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs py-1">Data/Hora</TableHead>
                    <TableHead className="text-xs py-1">Status</TableHead>
                    <TableHead className="text-xs py-1">Oportunidade</TableHead>
                    <TableHead className="text-xs py-1 w-[50px]">JSON</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {webhookLogs.map(log => (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs py-1.5">
                        {new Date(log.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </TableCell>
                      <TableCell className="text-xs py-1.5">
                        {log.processed ? (
                          <span className="flex items-center gap-1 text-green-600"><CheckCircle2 className="h-3 w-3" /> Sucesso</span>
                        ) : (
                          <span className="flex items-center gap-1 text-destructive" title={log.error || ''}>
                            <XCircle className="h-3 w-3" /> {log.error ? log.error.substring(0, 30) + (log.error.length > 30 ? '…' : '') : 'Erro'}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs py-1.5">{getDealTitle(log.payload)}</TableCell>
                      <TableCell className="text-xs py-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => { setJsonViewData(log.payload); setJsonViewOpen(true); }}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Nenhum webhook recebido ainda.</p>
          )}
        </div>
      </div>

      <Button onClick={handleSave} className="w-full">Salvar Configuração</Button>

      {/* Piperun Field Picker Modal */}
      <PiperunFieldPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        isConnected={setting?.is_connected}
        onSelect={(field) => {
          setMappings(prev => prev.map(m => m.id === pickerTargetId ? { ...m, piperun_key: field.key, piperun_label: field.label } : m));
        }}
      />

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Preview — Deals elegíveis para importação</DialogTitle>
            <DialogDescription>
              Deals ganhos no funil e etapa configurados que ainda não foram importados.
            </DialogDescription>
          </DialogHeader>
          {previewLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <div className="text-sm text-muted-foreground">
                {previewDeals.length} elegíveis para importação
                {previewAlreadyImported > 0 && `, ${previewAlreadyImported} já importados`}
              </div>
              {previewDeals.length > 0 ? (
                <div className="max-h-[300px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Deal</TableHead>
                        <TableHead>Empresa</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Data</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewDeals.map(d => (
                        <TableRow key={d.id}>
                          <TableCell className="font-medium">{d.title}</TableCell>
                          <TableCell>{d.company_name}</TableCell>
                          <TableCell>{d.value ? `R$ ${Number(d.value).toLocaleString('pt-BR')}` : '—'}</TableCell>
                          <TableCell>{d.won_at ? new Date(d.won_at).toLocaleDateString('pt-BR') : '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum deal elegível encontrado.</p>
              )}
            </>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>Cancelar</Button>
            <Button onClick={confirmImport} disabled={previewDeals.length === 0 || previewLoading}>
              <Download className="mr-2 h-4 w-4" />
              Confirmar importação ({previewDeals.length})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* JSON Viewer Dialog */}
      <Dialog open={jsonViewOpen} onOpenChange={setJsonViewOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Payload do Webhook</DialogTitle>
            <DialogDescription>JSON completo recebido do Piperun</DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <pre className="text-xs bg-muted p-4 rounded-md overflow-x-auto whitespace-pre-wrap break-all">
              {JSON.stringify(jsonViewData, null, 2)}
            </pre>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setJsonViewOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
