import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle2, XCircle, Download, ArrowRight, Plus, Trash2, RotateCcw, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { IntegrationSetting } from '@/hooks/useIntegrationSettings';
import { PiperunFieldPicker } from './PiperunFieldPicker';

interface Props {
  setting?: IntegrationSetting;
  onSave: (provider: string, updates: Partial<IntegrationSetting>) => Promise<void>;
}

const CRM_FIELDS = [
  { value: 'name', label: 'Nome' },
  { value: 'email', label: 'E-mail' },
  { value: 'phone', label: 'Telefone' },
  { value: 'city', label: 'Cidade' },
  { value: 'state', label: 'Estado' },
  { value: 'cnpj', label: 'CNPJ' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'contract_value', label: 'Valor do Contrato' },
];

const DEFAULT_MAPPINGS = [
  { id: '1', crm: 'name', piperun_key: 'title', piperun_label: 'Título' },
  { id: '2', crm: 'email', piperun_key: 'person.email', piperun_label: 'Email do contato' },
  { id: '3', crm: 'phone', piperun_key: 'person.phone', piperun_label: 'Telefone do contato' },
  { id: '4', crm: 'contract_value', piperun_key: 'value', piperun_label: 'Valor' },
  { id: '5', crm: 'city', piperun_key: 'person.city', piperun_label: 'Cidade' },
  { id: '6', crm: 'state', piperun_key: 'person.state', piperun_label: 'Estado' },
];

interface MappingRow { id: string; crm: string; piperun_key: string; piperun_label: string; }

export function PiperunConfig({ setting, onSave }: Props) {
  const config = setting?.config || {};
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean } | null>(null);
  const [pipelines, setPipelines] = useState<any[]>([]);
  const [stages, setStages] = useState<any[]>([]);
  const [pipelineId, setPipelineId] = useState(config.pipeline_id || '');
  const [stageId, setStageId] = useState(config.stage_id || '');
  const [autoImport, setAutoImport] = useState(config.auto_import || false);
  const [filterWon, setFilterWon] = useState(config.filter_won !== false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number } | null>(null);
  const [mappings, setMappings] = useState<MappingRow[]>(() => {
    if (config.field_mappings_v2) return config.field_mappings_v2;
    return DEFAULT_MAPPINGS;
  });
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTargetId, setPickerTargetId] = useState('');

  const testConnection = async () => {
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('integration-piperun', { body: { action: 'testConnection' } });
      if (error) throw error;
      setTestResult(data);
      if (data.success) { toast.success('Conectado ao Piperun!'); loadPipelines(); }
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

  const addMapping = () => {
    setMappings(prev => [...prev, { id: crypto.randomUUID(), crm: '', piperun_key: '', piperun_label: '' }]);
  };

  const removeMapping = (id: string) => {
    setMappings(prev => prev.filter(m => m.id !== id));
  };

  const importNow = async () => {
    if (!pipelineId || !stageId) { toast.error('Selecione funil e etapa'); return; }
    setImporting(true);
    try {
      const fieldMappings = mappings.filter(m => m.crm && m.piperun_key).map(m => ({ piperun: m.piperun_key, local: m.crm }));
      const { data } = await supabase.functions.invoke('integration-piperun', {
        body: { action: 'importDeals', pipeline_id: pipelineId, stage_id: stageId, filter_won: filterWon, field_mappings: fieldMappings },
      });
      setImportResult(data);
      toast.success(`${data.imported} novos clientes importados, ${data.skipped} já existiam`);
    } catch (e: any) { toast.error('Erro: ' + e.message); }
    setImporting(false);
  };

  const handleSave = async () => {
    await onSave('piperun', {
      is_connected: testResult?.success || setting?.is_connected || false,
      config: { pipeline_id: pipelineId, stage_id: stageId, auto_import: autoImport, filter_won: filterWon, field_mappings_v2: mappings },
    });
    toast.success('Configuração do Piperun salva!');
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
        <Label>Filtrar apenas deals ganhos (status=won)</Label>
        <Switch checked={filterWon} onCheckedChange={setFilterWon} />
      </div>

      <div className="flex items-center justify-between">
        <Label>Importação automática</Label>
        <Switch checked={autoImport} onCheckedChange={setAutoImport} />
      </div>

      {/* Field Mapping - Pluga style */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-semibold">Mapeamento de Campos</Label>
          <Button variant="ghost" size="sm" onClick={() => setMappings(DEFAULT_MAPPINGS)}>
            <RotateCcw className="mr-1 h-3.5 w-3.5" />Restaurar padrão
          </Button>
        </div>

        <div className="space-y-2">
          {mappings.map(m => (
            <div key={m.id} className="flex items-center gap-2">
              {/* CRM field dropdown */}
              <Select value={m.crm} onValueChange={v => updateMappingCrm(m.id, v)}>
                <SelectTrigger className="w-[160px] h-9 text-xs"><SelectValue placeholder="Campo CRM" /></SelectTrigger>
                <SelectContent>{CRM_FIELDS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
              </Select>

              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />

              {/* Piperun field picker trigger */}
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
          ))}
        </div>

        <Button variant="outline" size="sm" onClick={addMapping}><Plus className="mr-1 h-3.5 w-3.5" />Adicionar mapeamento</Button>
      </div>

      <Button variant="outline" onClick={importNow} disabled={importing || !pipelineId || !stageId}>
        {importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
        Importar deals agora
      </Button>

      {importResult && (
        <p className="text-sm text-muted-foreground">
          Resultado: {importResult.imported} importados, {importResult.skipped} já existiam
        </p>
      )}

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
    </div>
  );
}
