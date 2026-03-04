import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { IntegrationSetting } from '@/hooks/useIntegrationSettings';

interface Props {
  setting?: IntegrationSetting;
  onSave: (provider: string, updates: Partial<IntegrationSetting>) => Promise<void>;
}

export function SlackConfig({ setting, onSave }: Props) {
  const config = setting?.config || {};
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; team?: string } | null>(null);
  const [channels, setChannels] = useState<{ id: string; name: string }[]>([]);
  const [channelId, setChannelId] = useState(config.channel_id || '');
  const [notifications, setNotifications] = useState(config.notifications || { health: true, churn: true, bonus: true, daily: true });
  const [loadingChannels, setLoadingChannels] = useState(false);

  const testConnection = async () => {
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('integration-slack', {
        body: { action: 'testConnection' },
      });
      if (error) throw error;
      setTestResult(data);
      if (data.success) {
        toast.success(`Conectado ao workspace: ${data.team}`);
        await loadChannels();
      }
    } catch (e: any) {
      setTestResult({ success: false });
      toast.error('Falha na conexão: ' + e.message);
    }
    setTesting(false);
  };

  const loadChannels = async () => {
    setLoadingChannels(true);
    try {
      const { data } = await supabase.functions.invoke('integration-slack', {
        body: { action: 'listChannels' },
      });
      setChannels(data?.channels || []);
    } catch (e) {
      console.error('Failed to load channels:', e);
    }
    setLoadingChannels(false);
  };

  useEffect(() => {
    if (setting?.is_connected) loadChannels();
  }, [setting?.is_connected]);

  const handleSave = async () => {
    const selectedChannel = channels.find(c => c.id === channelId);
    await onSave('slack', {
      is_connected: true,
      workspace_name: testResult?.team || setting?.workspace_name || '',
      config: {
        channel_id: channelId,
        channel_name: selectedChannel?.name || '',
        notifications,
      },
    });
    toast.success('Configuração do Slack salva!');
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-muted-foreground mb-3">
          O Slack já está conectado via conector Lovable. Teste a conexão e configure o canal.
        </p>
        <Button onClick={testConnection} disabled={testing} variant="outline" size="sm">
          {testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Testar Conexão
        </Button>
        {testResult && (
          <div className="flex items-center gap-2 mt-2 text-sm">
            {testResult.success ? (
              <><CheckCircle2 className="h-4 w-4 text-green-500" /> Workspace: {testResult.team}</>
            ) : (
              <><XCircle className="h-4 w-4 text-destructive" /> Falha na conexão</>
            )}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label>Canal padrão para notificações</Label>
        <Select value={channelId} onValueChange={setChannelId}>
          <SelectTrigger>
            <SelectValue placeholder={loadingChannels ? 'Carregando...' : 'Selecione um canal'} />
          </SelectTrigger>
          <SelectContent>
            {channels.map(c => <SelectItem key={c.id} value={c.id}>#{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3">
        <Label>Notificações automáticas</Label>
        {[
          { key: 'health', label: 'Alerta de Health Score (mudança de faixa)' },
          { key: 'churn', label: 'Alerta de Churn Risk' },
          { key: 'bonus', label: 'Nova solicitação de bônus' },
          { key: 'daily', label: 'Resumo diário da carteira' },
        ].map(item => (
          <div key={item.key} className="flex items-center justify-between">
            <span className="text-sm">{item.label}</span>
            <Switch
              checked={notifications[item.key]}
              onCheckedChange={v => setNotifications({ ...notifications, [item.key]: v })}
            />
          </div>
        ))}
      </div>

      <Button onClick={handleSave} className="w-full" disabled={!channelId}>
        Salvar Configuração
      </Button>
    </div>
  );
}
