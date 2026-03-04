import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Setting {
  id: string;
  setting_key: string;
  setting_value: boolean;
}

const groups = [
  {
    title: 'Página Home',
    items: [
      { key: 'portal_show_health', label: 'Health Score', desc: 'Card de saúde do cliente na home' },
      { key: 'portal_show_bonus_balance', label: 'Saldo de Bônus', desc: 'Card de saldo de bônus/cashback' },
      { key: 'portal_show_next_event', label: 'Próximo Evento', desc: 'Card do próximo evento na home' },
      { key: 'portal_show_next_meeting', label: 'Próxima Reunião', desc: 'Card da próxima reunião na home' },
    ],
  },
  {
    title: 'Páginas do Portal',
    items: [
      { key: 'portal_show_contract', label: 'Meu Contrato', desc: 'Página de contrato do cliente' },
      { key: 'portal_show_okr', label: 'Plano de Ação / OKR', desc: 'Página de plano de ação' },
      { key: 'portal_show_meetings', label: 'Reuniões', desc: 'Página de reuniões compartilhadas' },
      { key: 'portal_show_events', label: 'Eventos', desc: 'Página de eventos' },
      { key: 'portal_show_bonus', label: 'Bônus/Cashback', desc: 'Página de bônus e cashback' },
      { key: 'portal_show_files', label: 'Arquivos Compartilhados', desc: 'Página de arquivos' },
      { key: 'portal_show_contacts', label: 'Contatos', desc: 'Página de contatos do escritório' },
      { key: 'portal_show_members', label: 'Membros Ativos / Diretório', desc: 'Página de membros ativos do produto' },
    ],
  },
  {
    title: 'Detalhes de Informação',
    items: [
      { key: 'portal_show_billing_info', label: 'Informações de Faturamento', desc: 'Dados de faturamento no contrato' },
      { key: 'portal_show_contract_values', label: 'Valores do Contrato', desc: 'Parcelas e valor total do contrato' },
    ],
  },
];

export function PortalSettingsTab() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<Setting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changes, setChanges] = useState<Record<string, boolean>>({});

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('portal_settings').select('*');
    setSettings((data as Setting[]) || []);
    setChanges({});
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const getValue = (key: string) => {
    if (key in changes) return changes[key];
    const s = settings.find((s) => s.setting_key === key);
    return s?.setting_value ?? true;
  };

  const toggle = (key: string) => {
    setChanges((prev) => ({ ...prev, [key]: !getValue(key) }));
  };

  const handleSave = async () => {
    setSaving(true);
    const keys = Object.keys(changes);
    for (const key of keys) {
      await supabase
        .from('portal_settings')
        .update({
          setting_value: changes[key],
          updated_at: new Date().toISOString(),
          updated_by: user?.id,
        })
        .eq('setting_key', key);
    }
    toast.success('Configurações do portal salvas!');
    setSaving(false);
    fetchSettings();
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  const hasChanges = Object.keys(changes).length > 0;

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Configure quais seções ficam visíveis para os clientes no portal. As mudanças são globais para todos os clientes.
      </p>

      {groups.map((group) => (
        <Card key={group.title}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">{group.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {group.items.map((item) => (
              <div key={item.key} className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">{item.label}</Label>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
                <Switch checked={getValue(item.key)} onCheckedChange={() => toggle(item.key)} />
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving || !hasChanges}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Salvar Configurações
        </Button>
      </div>
    </div>
  );
}
