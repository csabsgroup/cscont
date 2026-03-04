import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  meetingId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TranscriptModal({ meetingId, open, onOpenChange }: Props) {
  const [transcript, setTranscript] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open && meetingId) {
      setLoading(true);
      supabase
        .from('meeting_transcripts')
        .select('*')
        .eq('meeting_id', meetingId)
        .single()
        .then(({ data }) => {
          setTranscript(data);
          setLoading(false);
        });
    }
  }, [open, meetingId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Transcrição da Reunião</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : !transcript ? (
          <p className="text-sm text-muted-foreground py-4">Nenhuma transcrição encontrada.</p>
        ) : (
          <Tabs defaultValue="summary" className="w-full">
            <TabsList className="w-full">
              <TabsTrigger value="summary" className="flex-1">Resumo</TabsTrigger>
              <TabsTrigger value="transcript" className="flex-1">Transcrição</TabsTrigger>
              <TabsTrigger value="actions" className="flex-1">Action Items</TabsTrigger>
            </TabsList>
            <TabsContent value="summary" className="mt-4">
              <p className="text-sm whitespace-pre-wrap">{transcript.summary || 'Sem resumo disponível.'}</p>
            </TabsContent>
            <TabsContent value="transcript" className="mt-4">
              <p className="text-sm whitespace-pre-wrap max-h-96 overflow-y-auto">{transcript.transcript || 'Sem transcrição.'}</p>
            </TabsContent>
            <TabsContent value="actions" className="mt-4">
              {Array.isArray(transcript.action_items) && transcript.action_items.length > 0 ? (
                <ul className="space-y-2">
                  {transcript.action_items.map((item: any, i: number) => (
                    <li key={i} className="flex items-start gap-2">
                      <Badge variant="outline" className="text-xs mt-0.5">{i + 1}</Badge>
                      <span className="text-sm">{typeof item === 'string' ? item : item.text || JSON.stringify(item)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhum action item.</p>
              )}
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
