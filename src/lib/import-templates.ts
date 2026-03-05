export interface ImportField {
  key: string;
  label: string;
  required: boolean;
  type: 'text' | 'email' | 'date' | 'number' | 'enum' | 'boolean';
  enumValues?: string[];
  example: string;
  dbColumn?: string; // actual DB column name for direct mapping
}

export interface EntityTemplate {
  key: string;
  label: string;
  table: string;
  fields: ImportField[];
  matchStrategy?: { type: 'email' | 'name_combo'; fields: string[] };
}

export const importTemplates: EntityTemplate[] = [
  {
    key: 'offices',
    label: 'Clientes (Escritórios)',
    table: 'offices',
    matchStrategy: { type: 'email', fields: ['email'] },
    fields: [
      { key: 'name', label: 'nome', required: true, type: 'text', example: 'Escritório ABC', dbColumn: 'name' },
      { key: 'email', label: 'email', required: false, type: 'email', example: 'contato@abc.com', dbColumn: 'email' },
      { key: 'phone', label: 'whatsapp', required: false, type: 'text', example: '11999999999', dbColumn: 'phone' },
      { key: 'whatsapp', label: 'whatsapp_numero', required: false, type: 'text', example: '11999999999', dbColumn: 'whatsapp' },
      { key: 'city', label: 'cidade', required: false, type: 'text', example: 'São Paulo', dbColumn: 'city' },
      { key: 'state', label: 'estado', required: false, type: 'text', example: 'SP', dbColumn: 'state' },
      { key: 'cnpj', label: 'cnpj', required: false, type: 'text', example: '12.345.678/0001-90', dbColumn: 'cnpj' },
      { key: 'cpf', label: 'cpf', required: false, type: 'text', example: '123.456.789-00', dbColumn: 'cpf' },
      { key: 'cep', label: 'cep', required: false, type: 'text', example: '01001-000', dbColumn: 'cep' },
      { key: 'address', label: 'endereco', required: false, type: 'text', example: 'Rua Exemplo, 100', dbColumn: 'address' },
      { key: 'segment', label: 'segmento', required: false, type: 'text', example: 'Contabilidade', dbColumn: 'segment' },
      { key: 'instagram', label: 'instagram', required: false, type: 'text', example: '@escritorioabc', dbColumn: 'instagram' },
      { key: 'product_name', label: 'produto_ativo', required: false, type: 'text', example: 'Start CEO' },
      { key: 'csm_email', label: 'csm_responsavel_email', required: false, type: 'email', example: 'csm@empresa.com' },
      { key: 'status', label: 'status', required: true, type: 'enum', enumValues: ['ativo', 'churn', 'nao_renovado', 'nao_iniciado', 'upsell', 'bonus_elite', 'pausado'], example: 'ativo', dbColumn: 'status' },
      { key: 'activation_date', label: 'data_primeira_assinatura', required: false, type: 'date', example: '01/01/2024', dbColumn: 'activation_date' },
      { key: 'first_signature_date', label: 'data_primeira_assinatura_original', required: false, type: 'date', example: '01/01/2024', dbColumn: 'first_signature_date' },
      { key: 'onboarding_date', label: 'data_onboarding', required: false, type: 'date', example: '15/01/2024', dbColumn: 'onboarding_date' },
      { key: 'cycle_start_date', label: 'inicio_ciclo', required: false, type: 'date', example: '01/01/2024', dbColumn: 'cycle_start_date' },
      { key: 'cycle_end_date', label: 'fim_ciclo', required: false, type: 'date', example: '31/12/2024', dbColumn: 'cycle_end_date' },
      { key: 'churn_date', label: 'data_churn', required: false, type: 'date', example: '15/06/2024', dbColumn: 'churn_date' },
      { key: 'qtd_clientes', label: 'qtd_clientes', required: false, type: 'number', example: '150', dbColumn: 'qtd_clientes' },
      { key: 'qtd_colaboradores', label: 'qtd_colaboradores', required: false, type: 'number', example: '20', dbColumn: 'qtd_colaboradores' },
      { key: 'faturamento_mensal', label: 'faturamento_mensal', required: false, type: 'number', example: '50000', dbColumn: 'faturamento_mensal' },
      { key: 'faturamento_anual', label: 'faturamento_anual', required: false, type: 'number', example: '600000', dbColumn: 'faturamento_anual' },
      { key: 'notes', label: 'observacoes', required: false, type: 'text', example: 'Cliente VIP', dbColumn: 'notes' },
      { key: 'office_code', label: 'codigo_escritorio', required: false, type: 'text', example: 'ELT-001', dbColumn: 'office_code' },
    ],
  },
  {
    key: 'contacts',
    label: 'Contatos (Sócios)',
    table: 'contacts',
    matchStrategy: { type: 'name_combo', fields: ['office_name', 'name'] },
    fields: [
      { key: 'office_name', label: 'escritorio_nome', required: true, type: 'text', example: 'Escritório ABC' },
      { key: 'name', label: 'nome_contato', required: true, type: 'text', example: 'João Silva', dbColumn: 'name' },
      { key: 'role_title', label: 'cargo', required: false, type: 'text', example: 'Sócio', dbColumn: 'role_title' },
      { key: 'contact_type', label: 'tipo', required: false, type: 'enum', enumValues: ['decisor', 'usuario', 'financeiro'], example: 'decisor', dbColumn: 'contact_type' },
      { key: 'email', label: 'email', required: false, type: 'email', example: 'joao@abc.com', dbColumn: 'email' },
      { key: 'phone', label: 'telefone', required: false, type: 'text', example: '11999999999', dbColumn: 'phone' },
      { key: 'whatsapp', label: 'whatsapp', required: false, type: 'text', example: '11999999999', dbColumn: 'whatsapp' },
      { key: 'instagram', label: 'instagram', required: false, type: 'text', example: '@joaosilva', dbColumn: 'instagram' },
      { key: 'cpf', label: 'cpf', required: false, type: 'text', example: '123.456.789-00', dbColumn: 'cpf' },
      { key: 'birthday', label: 'aniversario', required: false, type: 'date', example: '15/03/1990', dbColumn: 'birthday' },
      { key: 'is_main_contact', label: 'ativo', required: false, type: 'boolean', example: 'sim', dbColumn: 'is_main_contact' },
      { key: 'notes', label: 'observacoes', required: false, type: 'text', example: 'Contato principal', dbColumn: 'notes' },
    ],
  },
  {
    key: 'contracts',
    label: 'Contratos',
    table: 'contracts',
    matchStrategy: { type: 'name_combo', fields: ['office_name', 'start_date'] },
    fields: [
      { key: 'office_name', label: 'escritorio_nome', required: true, type: 'text', example: 'Escritório ABC' },
      { key: 'product_name', label: 'produto', required: true, type: 'text', example: 'Start CEO' },
      { key: 'start_date', label: 'data_inicio', required: true, type: 'date', example: '01/01/2024', dbColumn: 'start_date' },
      { key: 'end_date', label: 'data_fim', required: false, type: 'date', example: '31/12/2024', dbColumn: 'end_date' },
      { key: 'renewal_date', label: 'data_renovacao', required: false, type: 'date', example: '01/01/2025', dbColumn: 'renewal_date' },
      { key: 'value', label: 'valor_total', required: false, type: 'number', example: '12000', dbColumn: 'value' },
      { key: 'monthly_value', label: 'valor_parcela', required: false, type: 'number', example: '1000', dbColumn: 'monthly_value' },
      { key: 'installments_total', label: 'qtd_parcelas', required: false, type: 'number', example: '12', dbColumn: 'installments_total' },
      { key: 'installments_overdue', label: 'parcelas_vencidas', required: false, type: 'number', example: '0', dbColumn: 'installments_overdue' },
      { key: 'status', label: 'status', required: true, type: 'enum', enumValues: ['ativo', 'encerrado', 'cancelado', 'pendente'], example: 'ativo', dbColumn: 'status' },
      { key: 'negotiation_notes', label: 'notas_negociacao', required: false, type: 'text', example: 'Desconto aplicado', dbColumn: 'negotiation_notes' },
      { key: 'asaas_link', label: 'link_asaas', required: false, type: 'text', example: 'https://...', dbColumn: 'asaas_link' },
    ],
  },
  {
    key: 'meetings',
    label: 'Histórico de Reuniões',
    table: 'meetings',
    fields: [
      { key: 'office_name', label: 'escritorio_nome', required: true, type: 'text', example: 'Escritório ABC' },
      { key: 'scheduled_at', label: 'data', required: true, type: 'date', example: '15/03/2024', dbColumn: 'scheduled_at' },
      { key: 'title', label: 'titulo', required: false, type: 'text', example: 'Reunião mensal', dbColumn: 'title' },
      { key: 'status', label: 'status', required: true, type: 'enum', enumValues: ['scheduled', 'completed', 'cancelled'], example: 'completed', dbColumn: 'status' },
      { key: 'csm_email', label: 'responsavel_email', required: true, type: 'email', example: 'csm@empresa.com' },
      { key: 'share_with_client', label: 'share_with_client', required: false, type: 'boolean', example: 'sim', dbColumn: 'share_with_client' },
      { key: 'notes', label: 'observacoes', required: false, type: 'text', example: 'Discussão de metas', dbColumn: 'notes' },
      { key: 'duration_minutes', label: 'duracao_minutos', required: false, type: 'number', example: '30', dbColumn: 'duration_minutes' },
    ],
  },
  {
    key: 'nps_csat',
    label: 'Pesquisas NPS/CSAT',
    table: 'form_submissions',
    fields: [
      { key: 'office_name', label: 'escritorio_nome', required: true, type: 'text', example: 'Escritório ABC' },
      { key: 'submitted_at', label: 'data', required: true, type: 'date', example: '15/03/2024' },
      { key: 'survey_type', label: 'tipo', required: true, type: 'enum', enumValues: ['NPS', 'CSAT'], example: 'NPS' },
      { key: 'score', label: 'nota', required: true, type: 'number', example: '9' },
      { key: 'comment', label: 'comentario', required: false, type: 'text', example: 'Excelente atendimento' },
    ],
  },
];

export function generateTemplateCSV(template: EntityTemplate): string {
  const headers = template.fields.map(f => f.label);
  const examples = template.fields.map(f => f.example);
  const examples2 = template.fields.map(f => {
    if (f.type === 'date') return '01/06/2024';
    if (f.type === 'number') return '5000';
    if (f.type === 'boolean') return 'nao';
    if (f.type === 'email') return 'outro@email.com';
    if (f.type === 'enum') return f.enumValues?.[1] || f.example;
    return 'Exemplo 2';
  });
  return [headers.join(','), examples.join(','), examples2.join(',')].join('\n');
}

export function autoMapColumns(fileHeaders: string[], templateFields: ImportField[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  for (const field of templateFields) {
    // 1. Exact match on dbColumn or key name
    const exactMatch = fileHeaders.find(h => {
      const nh = h.toLowerCase().trim();
      return nh === field.key || nh === (field.dbColumn || '').toLowerCase() || nh === field.label.toLowerCase();
    });
    if (exactMatch) { mapping[field.key] = exactMatch; continue; }

    // 2. Fuzzy match on normalized label
    const normalized = field.label.toLowerCase().replace(/[_\s]/g, '');
    const fuzzyMatch = fileHeaders.find(h => {
      const nh = h.toLowerCase().replace(/[_\s]/g, '');
      return nh === normalized || nh.includes(normalized) || normalized.includes(nh);
    });
    if (fuzzyMatch) { mapping[field.key] = fuzzyMatch; continue; }

    // 3. Fuzzy match on key
    const keyNorm = field.key.toLowerCase().replace(/[_\s]/g, '');
    const keyMatch = fileHeaders.find(h => {
      const nh = h.toLowerCase().replace(/[_\s]/g, '');
      return nh === keyNorm || nh.includes(keyNorm) || keyNorm.includes(nh);
    });
    if (keyMatch) mapping[field.key] = keyMatch;
  }
  return mapping;
}

export function validateRow(row: Record<string, any>, fields: ImportField[], rowIndex: number): string[] {
  const errors: string[] = [];
  for (const field of fields) {
    const val = row[field.key];
    if (field.required && (!val || String(val).trim() === '')) {
      errors.push(`Linha ${rowIndex + 1}: Campo "${field.label}" é obrigatório`);
      continue;
    }
    if (!val || String(val).trim() === '') continue;
    const strVal = String(val).trim();
    if (field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(strVal)) {
      errors.push(`Linha ${rowIndex + 1}: "${field.label}" não é um email válido`);
    }
    if (field.type === 'number' && isNaN(Number(strVal))) {
      errors.push(`Linha ${rowIndex + 1}: "${field.label}" não é um número válido`);
    }
    if (field.type === 'enum' && field.enumValues && !field.enumValues.includes(strVal.toLowerCase())) {
      errors.push(`Linha ${rowIndex + 1}: "${field.label}" valor inválido "${strVal}". Aceitos: ${field.enumValues.join(', ')}`);
    }
    if (field.type === 'boolean' && !['sim', 'nao', 'não', 'yes', 'no', 'true', 'false', '1', '0'].includes(strVal.toLowerCase())) {
      errors.push(`Linha ${rowIndex + 1}: "${field.label}" deve ser sim/nao`);
    }
  }
  return errors;
}

export function parseBoolean(val: string): boolean {
  return ['sim', 'yes', 'true', '1'].includes(String(val).trim().toLowerCase());
}

export function parseDateBR(val: string): string | null {
  if (!val) return null;
  const parts = val.split('/');
  if (parts.length === 3) {
    const [d, m, y] = parts;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return val;
}

export type MappingStatus = 'auto' | 'manual' | 'unmapped';

export function getMappingStatus(fieldKey: string, mapping: Record<string, string>, autoMapping: Record<string, string>): MappingStatus {
  if (!mapping[fieldKey]) return 'unmapped';
  if (autoMapping[fieldKey] === mapping[fieldKey]) return 'auto';
  return 'manual';
}
