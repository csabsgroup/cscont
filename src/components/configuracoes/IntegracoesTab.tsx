import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, MessageSquare, CreditCard, Phone, Video, Link2 } from 'lucide-react';

const integrations = [
  { id: 'google_calendar', name: 'Google Calendar', description: 'Sincronize reuniões com o Google Calendar', icon: Calendar, connected: false },
  { id: 'asaas', name: 'Asaas', description: 'Gerencie cobranças e parcelas automaticamente', icon: CreditCard, connected: false },
  { id: 'slack', name: 'Slack', description: 'Receba notificações e alertas no Slack', icon: MessageSquare, connected: false },
  { id: 'piperun', name: 'Piperun', description: 'Integre com seu CRM de vendas', icon: Link2, connected: false },
  { id: 'whatsapp', name: 'WhatsApp', description: 'Envie mensagens e notificações via WhatsApp', icon: Phone, connected: false },
  { id: 'fireflies', name: 'Fireflies', description: 'Transcrição automática de reuniões', icon: Video, connected: false },
];

export function IntegracoesTab() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Configure integrações com serviços externos para automatizar fluxos.</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {integrations.map(int => (
          <Card key={int.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                    <int.icon className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <CardTitle className="text-sm">{int.name}</CardTitle>
                  </div>
                </div>
                <Badge variant={int.connected ? 'default' : 'secondary'}>
                  {int.connected ? 'Conectado' : 'Desconectado'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">{int.description}</p>
              <Button variant="outline" size="sm" className="w-full" disabled>
                {int.connected ? 'Configurar' : 'Conectar'}
              </Button>
              <p className="text-xs text-muted-foreground text-center mt-2">Em breve</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
