import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, XCircle, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { IntegrationSetting } from '@/hooks/useIntegrationSettings';

interface Props {
  setting?: IntegrationSetting;
  onSave: (provider: string, updates: Partial<IntegrationSetting>) => Promise<void>;
}

export function GoogleCalendarConfig({ setting, onSave }: Props) {
  const { session } = useAuth();
  const [status, setStatus] = useState<{ connected: boolean; email: string | null } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.functions.invoke('integration-google-calendar', {
        body: { action: 'getStatus', user_id: session?.user?.id },
      });
      setStatus(data);
    } catch (e) {
      setStatus({ connected: false, email: null });
    }
    setLoading(false);
  };

  const handleConnect = () => {
    // This requires GOOGLE_CLIENT_ID to be set as a secret
    // The OAuth flow redirects to Google, then back with a code
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) {
      toast.error('Google Client ID não configurado. Configure GOOGLE_CLIENT_ID nos secrets.');
      return;
    }
    const redirectUri = `${window.location.origin}/configuracoes?tab=integracoes&oauth=google`;
    const scope = 'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/userinfo.email';
    const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}&access_type=offline&prompt=consent`;
    window.location.href = url;
  };

  const handleDisconnect = async () => {
    try {
      await supabase.functions.invoke('integration-google-calendar', {
        body: { action: 'disconnect', user_id: session?.user?.id },
      });
      setStatus({ connected: false, email: null });
      toast.success('Google Calendar desconectado');
    } catch (e: any) {
      toast.error('Erro: ' + e.message);
    }
  };

  if (loading) return <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Conecte sua conta Google para sincronizar reuniões automaticamente com o Google Calendar.
        Cada CSM conecta sua própria conta individualmente.
      </p>

      {status?.connected ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            Conectado como: <strong>{status.email}</strong>
          </div>
          <p className="text-xs text-muted-foreground">
            Reuniões criadas no sistema serão automaticamente adicionadas ao seu Google Calendar.
          </p>
          <Button variant="outline" size="sm" onClick={handleDisconnect}>
            Desconectar
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <XCircle className="h-4 w-4" /> Não conectado
          </div>
          <Button onClick={handleConnect}>
            <ExternalLink className="mr-2 h-4 w-4" />
            Conectar com Google
          </Button>
          <p className="text-xs text-muted-foreground">
            Requer que o admin tenha configurado GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET nos secrets.
          </p>
        </div>
      )}
    </div>
  );
}
