import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Search, Circle } from 'lucide-react';

interface PiperunField {
  key: string;
  label: string;
  example_value?: string;
  category?: string;
}

interface FieldCategory {
  label: string;
  prefix: string;
}

const FIELD_CATEGORIES: FieldCategory[] = [
  { label: '📋 Oportunidade (Deal)', prefix: 'deal.' },
  { label: '🏢 Empresa (Company)', prefix: 'company.' },
  { label: '👤 Contato (Pessoa)', prefix: 'person.' },
  { label: '📄 Proposta', prefix: 'proposal.' },
  { label: '🔏 Assinatura', prefix: 'signature.' },
];

const FALLBACK_FIELDS: PiperunField[] = [
  // ── Deal ──
  { key: 'deal.title', label: 'Título da oportunidade', example_value: 'Escritório ABC' },
  { key: 'deal.value', label: 'Valor da oportunidade', example_value: '5000' },
  { key: 'deal.monthly_value', label: 'Valor mensal', example_value: '500' },
  { key: 'deal.status', label: 'Status', example_value: 'won' },
  { key: 'deal.won_at', label: 'Data de ganho', example_value: '2026-02-20' },
  { key: 'deal.closed_at', label: 'Data de fechamento', example_value: '2026-02-20' },
  { key: 'deal.close_forecast', label: 'Previsão de fechamento', example_value: '2026-04-01' },
  { key: 'deal.observation', label: 'Observação', example_value: 'Cliente indicado' },
  { key: 'deal.origin', label: 'Origem', example_value: 'Indicação' },
  { key: 'deal.tags', label: 'Tags', example_value: 'premium, contabil' },
  { key: 'deal.created_at', label: 'Criado em', example_value: '2026-01-15' },
  { key: 'deal.updated_at', label: 'Atualizado em', example_value: '2026-03-04' },
  { key: 'deal.owner.name', label: 'Responsável (vendedor)', example_value: 'Maria CSM' },
  { key: 'deal.owner.email', label: 'Email do responsável', example_value: 'maria@empresa.com' },
  { key: 'deal.stage.name', label: 'Etapa do funil', example_value: 'Fechamento' },
  { key: 'deal.pipeline.name', label: 'Nome do funil', example_value: 'Vendas' },

  // ── Empresa (Company) ──
  { key: 'company.name', label: 'Nome da empresa', example_value: 'Empresa XYZ' },
  { key: 'company.corporate_name', label: 'Razão social', example_value: 'XYZ Ltda' },
  { key: 'company.cnpj', label: 'CNPJ', example_value: '12.345.678/0001-99' },
  { key: 'company.phone', label: 'Telefone da empresa', example_value: '1133334444' },
  { key: 'company.email', label: 'Email da empresa', example_value: 'contato@xyz.com' },
  { key: 'company.website', label: 'Site', example_value: 'https://xyz.com' },
  { key: 'company.address', label: 'Endereço', example_value: 'Rua Augusta 500' },
  { key: 'company.city.name', label: 'Cidade', example_value: 'São Paulo' },
  { key: 'company.state.abbr', label: 'Estado (UF)', example_value: 'SP' },
  { key: 'company.zip_code', label: 'CEP', example_value: '01305-000' },
  { key: 'company.segment.name', label: 'Segmento', example_value: 'Contabilidade' },
  { key: 'company.number_of_employees', label: 'Qtd funcionários', example_value: '50' },
  { key: 'company.annual_revenue', label: 'Faturamento anual', example_value: '1200000' },
  { key: 'company.observation', label: 'Observações', example_value: '' },

  // ── Contato (Person) ──
  { key: 'person.name', label: 'Nome do contato', example_value: 'João Silva' },
  { key: 'person.email', label: 'Email do contato', example_value: 'joao@email.com' },
  { key: 'person.phone', label: 'Telefone', example_value: '11999998888' },
  { key: 'person.cell_phone', label: 'Celular', example_value: '11988887777' },
  { key: 'person.cpf', label: 'CPF', example_value: '123.456.789-00' },
  { key: 'person.birth_date', label: 'Data de nascimento', example_value: '1990-05-15' },
  { key: 'person.position', label: 'Cargo', example_value: 'Sócio' },
  { key: 'person.city.name', label: 'Cidade do contato', example_value: 'São Paulo' },
  { key: 'person.state.abbr', label: 'Estado do contato', example_value: 'SP' },
  { key: 'person.whatsapp', label: 'WhatsApp', example_value: '5511999998888' },
  { key: 'person.instagram', label: 'Instagram', example_value: '@joaosilva' },
  { key: 'person.linkedin', label: 'LinkedIn', example_value: '' },
  { key: 'person.observation', label: 'Observações do contato', example_value: '' },

  // ── Proposta ──
  { key: 'proposal.number', label: 'Número da proposta', example_value: 'P-001' },
  { key: 'proposal.value', label: 'Valor da proposta', example_value: '15000' },
  { key: 'proposal.status', label: 'Status da proposta', example_value: 'accepted' },
  { key: 'proposal.sent_at', label: 'Data de envio', example_value: '2026-01-15' },
  { key: 'proposal.accepted_at', label: 'Data de aceite', example_value: '2026-02-01' },
  { key: 'proposal.payment_terms', label: 'Condições de pagamento', example_value: '30/60/90' },
  { key: 'proposal.items', label: 'Itens/Produtos da proposta', example_value: '[]' },
  { key: 'proposal.observation', label: 'Observação da proposta', example_value: '' },

  // ── Assinatura ──
  { key: 'signature.status', label: 'Status da assinatura', example_value: 'signed' },
  { key: 'signature.signed_at', label: 'Data da assinatura', example_value: '2026-02-10' },
  { key: 'signature.document_url', label: 'PDF do contrato assinado (baixar e salvar)', example_value: '' },
];

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (field: PiperunField) => void;
  isConnected?: boolean;
}

let cachedFields: PiperunField[] | null = null;
let cacheTime = 0;
const CACHE_TTL = 60 * 60 * 1000;

export function PiperunFieldPicker({ open, onClose, onSelect, isConnected }: Props) {
  const [fields, setFields] = useState<PiperunField[]>(FALLBACK_FIELDS);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setSearch('');
    setTimeout(() => inputRef.current?.focus(), 100);

    if (isConnected) {
      if (cachedFields && Date.now() - cacheTime < CACHE_TTL) {
        setFields(cachedFields);
        return;
      }
      setLoading(true);
      supabase.functions.invoke('integration-piperun', { body: { action: 'listFields' } })
        .then(({ data }) => {
          if (data?.fields) {
            cachedFields = data.fields;
            cacheTime = Date.now();
            setFields(data.fields);
          }
        })
        .finally(() => setLoading(false));
    } else {
      setFields(FALLBACK_FIELDS);
    }
  }, [open, isConnected]);

  const filtered = fields.filter(f =>
    f.label.toLowerCase().includes(search.toLowerCase()) ||
    f.key.toLowerCase().includes(search.toLowerCase())
  );

  const getCategoryForField = (key: string): FieldCategory => {
    if (key.startsWith('signature.')) return FIELD_CATEGORIES[4];
    if (key.startsWith('proposal.')) return FIELD_CATEGORIES[3];
    if (key.startsWith('person.')) return FIELD_CATEGORIES[2];
    if (key.startsWith('company.')) return FIELD_CATEGORIES[1];
    return FIELD_CATEGORIES[0]; // deal.*
  };

  const groupedFields = FIELD_CATEGORIES.map(cat => ({
    ...cat,
    fields: filtered.filter(f => getCategoryForField(f.key).prefix === cat.prefix),
  })).filter(g => g.fields.length > 0);

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Inserir Informações</DialogTitle></DialogHeader>
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            placeholder="Buscar informações..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="max-h-[320px] overflow-y-auto space-y-0.5">
          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-4">Carregando campos...</p>
          ) : groupedFields.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum campo encontrado</p>
          ) : groupedFields.map(group => (
            <div key={group.prefix}>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-3 pt-3 pb-1 sticky top-0 bg-background z-10">
                {group.label}
                <span className="ml-1 text-[10px] font-normal">({group.fields.length})</span>
              </p>
              {group.fields.map(f => (
                <button
                  key={f.key}
                  onClick={() => { onSelect(f); onClose(); }}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted/50 transition-colors text-left"
                >
                  <Circle className="h-2.5 w-2.5 text-destructive fill-destructive flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium">{f.label}</span>
                    <span className="text-[10px] text-muted-foreground ml-2">{f.key}</span>
                  </div>
                  {f.example_value && (
                    <span className="text-xs text-muted-foreground truncate max-w-[120px]">{f.example_value}</span>
                  )}
                </button>
              ))}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
