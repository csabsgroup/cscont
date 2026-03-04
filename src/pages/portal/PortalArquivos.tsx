import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, FileText, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';

export default function PortalArquivos() {
  const { user } = useAuth();
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: links } = await supabase.from('client_office_links').select('office_id').eq('user_id', user.id);
      const oid = links?.[0]?.office_id;
      if (!oid) { setLoading(false); return; }
      const { data } = await supabase.from('shared_files' as any).select('*').eq('office_id', oid).eq('shared_with_client', true).order('created_at', { ascending: false });
      setFiles(data || []);
      setLoading(false);
    })();
  }, [user]);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Arquivos Compartilhados</h1>
      {files.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center py-8">
          <FileText className="h-8 w-8 text-muted-foreground/40 mb-2" />
          <p className="text-sm text-muted-foreground">Nenhum arquivo compartilhado.</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {files.map((f: any) => (
            <Card key={f.id} className="cursor-pointer hover:shadow-sm transition-shadow" onClick={() => window.open(f.url, '_blank')}>
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{f.name}</p>
                    <p className="text-xs text-muted-foreground">{format(new Date(f.created_at), 'dd/MM/yyyy')}</p>
                  </div>
                </div>
                <ExternalLink className="h-4 w-4 text-muted-foreground" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
