import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { IntegrationSetting } from '@/hooks/useIntegrationSettings';

interface Props {
  setting?: IntegrationSetting;
  onSave: (provider: string, updates: Partial<IntegrationSetting>) => Promise<void>;
}

export function AsaasConfig({ setting, onSave }: Props) {
  const config = setting?.config || {};
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; balance?: number } | null>(null);
  const [autoSync, setAutoSync] = useState(config.auto_sync || false);

  const testConnection = async () => {
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('integration-asaas', {
        body: { action: 'testConnection' },
      });
      if (error) throw error;
      setTestResult(data);
      if (data.success) {
        toast.success(`Conectado! Saldo: R$ ${data.balance?.toFixed(2)}`);
      }
    } catch (e: any) {
      setTestResult({ success: false });
      toast.error('Falha: ' + e.message);
    }
    setTesting(false);
  };

  const handleSave = async () => {
    await onSave('asaas', {
      is_connected: testResult?.success || setting?.is_connected || false,
      config: { auto_sync: autoSync },
    });
    toast.success('Configuração do Asaas salva!');
  };

  const syncNow = async () => {
    toast.info('Sincronizando...');
    try {
      const { data } = await supabase.functions.invoke('integration-asaas', {
        body: { action: 'syncAll' },
      });
      toast.success(`${data?.synced || 0} escritórios sincronizados`);
    } catch (e: any) {
      toast.error('Erro: ' + e.message);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Configure a integração com o Asaas para monitorar cobranças e parcelas dos escritórios.
        A API Key deve ser configurada nos secrets do Lovable Cloud (ASAAS_API_KEY).
      </p>

      <div>
        <Button onClick={testConnection} disabled={testing} variant="outline" size="sm">
          {testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Testar Conexão
        </Button>
        {testResult && (
          <div className="flex items-center gap-2 mt-2 text-sm">
            {testResult.success ? (
              <><CheckCircle2 className="h-4 w-4 text-green-500" /> Conectado — Saldo: R$ {testResult.balance?.toFixed(2)}</>
            ) : (
              <><XCircle className="h-4 w-4 text-destructive" /> Falha na conexão</>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <Label>Sincronizar automaticamente</Label>
        <Switch checked={autoSync} onCheckedChange={setAutoSync} />
      </div>

      <Button variant="outline" size="sm" onClick={syncNow}>
        Sincronizar agora
      </Button>

      <Button onClick={handleSave} className="w-full">
        Salvar Configuração
      </Button>
    </div>
  );
}
