import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Calendar, MessageSquare, CreditCard, Phone, Video, Link2, Loader2 } from 'lucide-react';
import { useIntegrationSettings } from '@/hooks/useIntegrationSettings';
import { GoogleCalendarConfig } from './integrations/GoogleCalendarConfig';
import { SlackConfig } from './integrations/SlackConfig';
import { AsaasConfig } from './integrations/AsaasConfig';
import { PiperunConfig } from './integrations/PiperunConfig';
import { FirefliesConfig } from './integrations/FirefliesConfig';
import { WhatsAppConfig } from './integrations/WhatsAppConfig';

const integrationDefs = [
  { id: 'google_calendar', name: 'Google Calendar', description: 'Sincronize reuniões com o Google Calendar', icon: Calendar },
  { id: 'asaas', name: 'Asaas', description: 'Gerencie cobranças e parcelas automaticamente', icon: CreditCard },
  { id: 'slack', name: 'Slack', description: 'Receba notificações e alertas no Slack', icon: MessageSquare },
  { id: 'piperun', name: 'Piperun', description: 'Integre com seu CRM de vendas', icon: Link2 },
  { id: 'whatsapp', name: 'WhatsApp', description: 'Envie mensagens e notificações via WhatsApp', icon: Phone },
  { id: 'fireflies', name: 'Fireflies', description: 'Transcrição automática de reuniões', icon: Video },
];

const configComponents: Record<string, React.FC<any>> = {
  google_calendar: GoogleCalendarConfig,
  slack: SlackConfig,
  asaas: AsaasConfig,
  piperun: PiperunConfig,
  whatsapp: WhatsAppConfig,
  fireflies: FirefliesConfig,
};

export function IntegracoesTab() {
  const { settings, loading, getProvider, upsertSetting } = useIntegrationSettings();
  const [openConfig, setOpenConfig] = useState<string | null>(null);

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Configure integrações com serviços externos para automatizar fluxos.</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {integrationDefs.map(int => {
          const setting = getProvider(int.id);
          const connected = setting?.is_connected || false;

          return (
            <Card key={int.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                      <int.icon className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <CardTitle className="text-sm">{int.name}</CardTitle>
                      {connected && setting?.workspace_name && (
                        <p className="text-xs text-muted-foreground">{setting.workspace_name}</p>
                      )}
                    </div>
                  </div>
                  <Badge variant={connected ? 'default' : 'secondary'}>
                    {connected ? 'Conectado' : 'Desconectado'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">{int.description}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => setOpenConfig(int.id)}
                >
                  {connected ? 'Configurar' : 'Conectar'}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Config dialogs */}
      {integrationDefs.map(int => {
        const ConfigComponent = configComponents[int.id];
        if (!ConfigComponent) return null;
        const setting = getProvider(int.id);

        return (
          <Dialog key={int.id} open={openConfig === int.id} onOpenChange={open => !open && setOpenConfig(null)}>
            <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <int.icon className="h-5 w-5" />
                  {int.name}
                </DialogTitle>
              </DialogHeader>
              <ConfigComponent setting={setting} onSave={upsertSetting} />
            </DialogContent>
          </Dialog>
        );
      })}
    </div>
  );
}
