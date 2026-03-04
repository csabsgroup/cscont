import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

interface FormTemplate {
  id: string;
  name: string;
  type: string;
  fields: any[];
  post_actions: any;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meetingId: string;
  officeId: string;
  onSubmitted: () => void;
}

export function FormFillDialog({ open, onOpenChange, meetingId, officeId, onSubmitted }: Props) {
  const { session } = useAuth();
  const [templates, setTemplates] = useState<FormTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      supabase.from('form_templates').select('id, name, type, fields, post_actions')
        .then(({ data }) => setTemplates((data as any[]) || []));
    }
  }, [open]);

  const currentTemplate = templates.find(t => t.id === selectedTemplate);
  const fields = (currentTemplate?.fields || []) as any[];

  const handleSubmit = async () => {
    if (!session?.user?.id || !selectedTemplate) return;
    setSubmitting(true);

    // Insert form submission
    const { data: submission, error } = await supabase.from('form_submissions').insert({
      template_id: selectedTemplate,
      office_id: officeId,
      meeting_id: meetingId,
      user_id: session.user.id,
      data: formData,
    }).select('id').single();

    if (error) {
      toast.error('Erro: ' + error.message);
      setSubmitting(false);
      return;
    }

    toast.success('Formulário salvo!');

    // Execute post-actions via edge function
    if (submission?.id && currentTemplate?.post_actions && Object.keys(currentTemplate.post_actions).length > 0) {
      try {
        const { data: result, error: fnError } = await supabase.functions.invoke('execute-form-post-actions', {
          body: {
            submission_id: submission.id,
            template_id: selectedTemplate,
            office_id: officeId,
          },
        });
        if (fnError) {
          console.error('Post-actions error:', fnError);
          toast.error('Formulário salvo, mas automações falharam');
        } else if (result?.results) {
          const actions = Object.keys(result.results).filter(k => !result.results[k].skipped);
          if (actions.length > 0) {
            toast.success(`Automações executadas: ${actions.join(', ')}`);
          }
        }
      } catch (err) {
        console.error('Post-actions invocation error:', err);
      }
    }

    onOpenChange(false);
    onSubmitted();
    setSubmitting(false);
  };

  const renderField = (field: any) => {
    const key = field.key || field.label;
    switch (field.type) {
      case 'text':
        return <Input value={formData[key] || ''} onChange={e => setFormData({ ...formData, [key]: e.target.value })} />;
      case 'textarea':
        return <Textarea value={formData[key] || ''} onChange={e => setFormData({ ...formData, [key]: e.target.value })} rows={3} />;
      case 'number':
      case 'rating_5':
      case 'rating_nps':
        return <Input type="number" min={field.type === 'rating_5' ? 1 : field.type === 'rating_nps' ? 0 : undefined} max={field.type === 'rating_5' ? 5 : field.type === 'rating_nps' ? 10 : undefined} value={formData[key] || ''} onChange={e => setFormData({ ...formData, [key]: e.target.value })} />;
      case 'date':
        return <Input type="date" value={formData[key] || ''} onChange={e => setFormData({ ...formData, [key]: e.target.value })} />;
      case 'dropdown':
        return (
          <Select value={formData[key] || ''} onValueChange={v => setFormData({ ...formData, [key]: v })}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              {(field.options || []).map((opt: string) => (
                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      default:
        return <Input value={formData[key] || ''} onChange={e => setFormData({ ...formData, [key]: e.target.value })} />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Preencher Formulário da Reunião</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Modelo de formulário</Label>
            <Select value={selectedTemplate} onValueChange={v => { setSelectedTemplate(v); setFormData({}); }}>
              <SelectTrigger><SelectValue placeholder="Selecione o modelo" /></SelectTrigger>
              <SelectContent>
                {templates.map(t => (
                  <SelectItem key={t.id} value={t.id}>{t.name} ({t.type})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {fields.map((field: any, i: number) => (
            <div key={i} className="space-y-2">
              <Label>{field.label || field.key}{field.required && ' *'}</Label>
              {renderField(field)}
            </div>
          ))}

          {selectedTemplate && (
            <Button onClick={handleSubmit} className="w-full" disabled={submitting}>
              {submitting ? 'Salvando...' : 'Salvar Formulário'}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
