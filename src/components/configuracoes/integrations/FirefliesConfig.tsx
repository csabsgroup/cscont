import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle2, XCircle, Copy } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { IntegrationSetting } from '@/hooks/useIntegrationSettings';

interface Props {
  setting?: IntegrationSetting;
  onSave: (provider: string, updates: Partial<IntegrationSetting>) => Promise<void>;
}

export function FirefliesConfig({ setting, onSave }: Props) {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; user?: any } | null>(null);

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/integration-fireflies`;

  const testConnection = async () => {
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('integration-fireflies', {
        body: { action: 'testConnection' },
      });
      if (error) throw error;
      setTestResult(data);
      if (data.success) {
        toast.success(`Conectado como ${data.user?.name || data.user?.email}`);
        await onSave('fireflies', { is_connected: true });
      }
    } catch (e: any) {
      setTestResult({ success: false });
      toast.error('Falha: ' + e.message);
    }
    setTesting(false);
  };

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    toast.success('URL copiada!');
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Configure a integração com o Fireflies para receber transcrições automáticas de reuniões.
        A API Key deve ser configurada nos secrets (FIREFLIES_API_KEY).
      </p>

      <Button onClick={testConnection} disabled={testing} variant="outline" size="sm">
        {testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Testar Conexão
      </Button>
      {testResult && (
        <div className="flex items-center gap-2 mt-2 text-sm">
          {testResult.success ? (
            <><CheckCircle2 className="h-4 w-4 text-green-500" /> Conectado: {testResult.user?.name}</>
          ) : (
            <><XCircle className="h-4 w-4 text-destructive" /> Falha na conexão</>
          )}
        </div>
      )}

      <div className="space-y-2">
        <Label>URL do Webhook (copie e cole no painel do Fireflies)</Label>
        <div className="flex gap-2">
          <Input value={webhookUrl} readOnly className="text-xs" />
          <Button variant="outline" size="icon" onClick={copyWebhookUrl}>
            <Copy className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          No painel do Fireflies, vá em Configurações → Webhooks e adicione esta URL para receber transcrições automaticamente.
        </p>
      </div>
    </div>
  );
}
