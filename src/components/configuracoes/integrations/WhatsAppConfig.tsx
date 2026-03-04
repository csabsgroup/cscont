import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Loader2, CheckCircle2, XCircle, Copy } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { IntegrationSetting } from '@/hooks/useIntegrationSettings';

interface Props {
  setting?: IntegrationSetting;
  onSave: (provider: string, updates: Partial<IntegrationSetting>) => Promise<void>;
}

export function WhatsAppConfig({ setting, onSave }: Props) {
  const config = setting?.config || {};
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean } | null>(null);
  const [displayNumber, setDisplayNumber] = useState(config.display_number || '');
  const [reminderMeeting, setReminderMeeting] = useState(config.reminder_meeting || false);
  const [reminderPayment, setReminderPayment] = useState(config.reminder_payment || false);
  const [welcomeNew, setWelcomeNew] = useState(config.welcome_new || false);

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/integration-whatsapp`;

  const testConnection = async () => {
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('integration-whatsapp', {
        body: { action: 'testConnection' },
      });
      if (error) throw error;
      setTestResult(data);
      if (data.success) toast.success('WhatsApp conectado!');
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

  const handleSave = async () => {
    await onSave('whatsapp', {
      is_connected: testResult?.success || setting?.is_connected || false,
      config: {
        display_number: displayNumber,
        reminder_meeting: reminderMeeting,
        reminder_payment: reminderPayment,
        welcome_new: welcomeNew,
      },
    });
    toast.success('Configuração do WhatsApp salva!');
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Configure a integração com o WhatsApp Business API para enviar templates e receber mensagens.
        Requer WHATSAPP_ACCESS_TOKEN e WHATSAPP_PHONE_NUMBER_ID nos secrets.
      </p>

      <Button onClick={testConnection} disabled={testing} variant="outline" size="sm">
        {testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Testar Conexão
      </Button>
      {testResult && (
        <div className="flex items-center gap-2 mt-2 text-sm">
          {testResult.success ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-destructive" />}
          {testResult.success ? 'Conectado' : 'Falha na conexão'}
        </div>
      )}

      <div className="space-y-2">
        <Label>Número exibido (referência)</Label>
        <Input value={displayNumber} onChange={e => setDisplayNumber(e.target.value)} placeholder="+55 11 99999-9999" />
      </div>

      <div className="space-y-2">
        <Label>URL do Webhook (configure no Meta Developer Portal)</Label>
        <div className="flex gap-2">
          <Input value={webhookUrl} readOnly className="text-xs" />
          <Button variant="outline" size="icon" onClick={copyWebhookUrl}><Copy className="h-4 w-4" /></Button>
        </div>
      </div>

      <div className="space-y-3">
        <Label>Automações</Label>
        {[
          { key: 'meeting', label: 'Lembrete de reunião (24h antes)', value: reminderMeeting, set: setReminderMeeting },
          { key: 'payment', label: 'Lembrete de parcela (3 dias antes)', value: reminderPayment, set: setReminderPayment },
          { key: 'welcome', label: 'Boas-vindas para novos clientes', value: welcomeNew, set: setWelcomeNew },
        ].map(item => (
          <div key={item.key} className="flex items-center justify-between">
            <span className="text-sm">{item.label}</span>
            <Switch checked={item.value} onCheckedChange={item.set} />
          </div>
        ))}
      </div>

      <Button onClick={handleSave} className="w-full">Salvar Configuração</Button>
    </div>
  );
}
