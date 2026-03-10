import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { recalculateHealth } from '@/lib/health-engine';
import { Lock, Search } from 'lucide-react';

interface FieldDef {
  id: string;
  type: string;
  label: string;
  placeholder?: string;
  description?: string;
  required: boolean;
  options?: string[];
  scale_min?: number;
  scale_max?: number;
  section_id?: string | null;
  order: number;
  header_mapping: { enabled: boolean; target_field: string };
  conditional_logic: {
    enabled: boolean;
    logic_operator: 'and' | 'or';
    rules: { field_id: string; operator: string; value: string }[];
    action: 'show' | 'skip_to_section';
    target_section_id: string | null;
    routing_type?: 'answer_routing';
    routes?: { answer_value: string; target_section_id: string }[];
    default_target_section_id?: string | null;
  };
  controls_meeting_date?: boolean;
}

interface SectionDef { id: string; title: string; order: number; }

interface FormTemplate {
  id: string;
  name: string;
  form_type: string;
  fields: FieldDef[];
  sections: SectionDef[];
  post_actions: any;
}

interface OfficeOption {
  id: string;
  name: string;
  external_id?: string | null;
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

// ─── Conditional logic evaluator ───
function evaluateCondition(
  rule: { field_id: string; operator: string; value: string },
  formData: Record<string, any>,
): boolean {
  const answer = formData[rule.field_id];
  const val = rule.value;

  switch (rule.operator) {
    case 'equals': return String(answer ?? '') === val;
    case 'not_equals': return String(answer ?? '') !== val;
    case 'contains': return String(answer ?? '').toLowerCase().includes(val.toLowerCase());
    case 'not_contains': return !String(answer ?? '').toLowerCase().includes(val.toLowerCase());
    case 'greater_than': return Number(answer) > Number(val);
    case 'less_than': return Number(answer) < Number(val);
    case 'is_filled': return answer !== undefined && answer !== null && answer !== '';
    case 'is_empty': return answer === undefined || answer === null || answer === '';
    default: return true;
  }
}

function isFieldVisible(field: FieldDef, formData: Record<string, any>): boolean {
  if (!field.conditional_logic?.enabled || field.conditional_logic.routing_type === 'answer_routing') return true;
  if (!field.conditional_logic.rules.length) return true;
  const { rules, logic_operator } = field.conditional_logic;
  const results = rules.map(r => evaluateCondition(r, formData));
  return logic_operator === 'and' ? results.every(Boolean) : results.some(Boolean);
}

function hasAnyRouting(fields: FieldDef[]): boolean {
  return fields.some(f => f.conditional_logic?.enabled && f.conditional_logic.routing_type === 'answer_routing');
}

function getNextSectionFromRouting(field: FieldDef, formData: Record<string, any>): string | null {
  if (!field.conditional_logic?.enabled || field.conditional_logic.routing_type !== 'answer_routing') return null;
  const answer = formData[field.id];
  const answerStr = answer === true ? 'Sim' : answer === false ? 'Não' : String(answer ?? '');
  const route = (field.conditional_logic.routes || []).find(r => r.answer_value === answerStr);
  if (route?.target_section_id) return route.target_section_id;
  return field.conditional_logic.default_target_section_id || null;
}

export function FormFillDialog({ open, onOpenChange, officeId, meetingId, meetingType, meetingDate, templateId, onSubmitted }: Props) {
  const { session } = useAuth();
  const [templates, setTemplates] = useState<FormTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [submitting, setSubmitting] = useState(false);

  // Client selection state
  const [offices, setOffices] = useState<OfficeOption[]>([]);
  const [selectedOfficeId, setSelectedOfficeId] = useState<string>(officeId || '');
  const [officeSearch, setOfficeSearch] = useState('');
  const isOfficeLocked = !!officeId;

  // CSM state
  const [profiles, setProfiles] = useState<{ id: string; full_name: string }[]>([]);
  const [selectedCsmId, setSelectedCsmId] = useState<string>('');

  useEffect(() => {
    if (open) {
      // Load templates
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

      // Load offices for client selector (if not locked)
      if (!officeId) {
        supabase.from('offices').select('id, name, external_id, cnpj, office_code')
          .eq('status', 'ativo')
          .order('name')
          .then(({ data }) => setOffices((data as any[]) || []));
      }

      // Load profiles for CSM selector
      supabase.from('profiles').select('id, full_name')
        .order('full_name')
        .then(({ data }) => {
          setProfiles((data as any[]) || []);
          if (session?.user?.id && !selectedCsmId) {
            setSelectedCsmId(session.user.id);
          }
        });

      // Pre-select template if provided
      if (templateId) setSelectedTemplate(templateId);
      if (officeId) setSelectedOfficeId(officeId);
    }
  }, [open]);

  const currentTemplate = templates.find(t => t.id === selectedTemplate);
  const fields = useMemo(() => (currentTemplate?.fields || []).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)), [currentTemplate]);
  const sections = currentTemplate?.sections || [];
  const visibleFields = useMemo(() => fields.filter(f => isFieldVisible(f, formData)), [fields, formData]);

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
    if (officeId) {
      const o = offices.find(o => o.id === officeId);
      return o ? `${o.office_code ? `[${o.office_code}] ` : ''}${o.name}` : 'Cliente vinculado';
    }
    const o = offices.find(o => o.id === selectedOfficeId);
    return o ? `${o.office_code ? `[${o.office_code}] ` : ''}${o.name}` : '';
  }, [officeId, selectedOfficeId, offices]);

  const setValue = (fieldId: string, value: any) => {
    setFormData(prev => ({ ...prev, [fieldId]: value }));
  };

  const resolvedOfficeId = officeId || selectedOfficeId;

  const handleSubmit = async () => {
    if (!session?.user?.id || !selectedTemplate || !currentTemplate) return;

    if (!resolvedOfficeId) {
      toast.error('Selecione o cliente');
      return;
    }

    // Validate required visible fields
    for (const field of visibleFields) {
      if (field.required) {
        const val = formData[field.id];
        if (val === undefined || val === null || val === '') {
          toast.error(`Campo obrigatório: ${field.label}`);
          return;
        }
      }
    }

    setSubmitting(true);

    const submissionData: Record<string, any> = {};
    for (const f of visibleFields) {
      submissionData[f.id] = formData[f.id] ?? null;
    }

    const { data: submission, error } = await supabase.from('form_submissions').insert({
      template_id: selectedTemplate,
      office_id: resolvedOfficeId,
      meeting_id: meetingId || null,
      user_id: selectedCsmId || session.user.id,
      data: submissionData,
    }).select('id').single();

    if (error) {
      toast.error('Erro: ' + error.message);
      setSubmitting(false);
      return;
    }

    // Apply header mappings
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
      if (target.startsWith('offices.')) {
        officeUpdates[target.replace('offices.', '')] = value;
      } else if (target.startsWith('custom_field:')) {
        customFieldUpdates.push({ custom_field_id: target.replace('custom_field:', ''), value });
      }
    }

    if (Object.keys(officeUpdates).length > 0) {
      await supabase.from('offices').update(officeUpdates).eq('id', resolvedOfficeId);
    }

    for (const cfu of customFieldUpdates) {
      await supabase.from('custom_field_values').upsert({
        custom_field_id: cfu.custom_field_id,
        office_id: resolvedOfficeId,
        value_text: String(cfu.value),
        value_number: isNaN(Number(cfu.value)) ? null : Number(cfu.value),
        updated_by: session.user.id,
      }, { onConflict: 'custom_field_id,office_id' });
    }

    // Metrics history
    const now = new Date();
    const metricsData: any = {
      office_id: resolvedOfficeId,
      period_month: now.getMonth() + 1,
      period_year: now.getFullYear(),
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

    // Post-actions
    if (submission?.id && currentTemplate.post_actions && Object.keys(currentTemplate.post_actions).length > 0) {
      try {
        await supabase.functions.invoke('execute-form-post-actions', {
          body: { submission_id: submission.id, template_id: selectedTemplate, office_id: resolvedOfficeId },
        });
      } catch (err) { console.error('Post-actions error:', err); }
    }

    recalculateHealth(resolvedOfficeId);

    // Automations
    try {
      await supabase.functions.invoke('execute-automations', {
        body: { action: 'triggerV2', trigger_type: 'form.submitted', office_id: resolvedOfficeId, context: { form_id: selectedTemplate, suffix: `form_${submission?.id}` } },
      });
    } catch (autoErr) { console.error('Automation trigger failed:', autoErr); }

    onOpenChange(false);
    onSubmitted();
    setSubmitting(false);
  };

  const renderField = (field: FieldDef) => {
    const key = field.id;
    switch (field.type) {
      case 'text':
        return <Input value={formData[key] || ''} onChange={e => setValue(key, e.target.value)} placeholder={field.placeholder} />;
      case 'textarea':
        return <Textarea value={formData[key] || ''} onChange={e => setValue(key, e.target.value)} placeholder={field.placeholder} rows={3} />;
      case 'number':
        return <Input type="number" value={formData[key] || ''} onChange={e => setValue(key, e.target.value)} placeholder={field.placeholder} />;
      case 'currency':
        return <Input type="number" step="0.01" value={formData[key] || ''} onChange={e => setValue(key, e.target.value)} placeholder={field.placeholder || 'R$ 0,00'} />;
      case 'date':
        return <Input type="date" value={formData[key] || ''} onChange={e => setValue(key, e.target.value)} />;
      case 'dropdown':
        return (
          <Select value={formData[key] || ''} onValueChange={v => setValue(key, v)}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              {(field.options || []).map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
            </SelectContent>
          </Select>
        );
      case 'multi_select': {
        const selected: string[] = Array.isArray(formData[key]) ? formData[key] : [];
        return (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-1">
              {selected.map(s => (
                <Badge key={s} variant="secondary" className="cursor-pointer" onClick={() => setValue(key, selected.filter(x => x !== s))}>
                  {s} ✕
                </Badge>
              ))}
            </div>
            <Select onValueChange={v => { if (!selected.includes(v)) setValue(key, [...selected, v]); }}>
              <SelectTrigger><SelectValue placeholder="Adicionar" /></SelectTrigger>
              <SelectContent>
                {(field.options || []).filter(o => !selected.includes(o)).map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        );
      }
      case 'rating_5':
        return (
          <div className="flex gap-1">
            {[1,2,3,4,5].map(n => (
              <button key={n} type="button"
                className={`w-10 h-10 rounded border flex items-center justify-center text-sm transition-colors ${Number(formData[key]) === n ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                onClick={() => setValue(key, n)}
              >{n}</button>
            ))}
          </div>
        );
      case 'rating_nps':
        return (
          <div className="flex gap-1 flex-wrap">
            {Array.from({length:11},(_,n)=>n).map(n => (
              <button key={n} type="button"
                className={`w-9 h-9 rounded border flex items-center justify-center text-xs transition-colors ${Number(formData[key]) === n ? (n <= 6 ? 'bg-destructive text-destructive-foreground' : n <= 8 ? 'bg-yellow-500 text-white' : 'bg-green-500 text-white') : 'hover:bg-muted'}`}
                onClick={() => setValue(key, n)}
              >{n}</button>
            ))}
          </div>
        );
      case 'boolean':
        return (
          <div className="flex items-center gap-3">
            <Switch checked={formData[key] === true || formData[key] === 'true'} onCheckedChange={val => setValue(key, val)} />
            <span className="text-sm">{formData[key] === true || formData[key] === 'true' ? 'Sim' : 'Não'}</span>
          </div>
        );
      case 'file':
        return <Input type="file" onChange={e => setValue(key, e.target.files?.[0]?.name || '')} />;
      case 'linear_scale': {
        const min = field.scale_min ?? 1;
        const max = field.scale_max ?? 10;
        return (
          <div className="flex gap-1 flex-wrap">
            {Array.from({length: max - min + 1}, (_, i) => min + i).map(n => (
              <button key={n} type="button"
                className={`w-9 h-9 rounded border flex items-center justify-center text-xs transition-colors ${Number(formData[key]) === n ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                onClick={() => setValue(key, n)}
              >{n}</button>
            ))}
          </div>
        );
      }
      default:
        return <Input value={formData[key] || ''} onChange={e => setValue(key, e.target.value)} />;
    }
  };

  const useRouting = useMemo(() => sections.length > 0 && hasAnyRouting(fields), [sections, fields]);
  const [currentSectionIdx, setCurrentSectionIdx] = useState(0);
  const [sectionHistory, setSectionHistory] = useState<number[]>([0]);

  const sortedSections = useMemo(() => [...sections].sort((a, b) => a.order - b.order), [sections]);

  const getVisibleSectionIds = useCallback((): string[] => {
    if (!useRouting) return sortedSections.map(s => s.id);
    const visited: string[] = [];
    let currentId = sortedSections[0]?.id;
    const maxIter = sortedSections.length + 1;
    let iter = 0;
    while (currentId && iter < maxIter) {
      visited.push(currentId);
      const sectionFields = fields.filter(f => f.section_id === currentId);
      let nextId: string | null = null;
      for (const f of sectionFields) {
        const target = getNextSectionFromRouting(f, formData);
        if (target === '__end__') return visited;
        if (target) { nextId = target; break; }
      }
      if (nextId) { currentId = nextId; }
      else {
        const idx = sortedSections.findIndex(s => s.id === currentId);
        currentId = sortedSections[idx + 1]?.id || '';
      }
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
          {renderField(field)}
        </div>
      ));
    }

    const visibleSectionIds = getVisibleSectionIds();
    const unsectioned = visibleFields.filter(f => !f.section_id);
    const sectionGroups = sortedSections
      .filter(s => visibleSectionIds.includes(s.id))
      .map(s => ({
        section: s,
        fields: visibleFields.filter(f => f.section_id === s.id),
      }));

    return (
      <>
        {unsectioned.map(field => (
          <div key={field.id} className="space-y-2">
            <Label>{field.label}{field.required && ' *'}</Label>
            {field.description && <p className="text-xs text-muted-foreground">{field.description}</p>}
            {renderField(field)}
          </div>
        ))}
        {sectionGroups.map(g => g.fields.length > 0 && (
          <div key={g.section.id} className="space-y-3">
            <div className="border-b pb-1 pt-2">
              <h3 className="text-sm font-semibold">{g.section.title}</h3>
            </div>
            {g.fields.map(field => (
              <div key={field.id} className="space-y-2">
                <Label>{field.label}{field.required && ' *'}</Label>
                {field.description && <p className="text-xs text-muted-foreground">{field.description}</p>}
                {renderField(field)}
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
        <DialogHeader>
          <DialogTitle>Preencher Formulário</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* CSM Selector */}
          <div className="space-y-2">
            <Label>CSM responsável *</Label>
            <Select value={selectedCsmId} onValueChange={setSelectedCsmId}>
              <SelectTrigger><SelectValue placeholder="Selecione o CSM" /></SelectTrigger>
              <SelectContent>
                {profiles.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.full_name}{p.id === session?.user?.id ? ' (você)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Client Selector */}
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
                  <Input
                    className="pl-8"
                    placeholder="Buscar por nome, código ou CNPJ..."
                    value={officeSearch}
                    onChange={e => setOfficeSearch(e.target.value)}
                  />
                </div>
                <Select value={selectedOfficeId} onValueChange={setSelectedOfficeId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredOffices.map(o => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.office_code ? `[${o.office_code}] ` : ''}{o.name}{o.cnpj ? ` (${o.cnpj})` : ''}
                      </SelectItem>
                    ))}
                    {filteredOffices.length === 0 && (
                      <div className="py-2 px-3 text-sm text-muted-foreground">Nenhum cliente encontrado</div>
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Template Selector */}
          <div className="space-y-2">
            <Label>Modelo de formulário</Label>
            <Select value={selectedTemplate} onValueChange={v => { setSelectedTemplate(v); setFormData({}); }}>
              <SelectTrigger><SelectValue placeholder="Selecione o modelo" /></SelectTrigger>
              <SelectContent>
                {templates.map(t => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
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
