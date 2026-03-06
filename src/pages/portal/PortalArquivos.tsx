import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { usePortal } from '@/contexts/PortalContext';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, FileText, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';

export default function PortalArquivos() {
  const { officeId } = usePortal();
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!officeId) { setLoading(false); return; }
    (async () => {
      const { data } = await supabase.from('shared_files' as any).select('*').eq('office_id', officeId).eq('shared_with_client', true).order('created_at', { ascending: false });
      setFiles(data || []);
      setLoading(false);
    })();
  }, [officeId]);

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
