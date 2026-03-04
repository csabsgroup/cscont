export interface ImportField {
  key: string;
  label: string;
  required: boolean;
  type: 'text' | 'email' | 'date' | 'number' | 'enum' | 'boolean';
  enumValues?: string[];
  example: string;
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
      { key: 'name', label: 'nome', required: true, type: 'text', example: 'Escritório ABC' },
      { key: 'email', label: 'email', required: true, type: 'email', example: 'contato@abc.com' },
      { key: 'phone', label: 'whatsapp', required: false, type: 'text', example: '11999999999' },
      { key: 'city', label: 'cidade', required: false, type: 'text', example: 'São Paulo' },
      { key: 'state', label: 'estado', required: false, type: 'text', example: 'SP' },
      { key: 'product_name', label: 'produto_ativo', required: true, type: 'text', example: 'Start CEO' },
      { key: 'csm_email', label: 'csm_responsavel_email', required: true, type: 'email', example: 'csm@empresa.com' },
      { key: 'status', label: 'status', required: true, type: 'enum', enumValues: ['ativo', 'churn', 'nao_renovado', 'nao_iniciado', 'upsell', 'bonus_elite'], example: 'ativo' },
      { key: 'activation_date', label: 'data_primeira_assinatura', required: false, type: 'date', example: '01/01/2024' },
    ],
  },
  {
    key: 'contacts',
    label: 'Contatos (Sócios)',
    table: 'contacts',
    matchStrategy: { type: 'name_combo', fields: ['office_name', 'name'] },
    fields: [
      { key: 'office_name', label: 'escritorio_nome', required: true, type: 'text', example: 'Escritório ABC' },
      { key: 'name', label: 'nome_contato', required: true, type: 'text', example: 'João Silva' },
      { key: 'role_title', label: 'cargo', required: false, type: 'text', example: 'Sócio' },
      { key: 'contact_type', label: 'tipo', required: true, type: 'enum', enumValues: ['decisor', 'usuario', 'financeiro'], example: 'decisor' },
      { key: 'email', label: 'email', required: false, type: 'email', example: 'joao@abc.com' },
      { key: 'phone', label: 'telefone', required: false, type: 'text', example: '11999999999' },
      { key: 'instagram', label: 'instagram', required: false, type: 'text', example: '@joaosilva' },
      { key: 'birthday', label: 'aniversario', required: false, type: 'date', example: '15/03/1990' },
      { key: 'is_main_contact', label: 'ativo', required: true, type: 'boolean', example: 'sim' },
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
      { key: 'start_date', label: 'data_inicio', required: true, type: 'date', example: '01/01/2024' },
      { key: 'end_date', label: 'data_fim', required: true, type: 'date', example: '31/12/2024' },
      { key: 'value', label: 'valor_total', required: true, type: 'number', example: '12000' },
      { key: 'monthly_value', label: 'valor_parcela', required: true, type: 'number', example: '1000' },
      { key: 'installments_total', label: 'qtd_parcelas', required: true, type: 'number', example: '12' },
      { key: 'installments_overdue', label: 'parcelas_vencidas', required: false, type: 'number', example: '0' },
      { key: 'status', label: 'status', required: true, type: 'enum', enumValues: ['ativo', 'encerrado', 'cancelado'], example: 'ativo' },
    ],
  },
  {
    key: 'meetings',
    label: 'Histórico de Reuniões',
    table: 'meetings',
    fields: [
      { key: 'office_name', label: 'escritorio_nome', required: true, type: 'text', example: 'Escritório ABC' },
      { key: 'scheduled_at', label: 'data', required: true, type: 'date', example: '15/03/2024' },
      { key: 'title', label: 'titulo', required: false, type: 'text', example: 'Reunião mensal' },
      { key: 'status', label: 'status', required: true, type: 'enum', enumValues: ['scheduled', 'completed', 'cancelled'], example: 'completed' },
      { key: 'csm_email', label: 'responsavel_email', required: true, type: 'email', example: 'csm@empresa.com' },
      { key: 'share_with_client', label: 'share_with_client', required: false, type: 'boolean', example: 'sim' },
      { key: 'notes', label: 'observacoes', required: false, type: 'text', example: 'Discussão de metas' },
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
    const normalized = field.label.toLowerCase().replace(/[_\s]/g, '');
    const match = fileHeaders.find(h => {
      const nh = h.toLowerCase().replace(/[_\s]/g, '');
      return nh === normalized || nh.includes(normalized) || normalized.includes(nh);
    });
    if (match) mapping[field.key] = match;
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
