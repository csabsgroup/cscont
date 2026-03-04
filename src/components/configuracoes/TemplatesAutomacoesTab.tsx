import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Zap, FileText } from 'lucide-react';

export function TemplatesAutomacoesTab() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('form_templates').select('*, products:product_id(name)').order('name');
    setTemplates(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;

  const actionLabel = (key: string) => {
    switch (key) {
      case 'create_activity': return '📋 Criar atividade';
      case 'move_stage': return '🔄 Mover etapa';
      case 'notify': return '🔔 Notificar';
      default: return key;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{templates.length} template{templates.length !== 1 ? 's' : ''} com automações</p>
      </div>

      {templates.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">Nenhum template configurado.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {templates.map(t => {
            const postActions = t.post_actions || {};
            const hasActions = Object.keys(postActions).length > 0;
            return (
              <Card key={t.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      {t.name}
                    </CardTitle>
                    <div className="flex gap-2">
                      <Badge variant="outline" className="text-xs">{t.type}</Badge>
                      {t.products?.name && <Badge variant="secondary" className="text-xs">{t.products.name}</Badge>}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {!hasActions ? (
                    <p className="text-xs text-muted-foreground">Nenhuma automação configurada para este template.</p>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                        <Zap className="h-3 w-3" /> Ao submeter este formulário:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(postActions).map(([key, config]: [string, any]) => (
                          <div key={key} className="rounded-md border p-2 text-xs">
                            <p className="font-medium">{actionLabel(key)}</p>
                            {key === 'create_activity' && config?.title && (
                              <p className="text-muted-foreground mt-1">Título: {config.title}{config.due_days ? ` • Prazo: ${config.due_days} dias` : ''}</p>
                            )}
                            {key === 'move_stage' && config?.target_stage_id && (
                              <p className="text-muted-foreground mt-1">Etapa destino configurada</p>
                            )}
                            {key === 'notify' && config?.message && (
                              <p className="text-muted-foreground mt-1">{config.message}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
