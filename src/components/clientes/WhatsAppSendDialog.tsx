import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Send, ExternalLink, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Contact {
  id: string;
  name: string;
  phone: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  officeId: string;
  officeName: string;
  contacts: Contact[];
}

export function WhatsAppSendDialog({ open, onOpenChange, officeId, officeName, contacts }: Props) {
  const [tab, setTab] = useState('template');
  const [contactId, setContactId] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const selectedContact = contacts.find(c => c.id === contactId);
  const phone = selectedContact?.phone?.replace(/\D/g, '') || '';

  const sendTemplate = async () => {
    if (!phone || !contactId) { toast.error('Selecione um contato com telefone'); return; }
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('integration-whatsapp', {
        body: {
          action: 'sendTemplate',
          to: phone,
          template_name: 'hello_world', // Default template
          office_id: officeId,
          contact_id: contactId,
        },
      });
      if (error) throw error;
      toast.success('Mensagem enviada via WhatsApp!');
      onOpenChange(false);
    } catch (e: any) {
      toast.error('Erro: ' + e.message);
    }
    setSending(false);
  };

  const openWhatsAppWeb = () => {
    if (!phone) { toast.error('Selecione um contato com telefone'); return; }
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
    
    // Log as manual message
    supabase.functions.invoke('integration-whatsapp', {
      body: {
        action: 'logNote',
        office_id: officeId,
        contact_id: contactId,
        content: message,
        direction: 'sent',
        phone_to: phone,
      },
    });
    
    toast.success('Mensagem registrada na timeline');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Enviar WhatsApp — {officeName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Contato</Label>
            <Select value={contactId} onValueChange={setContactId}>
              <SelectTrigger><SelectValue placeholder="Selecione o contato" /></SelectTrigger>
              <SelectContent>
                {contacts.filter(c => c.phone).map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name} ({c.phone})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="w-full">
              <TabsTrigger value="template" className="flex-1">Template (API)</TabsTrigger>
              <TabsTrigger value="manual" className="flex-1">Texto Livre</TabsTrigger>
            </TabsList>
            <TabsContent value="template" className="mt-3 space-y-3">
              <p className="text-xs text-muted-foreground">
                Envia um template pré-aprovado pela Meta via API do WhatsApp Business.
              </p>
              <Button onClick={sendTemplate} disabled={sending || !contactId} className="w-full">
                {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                Enviar Template
              </Button>
            </TabsContent>
            <TabsContent value="manual" className="mt-3 space-y-3">
              <Textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Digite a mensagem..."
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                Abre o WhatsApp Web em nova aba. A mensagem será registrada na timeline.
              </p>
              <Button onClick={openWhatsAppWeb} disabled={!contactId || !message} variant="outline" className="w-full">
                <ExternalLink className="mr-2 h-4 w-4" />
                Abrir WhatsApp Web
              </Button>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
