import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, X, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { generateNextOfficeCode } from '@/lib/office-code-helpers';
import { addMonths, format } from 'date-fns';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: { id: string; name: string }[];
  csmList: { id: string; full_name: string | null }[];
  onCreated: () => void;
}

const UF_OPTIONS = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA',
  'PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO',
];

const STATUS_OPTIONS = [
  { value: 'ativo', label: 'Ativo' },
  { value: 'nao_iniciado', label: 'Não Iniciado' },
  { value: 'pausado', label: 'Pausado' },
];

interface ContactData {
  name: string;
  email: string;
  phone: string;
  cpf: string;
  role_title: string;
  birthday: string;
  instagram: string;
  is_sponsor: boolean;
}

const emptyContact = (): ContactData => ({
  name: '', email: '', phone: '', cpf: '', role_title: '', birthday: '', instagram: '', is_sponsor: true,
});

export function CreateClientWizard({ open, onOpenChange, products, csmList, onCreated }: Props) {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // Step 1 — Empresa
  const [empresa, setEmpresa] = useState({
    name: '', cnpj: '', email: '', whatsapp: '', phone: '', address: '',
    city: '', state: '', cep: '', segment: '', product_id: '', csm_id: '',
    status: 'ativo', notes: '',
  });

  // Step 2 — Contatos
  const [contacts, setContacts] = useState<ContactData[]>([emptyContact()]);

  // Step 3 — Contrato
  const [contrato, setContrato] = useState({
    value: '', monthly_value: '', installments: '12',
    start_date: '', end_date: '', status: 'ativo', asaas_link: '', notes: '',
  });

  const reset = () => {
    setStep(1);
    setEmpresa({ name: '', cnpj: '', email: '', whatsapp: '', phone: '', address: '', city: '', state: '', cep: '', segment: '', product_id: '', csm_id: '', status: 'ativo', notes: '' });
    setContacts([emptyContact()]);
    setContrato({ value: '', monthly_value: '', installments: '12', start_date: '', end_date: '', status: 'ativo', asaas_link: '', notes: '' });
  };

  const handleClose = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  // Auto-calc end date
  const handleStartDateChange = (date: string) => {
    setContrato(p => {
      const newState = { ...p, start_date: date };
      if (date && !p.end_date) {
        try {
          newState.end_date = format(addMonths(new Date(date), 12), 'yyyy-MM-dd');
        } catch { /* ignore */ }
      }
      return newState;
    });
  };

  const addContact = () => setContacts(p => [...p, { ...emptyContact(), is_sponsor: false }]);
  const removeContact = (i: number) => setContacts(p => p.filter((_, j) => j !== i));
  const updateContact = (i: number, field: keyof ContactData, value: any) => {
    setContacts(p => p.map((c, j) => j === i ? { ...c, [field]: value } : c));
  };

  const handleCreate = async (skipContract = false) => {
    if (!empresa.name.trim()) { toast.error('Nome do escritório é obrigatório.'); return; }
    if (!empresa.product_id) { toast.error('Produto é obrigatório.'); return; }

    setSaving(true);
    try {
      // BUG 3 fix: Retry loop with re-query on race condition (up to 3 attempts)
      let office: { id: string; active_product_id: string | null } | null = null;
      let finalCode: string | null = null;

      for (let attempt = 0; attempt < 3; attempt++) {
        const officeCode = await generateNextOfficeCode(empresa.product_id);
        // On retry, increment by attempt to avoid same collision
        let codeToUse = officeCode;
        if (attempt > 0 && officeCode) {
          const match = officeCode.match(/^(.+) - (\d+)$/);
          if (match) {
            codeToUse = `${match[1]} - ${String(parseInt(match[2], 10) + attempt).padStart(3, '0')}`;
          }
        }

        const { data, error } = await supabase.from('offices').insert({
          name: empresa.name,
          cnpj: empresa.cnpj || null,
          email: empresa.email || null,
          whatsapp: empresa.whatsapp || null,
          phone: empresa.phone || null,
          address: empresa.address || null,
          city: empresa.city || null,
          state: empresa.state || null,
          cep: empresa.cep || null,
          segment: empresa.segment || null,
          active_product_id: empresa.product_id,
          csm_id: empresa.csm_id || null,
          status: empresa.status as any,
          notes: empresa.notes || null,
          office_code: codeToUse,
        }).select('id, active_product_id').single();

        if (!error) {
          office = data;
          finalCode = codeToUse;
          break;
        }

        // Only retry on unique violation
        if (error.code !== '23505' || attempt === 2) throw error;
        console.warn(`Office code collision (attempt ${attempt + 1}), retrying...`);
      }

      if (!office) throw new Error('Falha ao criar escritório após 3 tentativas.');

      await finishCreation(office, finalCode, skipContract);
    } catch (e: any) {
      toast.error('Erro ao criar cliente: ' + (e.message || e));
    } finally {
      setSaving(false);
    }
  };

  const finishCreation = async (office: { id: string; active_product_id: string | null }, officeCode: string | null, skipContract = false) => {
    let contactName = '';
    let contratoValue = '';

    // 3. Create contacts
    const validContacts = contacts.filter(c => c.name.trim());
    if (validContacts.length > 0) {
      for (let i = 0; i < validContacts.length; i++) {
        const c = validContacts[i];
        const { error: cErr } = await supabase.from('contacts').insert({
          office_id: office.id,
          name: c.name,
          email: c.email || null,
          phone: c.phone || null,
          whatsapp: c.phone || null,
          cpf: c.cpf || null,
          role_title: c.role_title || null,
          birthday: c.birthday || null,
          instagram: c.instagram || null,
          is_main_contact: i === 0 || c.is_sponsor,
          contact_type: c.is_sponsor ? 'sponsor' : 'decisor',
        });
        if (cErr) console.error('Contact insert error:', cErr.message);
      }
      contactName = validContacts[0].name;
    }

    // 4. Create contract
    const totalValue = parseFloat(contrato.value) || 0;
    const monthlyValue = parseFloat(contrato.monthly_value) || 0;
    if (totalValue > 0 || monthlyValue > 0) {
      const endDate = contrato.end_date || (contrato.start_date ? format(addMonths(new Date(contrato.start_date), 12), 'yyyy-MM-dd') : null);

      const { error: ctErr } = await supabase.from('contracts').insert({
        office_id: office.id,
        product_id: office.active_product_id!,
        value: totalValue || null,
        monthly_value: monthlyValue || null,
        installments_total: parseInt(contrato.installments) || 12,
        start_date: contrato.start_date || null,
        end_date: endDate,
        status: 'ativo' as any,
        asaas_link: contrato.asaas_link || null,
        negotiation_notes: contrato.notes || null,
      });
      if (ctErr) console.error('Contract insert error:', ctErr.message);

      // Update office MRR and cycle dates
      const mrr = monthlyValue || (totalValue / 12);
      await supabase.from('offices').update({
        mrr,
        cycle_start_date: contrato.start_date || null,
        cycle_end_date: endDate,
        activation_date: contrato.start_date || null,
      }).eq('id', office.id);

      contratoValue = totalValue > 0 ? `R$ ${totalValue.toLocaleString('pt-BR')}` : `R$ ${(monthlyValue * 12).toLocaleString('pt-BR')}`;
    }

    // 5. Trigger automations
    try {
      if (office.active_product_id) {
        await supabase.functions.invoke('execute-automations', {
          body: { action: 'onNewOffice', office_id: office.id, product_id: office.active_product_id },
        });
      } else {
        await supabase.functions.invoke('execute-automations', {
          body: { action: 'triggerV2', trigger_type: 'office.registered', office_id: office.id },
        });
      }
    } catch (e) { console.error('Automation trigger failed:', e); }

    // 6. Toast
    const parts = [`Cliente "${empresa.name}" criado com sucesso!`];
    if (officeCode) parts.push(`ID: ${officeCode}`);
    if (contactName) parts.push(`Contato: ${contactName}`);
    if (contratoValue) parts.push(`Contrato: ${contratoValue}`);
    toast.success(parts.join(' | '));

    handleClose(false);
    onCreated();
  };

  const stepIndicator = (
    <div className="flex items-center justify-center gap-2 mb-4">
      {[1, 2, 3].map(s => (
        <div key={s} className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
            s === step ? 'bg-primary text-primary-foreground' : s < step ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
          }`}>
            {s}
          </div>
          <span className={`text-xs hidden sm:inline ${s === step ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
            {s === 1 ? 'Empresa' : s === 2 ? 'Contato' : 'Contrato'}
          </span>
          {s < 3 && <div className="w-8 h-px bg-border" />}
        </div>
      ))}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Cliente — Etapa {step} de 3: {step === 1 ? 'Dados da Empresa' : step === 2 ? 'Contato Principal' : 'Contrato'}</DialogTitle>
        </DialogHeader>

        {stepIndicator}

        {/* Step 1 — Empresa */}
        {step === 1 && (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Nome do escritório *</Label>
              <Input value={empresa.name} onChange={e => setEmpresa(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">CNPJ</Label>
                <Input value={empresa.cnpj} onChange={e => setEmpresa(p => ({ ...p, cnpj: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Email</Label>
                <Input type="email" value={empresa.email} onChange={e => setEmpresa(p => ({ ...p, email: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">WhatsApp</Label>
                <Input value={empresa.whatsapp} onChange={e => setEmpresa(p => ({ ...p, whatsapp: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Telefone fixo</Label>
                <Input value={empresa.phone} onChange={e => setEmpresa(p => ({ ...p, phone: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Endereço</Label>
              <Input value={empresa.address} onChange={e => setEmpresa(p => ({ ...p, address: e.target.value }))} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Cidade</Label>
                <Input value={empresa.city} onChange={e => setEmpresa(p => ({ ...p, city: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Estado</Label>
                <Select value={empresa.state} onValueChange={v => setEmpresa(p => ({ ...p, state: v }))}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="UF" /></SelectTrigger>
                  <SelectContent>
                    {UF_OPTIONS.map(uf => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">CEP</Label>
                <Input value={empresa.cep} onChange={e => setEmpresa(p => ({ ...p, cep: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Segmento</Label>
                <Input value={empresa.segment} onChange={e => setEmpresa(p => ({ ...p, segment: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Produto *</Label>
                <Select value={empresa.product_id} onValueChange={v => setEmpresa(p => ({ ...p, product_id: v }))}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">CSM responsável</Label>
                <Select value={empresa.csm_id} onValueChange={v => setEmpresa(p => ({ ...p, csm_id: v }))}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {csmList.map(c => <SelectItem key={c.id} value={c.id}>{c.full_name || c.id}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Status</Label>
                <Select value={empresa.status} onValueChange={v => setEmpresa(p => ({ ...p, status: v }))}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Observações</Label>
              <Textarea value={empresa.notes} onChange={e => setEmpresa(p => ({ ...p, notes: e.target.value }))} rows={2} />
            </div>
          </div>
        )}

        {/* Step 2 — Contatos */}
        {step === 2 && (
          <div className="space-y-4">
            {contacts.map((c, i) => (
              <div key={i} className="space-y-3 border border-border rounded-lg p-3 relative">
                {contacts.length > 1 && (
                  <Button size="sm" variant="ghost" className="absolute top-2 right-2 h-6 w-6 p-0" onClick={() => removeContact(i)}>
                    <X className="h-3 w-3" />
                  </Button>
                )}
                <div className="space-y-1">
                  <Label className="text-xs">Nome do sócio/contato {i === 0 ? '*' : ''}</Label>
                  <Input value={c.name} onChange={e => updateContact(i, 'name', e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Email</Label>
                    <Input type="email" value={c.email} onChange={e => updateContact(i, 'email', e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Telefone/WhatsApp</Label>
                    <Input value={c.phone} onChange={e => updateContact(i, 'phone', e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">CPF</Label>
                    <Input value={c.cpf} onChange={e => updateContact(i, 'cpf', e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Cargo</Label>
                    <Input value={c.role_title} onChange={e => updateContact(i, 'role_title', e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Data de nascimento</Label>
                    <Input type="date" value={c.birthday} onChange={e => updateContact(i, 'birthday', e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Instagram</Label>
                    <Input value={c.instagram} onChange={e => updateContact(i, 'instagram', e.target.value)} placeholder="@" />
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox checked={c.is_sponsor} onCheckedChange={v => updateContact(i, 'is_sponsor', !!v)} />
                    Sponsor (principal)
                  </label>
                </div>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addContact}>
              <Plus className="mr-1 h-4 w-4" />Adicionar outro contato
            </Button>
          </div>
        )}

        {/* Step 3 — Contrato */}
        {step === 3 && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Valor total do contrato</Label>
                <Input type="number" step="0.01" placeholder="R$" value={contrato.value} onChange={e => setContrato(p => ({ ...p, value: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Valor da mensalidade</Label>
                <Input type="number" step="0.01" placeholder="R$" value={contrato.monthly_value} onChange={e => setContrato(p => ({ ...p, monthly_value: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Qtd de parcelas</Label>
                <Input type="number" value={contrato.installments} onChange={e => setContrato(p => ({ ...p, installments: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Data início</Label>
                <Input type="date" value={contrato.start_date} onChange={e => handleStartDateChange(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Data fim</Label>
                <Input type="date" value={contrato.end_date} onChange={e => setContrato(p => ({ ...p, end_date: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Referência Asaas</Label>
              <Input value={contrato.asaas_link} onChange={e => setContrato(p => ({ ...p, asaas_link: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Observações</Label>
              <Textarea value={contrato.notes} onChange={e => setContrato(p => ({ ...p, notes: e.target.value }))} rows={2} />
            </div>
          </div>
        )}

        <DialogFooter className="flex justify-between sm:justify-between">
          <div className="flex gap-2">
            {step > 1 && (
              <Button variant="outline" onClick={() => setStep(s => s - 1)}>← Anterior</Button>
            )}
            {step === 1 && (
              <Button variant="outline" onClick={() => handleClose(false)}>Cancelar</Button>
            )}
          </div>
          <div className="flex gap-2">
            {step === 2 && (
              <Button variant="ghost" onClick={() => { setContacts([emptyContact()]); setStep(3); }}>Pular</Button>
            )}
            {step === 3 && (
              <Button variant="ghost" onClick={() => { setContrato({ value: '', monthly_value: '', installments: '12', start_date: '', end_date: '', status: 'ativo', asaas_link: '', notes: '' }); handleCreate(); }}>Pular</Button>
            )}
            {step < 3 && (
              <Button onClick={() => {
                if (step === 1 && (!empresa.name.trim() || !empresa.product_id)) {
                  toast.error('Nome e Produto são obrigatórios.');
                  return;
                }
                setStep(s => s + 1);
              }}>Próximo →</Button>
            )}
            {step === 3 && (
              <Button onClick={handleCreate} disabled={saving}>
                {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Criando...</> : 'Criar Cliente'}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
