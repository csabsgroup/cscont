import { useEffect, useState, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { recalculateHealth } from '@/lib/health-engine';
import { Lock, Search } from 'lucide-react';
import { FormFieldRenderer, type FormFieldDef } from '@/components/formularios/FormFieldRenderer';

interface SectionDef { id: string; title: string; order: number; }

interface FormTemplate {
  id: string;
  name: string;
  form_type: string;
  fields: FormFieldDef[];
  sections: SectionDef[];
  post_actions: any;
}

interface OfficeOption {
  id: string;
  name: string;
  cnpj?: string | null;
  office_code?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  officeId?: string;
  meetingId?: string;
  meetingType?: string;
  meetingDate?: string;
  templateId?: string;
  onSubmitted: () => void;
}

function isFieldVisible(field: FormFieldDef, formData: Record<string, any>): boolean {
  if (!field.conditional_logic?.enabled || field.conditional_logic.routing_type === 'answer_routing') return true;
  if (!field.conditional_logic.rules?.length) return true;
  const { rules, logic_operator } = field.conditional_logic;
  const results = rules.map((r: any) => {
    const answer = formData[r.field_id];
    const val = r.value;
    switch (r.operator) {
      case 'equals': return String(answer ?? '') === val;
      case 'not_equals': return String(answer ?? '') !== val;
      case 'contains': return String(answer ?? '').toLowerCase().includes(val.toLowerCase());
      case 'is_filled': return answer !== undefined && answer !== null && answer !== '';
      case 'is_empty': return answer === undefined || answer === null || answer === '';
      default: return true;
    }
  });
  return logic_operator === 'and' ? results.every(Boolean) : results.some(Boolean);
}

function getNextSectionFromRouting(field: FormFieldDef, formData: Record<string, any>): string | null {
  if (!field.conditional_logic?.enabled || field.conditional_logic.routing_type !== 'answer_routing') return null;
  const answer = formData[field.id];
  const answerStr = answer === true ? 'Sim' : answer === false ? 'Não' : String(answer ?? '');
  const route = (field.conditional_logic.routes || []).find((r: any) => r.answer_value === answerStr);
  if (route?.target_section_id) return route.target_section_id;
  return field.conditional_logic.default_target_section_id || null;
}

export function FormFillDialog({ open, onOpenChange, officeId, meetingId, meetingType, meetingDate, templateId, onSubmitted }: Props) {
  const { session } = useAuth();
  const [templates, setTemplates] = useState<FormTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [submitting, setSubmitting] = useState(false);

  const [offices, setOffices] = useState<OfficeOption[]>([]);
  const [selectedOfficeId, setSelectedOfficeId] = useState<string>(officeId || '');
  const [officeSearch, setOfficeSearch] = useState('');
  const isOfficeLocked = !!officeId;

  const [profiles, setProfiles] = useState<{ id: string; full_name: string }[]>([]);
  const [selectedCsmId, setSelectedCsmId] = useState<string>('');

  useEffect(() => {
    if (open) {
      supabase.from('form_templates').select('id, name, form_type, fields, sections, post_actions')
        .eq('is_active', true)
        .then(({ data }) => {
          const internal = ((data as any[]) || []).filter(t => (t.form_type || 'internal') === 'internal');
          setTemplates(internal.map(t => ({
            ...t,
            fields: Array.isArray(t.fields) ? t.fields : [],
            sections: Array.isArray(t.sections) ? t.sections : [],
          })));
        });

      // FIX: Load ALL offices, not just status='ativo'
      if (!officeId) {
        supabase.from('offices').select('id, name, external_id, cnpj, office_code')
          .order('name')
          .then(({ data }) => setOffices((data as any[]) || []));
      }

      supabase.from('profiles').select('id, full_name')
        .order('full_name')
        .then(({ data }) => {
          setProfiles((data as any[]) || []);
          if (session?.user?.id && !selectedCsmId) setSelectedCsmId(session.user.id);
        });

      if (templateId) setSelectedTemplate(templateId);
      if (officeId) setSelectedOfficeId(officeId);
    }
  }, [open]);

  const currentTemplate = templates.find(t => t.id === selectedTemplate);
  const fields = useMemo(() => (currentTemplate?.fields || []).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)), [currentTemplate]);
  const sections = currentTemplate?.sections || [];
  const visibleFields = useMemo(() => fields.filter(f => isFieldVisible(f, formData)), [fields, formData]);
  const useRouting = useMemo(() => sections.length > 0 && fields.some(f => f.conditional_logic?.enabled && f.conditional_logic.routing_type === 'answer_routing'), [sections, fields]);

  const filteredOffices = useMemo(() => {
    if (!officeSearch.trim()) return offices;
    const q = officeSearch.toLowerCase();
    return offices.filter(o =>
      o.name?.toLowerCase().includes(q) ||
      o.external_id?.toLowerCase().includes(q) ||
      o.cnpj?.toLowerCase().includes(q) ||
      o.office_code?.toLowerCase().includes(q)
    );
  }, [offices, officeSearch]);

  const selectedOfficeName = useMemo(() => {
    const o = offices.find(o => o.id === (officeId || selectedOfficeId));
    return o ? `${o.office_code ? `[${o.office_code}] ` : ''}${o.name}` : officeId ? 'Cliente vinculado' : '';
  }, [officeId, selectedOfficeId, offices]);

  const setValue = (fieldId: string, value: any) => setFormData(prev => ({ ...prev, [fieldId]: value }));
  const resolvedOfficeId = officeId || selectedOfficeId;

  const handleSubmit = async () => {
    if (!session?.user?.id || !selectedTemplate || !currentTemplate) return;
    if (!resolvedOfficeId) { toast.error('Selecione o cliente'); return; }

    for (const field of visibleFields) {
      if (field.required) {
        const val = formData[field.id];
        if (val === undefined || val === null || val === '') { toast.error(`Campo obrigatório: ${field.label}`); return; }
      }
    }

    setSubmitting(true);
    const submissionData: Record<string, any> = {};
    for (const f of visibleFields) submissionData[f.id] = formData[f.id] ?? null;

    const { data: submission, error } = await supabase.from('form_submissions').insert({
      template_id: selectedTemplate,
      office_id: resolvedOfficeId,
      meeting_id: meetingId || null,
      user_id: selectedCsmId || session.user.id,
      data: submissionData,
    }).select('id').single();

    if (error) { toast.error('Erro: ' + error.message); setSubmitting(false); return; }

    // Header mappings
    const officeUpdates: Record<string, any> = {};
    const customFieldUpdates: { custom_field_id: string; value: any }[] = [];

    const meetingControlField = fields.find(f => f.controls_meeting_date);
    const meetingHappened = meetingControlField ? formData[meetingControlField.id] === true || formData[meetingControlField.id] === 'true' : true;

    if (meetingHappened && meetingDate) {
      officeUpdates.last_meeting_date = meetingDate;
      if (meetingType) officeUpdates.last_meeting_type = meetingType;
    }

    for (const field of visibleFields) {
      if (!field.header_mapping?.enabled || !field.header_mapping.target_field) continue;
      const value = formData[field.id];
      if (value === undefined || value === null || value === '') continue;
      const target = field.header_mapping.target_field;
      if (target.startsWith('offices.')) officeUpdates[target.replace('offices.', '')] = value;
      else if (target.startsWith('custom_field:'))
        customFieldUpdates.push({ custom_field_id: target.replace('custom_field:', ''), value });
    }

    if (Object.keys(officeUpdates).length > 0) await supabase.from('offices').update(officeUpdates).eq('id', resolvedOfficeId);
    for (const cfu of customFieldUpdates) {
      await supabase.from('custom_field_values').upsert({
        custom_field_id: cfu.custom_field_id, office_id: resolvedOfficeId,
        value_text: String(cfu.value),
        value_number: isNaN(Number(cfu.value)) ? null : Number(cfu.value),
        updated_by: session.user.id,
      }, { onConflict: 'custom_field_id,office_id' });
    }

    // Metrics
    const now = new Date();
    const metricsData: any = {
      office_id: resolvedOfficeId, period_month: now.getMonth() + 1, period_year: now.getFullYear(),
      form_submission_id: submission?.id,
    };
    if (officeUpdates.faturamento_mensal !== undefined) metricsData.faturamento_mensal = officeUpdates.faturamento_mensal;
    if (officeUpdates.faturamento_anual !== undefined) metricsData.faturamento_anual = officeUpdates.faturamento_anual;
    if (officeUpdates.qtd_clientes !== undefined) metricsData.qtd_clientes = officeUpdates.qtd_clientes;
    if (officeUpdates.qtd_colaboradores !== undefined) metricsData.qtd_colaboradores = officeUpdates.qtd_colaboradores;
    if (officeUpdates.last_nps !== undefined) metricsData.nps_score = officeUpdates.last_nps;
    if (officeUpdates.last_csat !== undefined) metricsData.csat_score = officeUpdates.last_csat;
    if (officeUpdates.cs_feeling !== undefined) metricsData.cs_feeling = officeUpdates.cs_feeling;
    if (Object.keys(metricsData).length > 3) {
      await supabase.from('office_metrics_history').upsert(metricsData, { onConflict: 'office_id,period_month,period_year' });
    }

    toast.success('Formulário salvo!');

    if (submission?.id && currentTemplate.post_actions && Object.keys(currentTemplate.post_actions).length > 0) {
      try {
        await supabase.functions.invoke('execute-form-post-actions', {
          body: { submission_id: submission.id, template_id: selectedTemplate, office_id: resolvedOfficeId },
        });
      } catch (err) { console.error('Post-actions error:', err); }
    }

    recalculateHealth(resolvedOfficeId);

    try {
      await supabase.functions.invoke('execute-automations', {
        body: { action: 'triggerV2', trigger_type: 'form.submitted', office_id: resolvedOfficeId, context: { form_id: selectedTemplate, suffix: `form_${submission?.id}` } },
      });
    } catch (autoErr) { console.error('Automation trigger failed:', autoErr); }

    onOpenChange(false);
    onSubmitted();
    setSubmitting(false);
  };

  const sortedSections = useMemo(() => [...sections].sort((a, b) => a.order - b.order), [sections]);

  const getVisibleSectionIds = useCallback((): string[] => {
    if (!useRouting) return sortedSections.map(s => s.id);
    const visited: string[] = [];
    let currentId = sortedSections[0]?.id;
    let iter = 0;
    while (currentId && iter < sortedSections.length + 1) {
      visited.push(currentId);
      const sectionFields = fields.filter(f => f.section_id === currentId);
      let nextId: string | null = null;
      for (const f of sectionFields) {
        const target = getNextSectionFromRouting(f, formData);
        if (target === '__end__') return visited;
        if (target) { nextId = target; break; }
      }
      if (nextId) currentId = nextId;
      else { const idx = sortedSections.findIndex(s => s.id === currentId); currentId = sortedSections[idx + 1]?.id || ''; }
      iter++;
    }
    return visited;
  }, [useRouting, sortedSections, fields, formData]);

  const renderFields = () => {
    if (sections.length === 0) {
      return visibleFields.map(field => (
        <div key={field.id} className="space-y-2">
          <Label>{field.label || '(sem label)'}{field.required && ' *'}</Label>
          {field.description && <p className="text-xs text-muted-foreground">{field.description}</p>}
          <FormFieldRenderer field={field} value={formData[field.id]} onChange={v => setValue(field.id, v)} />
        </div>
      ));
    }

    const visibleSectionIds = getVisibleSectionIds();
    const unsectioned = visibleFields.filter(f => !f.section_id);
    const sectionGroups = sortedSections.filter(s => visibleSectionIds.includes(s.id))
      .map(s => ({ section: s, fields: visibleFields.filter(f => f.section_id === s.id) }));

    return (
      <>
        {unsectioned.map(field => (
          <div key={field.id} className="space-y-2">
            <Label>{field.label}{field.required && ' *'}</Label>
            {field.description && <p className="text-xs text-muted-foreground">{field.description}</p>}
            <FormFieldRenderer field={field} value={formData[field.id]} onChange={v => setValue(field.id, v)} />
          </div>
        ))}
        {sectionGroups.map(g => g.fields.length > 0 && (
          <div key={g.section.id} className="space-y-3">
            <div className="border-b pb-1 pt-2"><h3 className="text-sm font-semibold">{g.section.title}</h3></div>
            {g.fields.map(field => (
              <div key={field.id} className="space-y-2">
                <Label>{field.label}{field.required && ' *'}</Label>
                {field.description && <p className="text-xs text-muted-foreground">{field.description}</p>}
                <FormFieldRenderer field={field} value={formData[field.id]} onChange={v => setValue(field.id, v)} />
              </div>
            ))}
          </div>
        ))}
      </>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Preencher Formulário</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>CSM responsável *</Label>
            <Select value={selectedCsmId} onValueChange={setSelectedCsmId}>
              <SelectTrigger><SelectValue placeholder="Selecione o CSM" /></SelectTrigger>
              <SelectContent>
                {profiles.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.full_name}{p.id === session?.user?.id ? ' (você)' : ''}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Cliente *</Label>
            {isOfficeLocked ? (
              <div className="flex items-center gap-2 p-2.5 bg-muted rounded-md border">
                <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm">{selectedOfficeName || 'Carregando...'}</span>
              </div>
            ) : (
              <div className="space-y-1">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input className="pl-8" placeholder="Buscar por nome, código ou CNPJ..." value={officeSearch} onChange={e => setOfficeSearch(e.target.value)} />
                </div>
                <Select value={selectedOfficeId} onValueChange={setSelectedOfficeId}>
                  <SelectTrigger><SelectValue placeholder="Selecione o cliente" /></SelectTrigger>
                  <SelectContent>
                    {filteredOffices.map(o => (
                      <SelectItem key={o.id} value={o.id}>{o.office_code ? `[${o.office_code}] ` : ''}{o.name}{o.cnpj ? ` (${o.cnpj})` : ''}</SelectItem>
                    ))}
                    {filteredOffices.length === 0 && <div className="py-2 px-3 text-sm text-muted-foreground">Nenhum cliente encontrado</div>}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Modelo de formulário</Label>
            <Select value={selectedTemplate} onValueChange={v => { setSelectedTemplate(v); setFormData({}); }}>
              <SelectTrigger><SelectValue placeholder="Selecione o modelo" /></SelectTrigger>
              <SelectContent>
                {templates.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {selectedTemplate && (
            <div className="border-t pt-3 space-y-4">
              {renderFields()}
            </div>
          )}

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
