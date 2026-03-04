import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, CheckCircle2, XCircle, Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { IntegrationSetting } from '@/hooks/useIntegrationSettings';

interface Props {
  setting?: IntegrationSetting;
  onSave: (provider: string, updates: Partial<IntegrationSetting>) => Promise<void>;
}

export function PiperunConfig({ setting, onSave }: Props) {
  const config = setting?.config || {};
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean } | null>(null);
  const [pipelines, setPipelines] = useState<any[]>([]);
  const [stages, setStages] = useState<any[]>([]);
  const [pipelineId, setPipelineId] = useState(config.pipeline_id || '');
  const [stageId, setStageId] = useState(config.stage_id || '');
  const [autoImport, setAutoImport] = useState(config.auto_import || false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number } | null>(null);

  const testConnection = async () => {
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('integration-piperun', {
        body: { action: 'testConnection' },
      });
      if (error) throw error;
      setTestResult(data);
      if (data.success) {
        toast.success('Conectado ao Piperun!');
        loadPipelines();
      }
    } catch (e: any) {
      setTestResult({ success: false });
      toast.error('Falha: ' + e.message);
    }
    setTesting(false);
  };

  const loadPipelines = async () => {
    const { data } = await supabase.functions.invoke('integration-piperun', {
      body: { action: 'listPipelines' },
    });
    setPipelines(data?.pipelines || []);
  };

  useEffect(() => {
    if (pipelineId) {
      loadStages(pipelineId);
    } else {
      setStages([]);
    }
  }, [pipelineId]);

  const loadStages = async (pid: string) => {
    const { data } = await supabase.functions.invoke('integration-piperun', {
      body: { action: 'listStages', pipeline_id: pid },
    });
    setStages(data?.stages || []);
  };

  useEffect(() => {
    if (setting?.is_connected) loadPipelines();
  }, [setting?.is_connected]);

  const importNow = async () => {
    if (!pipelineId || !stageId) { toast.error('Selecione funil e etapa'); return; }
    setImporting(true);
    try {
      const { data } = await supabase.functions.invoke('integration-piperun', {
        body: { action: 'importDeals', pipeline_id: pipelineId, stage_id: stageId },
      });
      setImportResult(data);
      toast.success(`${data.imported} novos clientes importados, ${data.skipped} já existiam`);
    } catch (e: any) {
      toast.error('Erro: ' + e.message);
    }
    setImporting(false);
  };

  const handleSave = async () => {
    await onSave('piperun', {
      is_connected: testResult?.success || setting?.is_connected || false,
      config: { pipeline_id: pipelineId, stage_id: stageId, auto_import: autoImport },
    });
    toast.success('Configuração do Piperun salva!');
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Configure a integração com o Piperun para importar deals ganhos como clientes.
        O API Token deve ser configurado nos secrets (PIPERUN_API_TOKEN).
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
          <SelectContent>
            {pipelines.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Etapa (deal ganho)</Label>
        <Select value={stageId} onValueChange={setStageId}>
          <SelectTrigger><SelectValue placeholder="Selecione a etapa" /></SelectTrigger>
          <SelectContent>
            {stages.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between">
        <Label>Importação automática</Label>
        <Switch checked={autoImport} onCheckedChange={setAutoImport} />
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
    </div>
  );
}
