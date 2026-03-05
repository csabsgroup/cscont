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
  { label: '📋 Oportunidade (Deal)', prefix: 'deal' },
  { label: '🏢 Empresa (Company)', prefix: 'company.' },
  { label: '👤 Contato (Pessoa)', prefix: 'person.' },
  { label: '📄 Proposta', prefix: 'proposals[' },
  { label: '🔏 Assinatura / Ação', prefix: 'signature.' },
  { label: '🔧 Campos Customizados', prefix: 'fields.find.' },
];

const FALLBACK_FIELDS: PiperunField[] = [
  // ── Deal (root level) ──
  { key: 'title', label: 'Título da oportunidade', example_value: 'Leme Contábil' },
  { key: 'value', label: 'Valor da oportunidade', example_value: '80000.00' },
  { key: 'closed_at', label: 'Data de fechamento', example_value: '2026-03-05' },
  { key: 'created_at', label: 'Data de criação', example_value: '2026-03-05' },
  { key: 'observation', label: 'Observação', example_value: '' },
  { key: 'stage.name', label: 'Etapa do funil', example_value: 'Venda Realizada (Ganho)' },
  { key: 'pipeline.name', label: 'Nome do funil', example_value: 'Contador CEO | CLOSER' },
  { key: 'user.name', label: 'Responsável (vendedor)', example_value: 'Matheus Leme' },
  { key: 'user.email', label: 'Email do responsável', example_value: 'matheus@empresa.com' },
  { key: 'city.name', label: 'Cidade da oportunidade', example_value: 'Votuporanga' },
  { key: 'city.uf', label: 'Estado da oportunidade', example_value: 'SP' },

  // ── Empresa (Company) ──
  { key: 'company.name', label: 'Nome da empresa', example_value: 'Empresa XYZ' },
  { key: 'company.company_name', label: 'Razão social', example_value: 'XYZ Ltda' },
  { key: 'company.cnpj', label: 'CNPJ', example_value: '42.904.689/0001-29' },
  { key: 'company.contact_phones[0].number', label: 'Telefone da empresa', example_value: '5511939448809' },
  { key: 'company.contact_emails[0].address', label: 'Email da empresa', example_value: 'contato@xyz.com' },
  { key: 'company.website', label: 'Site', example_value: 'https://xyz.com' },
  { key: 'company.address.street', label: 'Rua', example_value: 'RUA TIBAGI' },
  { key: 'company.address.number', label: 'Número', example_value: '2798' },
  { key: 'company.address.district', label: 'Bairro', example_value: 'Patrimonio Novo' },
  { key: 'company.address.complement', label: 'Complemento', example_value: 'N/A' },
  { key: 'company.address.postal_code', label: 'CEP', example_value: '15500007' },
  { key: 'company.city.name', label: 'Cidade da empresa', example_value: 'Votuporanga' },
  { key: 'company.city.uf', label: 'Estado da empresa (UF)', example_value: 'SP' },
  { key: 'company.segment.name', label: 'Segmento', example_value: 'Contabilidade' },
  { key: 'company.cnae', label: 'CNAE', example_value: '73.19-0-02' },
  { key: 'company.open_at', label: 'Data de abertura', example_value: '2021-07-28' },

  // ── Contato (Person) ──
  { key: 'person.name', label: 'Nome do contato', example_value: 'João Silva' },
  { key: 'person.contact_emails[0].address', label: 'Email do contato', example_value: 'joao@email.com' },
  { key: 'person.contact_phones[0].number', label: 'Telefone/Celular do contato', example_value: '5511999998888' },
  { key: 'person.cpf', label: 'CPF', example_value: '403.054.218-24' },
  { key: 'person.birth_day', label: 'Data de nascimento', example_value: '1995-01-23' },
  { key: 'person.job_title', label: 'Cargo', example_value: 'Sócio' },
  { key: 'person.city.name', label: 'Cidade do contato', example_value: 'São Paulo' },
  { key: 'person.city.uf', label: 'Estado do contato (UF)', example_value: 'SP' },
  { key: 'person.address.street', label: 'Endereço do contato', example_value: 'Rua Professor Henrique' },
  { key: 'person.address.postal_code', label: 'CEP do contato', example_value: '04637001' },

  // ── Proposta ──
  { key: 'proposals[0].value', label: 'Valor da proposta', example_value: '80000' },
  { key: 'proposals[0].status', label: 'Status da proposta', example_value: '5' },
  { key: 'proposals[0].items[0].name', label: 'Nome do produto/item', example_value: 'CONTADOR CEO ELITE' },
  { key: 'proposals[0].items[0].code', label: 'Código do produto', example_value: 'ELT' },
  { key: 'proposals[0].items[0].value', label: 'Valor do item', example_value: '80000' },
  { key: 'proposals[0].items[0].characteristics[0].name', label: 'Característica do item', example_value: 'ACELERAÇÃO' },
  { key: 'proposals[0].parcels.length', label: 'Quantidade de parcelas', example_value: '12' },
  { key: 'proposals[0].parcels[0].value', label: 'Valor da entrada/1ª parcela', example_value: '80000' },
  { key: 'proposals[0].parcels[0].due_date', label: 'Data da 1ª parcela', example_value: '2026-03-05' },
  { key: 'proposals[0].parcels[1].value', label: 'Valor da mensalidade', example_value: '0' },
  { key: 'proposals[0].valid_until', label: 'Validade da proposta', example_value: '2026-03-10' },
  { key: 'proposals[0].created_at', label: 'Data de criação da proposta', example_value: '2026-03-05' },
  { key: 'proposals[0].user.name', label: 'Vendedor da proposta', example_value: 'Matheus Leme' },

  // ── Assinatura / Ação ──
  { key: 'signature.status', label: 'Status da assinatura', example_value: 'signed' },
  { key: 'signature.signed_at', label: 'Data da assinatura', example_value: '2026-02-10' },
  { key: 'signature.document_url', label: 'PDF do contrato assinado', example_value: '' },
  { key: 'action.trigger_type', label: 'Tipo do trigger', example_value: 'A assinatura eletrônica...' },
  { key: 'action.create', label: 'Data da ação/assinatura', example_value: '2026-03-05 20:30:53' },
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
    if (key.startsWith('fields.find.')) return FIELD_CATEGORIES[5];
    if (key.startsWith('signature.') || key.startsWith('action.')) return FIELD_CATEGORIES[4];
    if (key.startsWith('proposals[') || key.startsWith('proposals.')) return FIELD_CATEGORIES[3];
    if (key.startsWith('person.')) return FIELD_CATEGORIES[2];
    if (key.startsWith('company.')) return FIELD_CATEGORIES[1];
    return FIELD_CATEGORIES[0]; // deal root fields
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
