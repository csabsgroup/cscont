import { normalize, normalizeStatus } from './import-sanitize';

export interface ImportField {
  key: string;
  label: string;
  required: boolean;
  type: 'text' | 'email' | 'date' | 'number' | 'enum' | 'boolean';
  enumValues?: string[];
  example: string;
  dbColumn?: string;
  aliases?: string[];
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
      // ── Office core ──
      { key: 'name', label: 'nome_escritorio', required: true, type: 'text', example: 'Escritório ABC', dbColumn: 'name',
        aliases: ['escritorio', 'escritório', 'razao social', 'razão social', 'razao_social', 'nome_empresa', 'nome da empresa', 'empresa', 'nome fantasia', 'nome_fantasia', 'company', 'name', 'cliente', 'nome_cliente', 'nome do cliente', 'nome do escritorio', 'nome do escritório'] },
      { key: 'email', label: 'email', required: false, type: 'email', example: 'contato@abc.com', dbColumn: 'email',
        aliases: ['email', 'e-mail', 'e_mail', 'email_contato', 'email_empresa', 'email do escritório', 'email do escritorio', 'email principal', 'e-mail principal', 'correio', 'mail'] },
      { key: 'phone', label: 'telefone', required: false, type: 'text', example: '11999999999', dbColumn: 'phone',
        aliases: ['telefone', 'fone', 'tel', 'phone', 'celular', 'numero', 'telefone fixo', 'tel fixo', 'fone fixo', 'telefone comercial'] },
      { key: 'whatsapp', label: 'whatsapp', required: false, type: 'text', example: '11999999999', dbColumn: 'whatsapp',
        aliases: ['whatsapp', 'wpp', 'zap', 'whats', 'whatszap', 'numero_whatsapp', 'telefone celular', 'tel celular', 'mobile', 'cell'] },
      { key: 'city', label: 'cidade', required: false, type: 'text', example: 'São Paulo', dbColumn: 'city',
        aliases: ['cidade', 'city', 'municipio', 'município'] },
      { key: 'state', label: 'estado', required: false, type: 'text', example: 'SP', dbColumn: 'state',
        aliases: ['estado', 'uf', 'state', 'sigla_estado', 'sigla estado'] },
      { key: 'cnpj', label: 'cnpj', required: false, type: 'text', example: '12.345.678/0001-90', dbColumn: 'cnpj',
        aliases: ['cnpj', 'cnpj_cpf', 'cnpj/cpf', 'documento_empresa', 'cnpj da empresa', 'cnpj do escritório', 'inscricao', 'inscrição'] },
      { key: 'cpf', label: 'cpf', required: false, type: 'text', example: '123.456.789-00', dbColumn: 'cpf',
        aliases: ['cpf', 'documento', 'doc', 'cpf_responsavel', 'cpf do responsável', 'cpf responsavel'] },
      { key: 'cep', label: 'cep', required: false, type: 'text', example: '01001-000', dbColumn: 'cep',
        aliases: ['cep', 'codigo_postal', 'código postal', 'codigo postal', 'zip', 'zipcode', 'zip code', 'cep do escritório'] },
      { key: 'address', label: 'endereco', required: false, type: 'text', example: 'Rua Exemplo, 100', dbColumn: 'address',
        aliases: ['endereco', 'endereço', 'logradouro', 'rua', 'address', 'endereço completo', 'endereco completo'] },
      { key: 'segment', label: 'segmento', required: false, type: 'text', example: 'Contabilidade', dbColumn: 'segment',
        aliases: ['segmento', 'segment', 'area', 'setor', 'ramo', 'nicho', 'área de atuação', 'area de atuacao'] },
      { key: 'instagram', label: 'instagram', required: false, type: 'text', example: '@escritorioabc', dbColumn: 'instagram',
        aliases: ['instagram', 'insta', 'ig', 'arroba', '@instagram'] },

      // ── Product / CSM ──
      { key: 'product_name', label: 'produto_ativo', required: false, type: 'text', example: 'Start CEO',
        aliases: ['produto', 'produto_ativo', 'plano', 'produto_nome', 'product', 'nome do produto', 'tipo de programa', 'programa contratado', 'programa'] },
      { key: 'csm_email', label: 'csm_email', required: false, type: 'email', example: 'csm@empresa.com',
        aliases: ['csm_email', 'email_responsavel', 'email_responsável', 'email do responsavel', 'email do responsável', 'gestor_email'] },
      { key: 'csm_name', label: 'csm_nome', required: false, type: 'text', example: 'Maria Silva',
        aliases: ['cs', 'csm', 'csm_nome', 'nome_csm', 'nome_responsavel', 'nome_responsável', 'consultor', 'customer_success', 'csm nome', 'responsavel_nome', 'responsavel', 'responsável', 'gestor'] },

      // ── Status ──
      { key: 'status', label: 'status', required: true, type: 'enum',
        enumValues: ['ativo', 'churn', 'nao_renovado', 'nao_iniciado', 'upsell', 'bonus_elite', 'pausado'],
        example: 'ativo', dbColumn: 'status',
        aliases: ['status', 'situacao', 'situação', 'estado_conta', 'status do cliente', 'status do escritório'] },

      // ── Dates ──
      { key: 'activation_date', label: 'data_ativacao', required: false, type: 'date', example: '01/01/2024', dbColumn: 'activation_date',
        aliases: ['data_ativacao', 'data_ativação', 'ativacao', 'data_primeira_assinatura', 'activation_date', 'data ativação', 'data ativacao', 'data de ativação'] },
      { key: 'first_signature_date', label: 'primeira_assinatura', required: false, type: 'date', example: '01/01/2024', dbColumn: 'first_signature_date',
        aliases: ['primeira_assinatura', 'data_assinatura', 'assinatura_original', 'data da assinatura', 'data assinatura'] },
      { key: 'onboarding_date', label: 'data_onboarding', required: false, type: 'date', example: '15/01/2024', dbColumn: 'onboarding_date',
        aliases: ['onboarding', 'data_onboarding', 'inicio_onboarding', 'data_implantacao', 'implantacao', 'data implantação', 'data de implantação'] },
      { key: 'cycle_start_date', label: 'inicio_ciclo', required: false, type: 'date', example: '01/01/2024', dbColumn: 'cycle_start_date',
        aliases: ['inicio_ciclo', 'início_ciclo', 'ciclo_inicio', 'cycle_start', 'início do ciclo', 'inicio do ciclo'] },
      { key: 'cycle_end_date', label: 'fim_ciclo', required: false, type: 'date', example: '31/12/2024', dbColumn: 'cycle_end_date',
        aliases: ['fim_ciclo', 'ciclo_fim', 'cycle_end', 'vencimento_ciclo', 'fim do ciclo'] },
      { key: 'churn_date', label: 'data_churn', required: false, type: 'date', example: '15/06/2024', dbColumn: 'churn_date',
        aliases: ['data_churn', 'data churn', 'data_cancelamento', 'data cancelamento', 'data do churn', 'data do cancelamento'] },
      { key: 'churn_observation', label: 'motivo_churn', required: false, type: 'text', example: 'Insatisfação com o serviço', dbColumn: 'churn_observation',
        aliases: ['motivo_churn', 'motivo churn', 'motivo_cancelamento', 'motivo cancelamento', 'razao_churn', 'razão churn', 'observacao_churn', 'observação churn', 'churn_reason', 'churn_observation', 'razao cancelamento', 'razão cancelamento'] },
      { key: 'last_meeting_date', label: 'data_ultima_reuniao', required: false, type: 'date', example: '15/03/2024', dbColumn: 'last_meeting_date',
        aliases: ['data_ultima_reuniao', 'data_última_reunião', 'data da ultima reuniao', 'data da última reunião', 'ultima_reuniao', 'última_reunião', 'last_meeting', 'last_meeting_date'] },

      // ── Numbers ──
      { key: 'qtd_clientes', label: 'qtd_clientes', required: false, type: 'number', example: '150', dbColumn: 'qtd_clientes',
        aliases: ['qtd_clientes', 'quantidade_clientes', 'num_clientes', 'clientes', 'total_clientes', 'clientes_ativos', 'clientes ativos', 'numero de clientes', 'quantidade de clientes', 'nº de clientes'] },
      { key: 'qtd_colaboradores', label: 'qtd_colaboradores', required: false, type: 'number', example: '20', dbColumn: 'qtd_colaboradores',
        aliases: ['qtd_colaboradores', 'quantidade_colaboradores', 'num_colaboradores', 'colaboradores', 'funcionarios', 'funcionários', 'numero de funcionarios', 'número de funcionários', 'quantidade de colaboradores', 'qtd funcionários', 'qtd funcionarios', 'total funcionários'] },
      { key: 'faturamento_mensal', label: 'faturamento_mensal', required: false, type: 'number', example: '50000', dbColumn: 'faturamento_mensal',
        aliases: ['faturamento_mensal', 'receita_mensal', 'mrr', 'faturamento_mes', 'fat_mensal', 'faturamento do ultimo mes', 'faturamento do último mês', 'faturamento ultimo mes', 'faturamento mensal', 'faturamento mês', 'faturamento mes', 'faturamento do mês', 'faturamento do mes', 'monthly revenue'] },
      { key: 'faturamento_anual', label: 'faturamento_anual', required: false, type: 'number', example: '600000', dbColumn: 'faturamento_anual',
        aliases: ['faturamento_anual', 'receita_anual', 'arr', 'faturamento_ano', 'fat_anual', 'faturamento do ultimo ano', 'faturamento do último ano', 'faturamento ultimo ano', 'receita_ultimo_ano', 'faturamento anual', 'faturamento ano', 'faturamento do ano', 'annual revenue'] },

      // ── Notes / Code ──
      { key: 'notes', label: 'observacoes', required: false, type: 'text', example: 'Cliente VIP', dbColumn: 'notes',
        aliases: ['observacoes', 'observações', 'obs', 'notas', 'notes', 'anotacoes', 'anotações', 'comentarios', 'comentários', 'observação', 'observacao'] },
      { key: 'office_code', label: 'codigo_escritorio', required: false, type: 'text', example: 'ELT-001', dbColumn: 'office_code',
        aliases: ['codigo', 'código', 'codigo_escritorio', 'código_escritório', 'code', 'office_code', 'id_externo'] },

      // ── Contact fields (auto-create linked contact) ──
      { key: 'contact_name', label: 'nome_socio', required: false, type: 'text', example: 'João Silva',
        aliases: ['nome', 'nome_socio', 'nome_sócio', 'sócio', 'socio', 'contato', 'nome do contato', 'nome do sócio', 'nome do socio', 'responsável', 'nome responsavel', 'nome responsável', 'nome do responsável', 'contact name'] },
      { key: 'contact_email', label: 'email_socio', required: false, type: 'email', example: 'joao@abc.com',
        aliases: ['email do sócio', 'email socio', 'email do contato', 'email contato', 'email do responsável', 'email responsável', 'email responsavel', 'contact email'] },
      { key: 'contact_phone', label: 'telefone_socio', required: false, type: 'text', example: '11999999999',
        aliases: ['telefone do sócio', 'telefone socio', 'telefone do contato', 'tel contato', 'fone contato', 'telefone do responsável', 'contact phone'] },
      { key: 'contact_birthday', label: 'aniversario_socio', required: false, type: 'date', example: '15/03/1990',
        aliases: ['aniversário', 'aniversario', 'data nascimento', 'data de nascimento', 'nascimento', 'birthday', 'birth date', 'dt nascimento', 'dt_nascimento'] },
      { key: 'contact_cpf', label: 'cpf_socio', required: false, type: 'text', example: '123.456.789-00',
        aliases: ['cpf do sócio', 'cpf socio', 'cpf do contato', 'cpf contato', 'cpf do responsável', 'contact cpf'] },

      // ── Contract fields (auto-create linked contract) ──
      { key: 'contract_value', label: 'valor_contrato', required: false, type: 'number', example: '12000',
        aliases: ['valor contrato atual', 'valor do contrato', 'valor contrato', 'valor total', 'valor total do contrato', 'contract value'] },
      { key: 'monthly_value', label: 'valor_mensalidade', required: false, type: 'number', example: '1000',
        aliases: ['valor mensalidade', 'mensalidade', 'valor mensal', 'valor da parcela', 'valor parcela', 'parcela', 'installment'] },

      // ── Extra metadata ──
      { key: 'origem', label: 'origem', required: false, type: 'text', example: 'Indicação',
        aliases: ['origem', 'origin', 'fonte', 'source', 'canal'] },
    ],
  },
  {
    key: 'contacts',
    label: 'Contatos (Sócios)',
    table: 'contacts',
    matchStrategy: { type: 'name_combo', fields: ['office_name', 'name'] },
    fields: [
      { key: 'office_name', label: 'escritorio_nome', required: true, type: 'text', example: 'Escritório ABC',
        aliases: ['escritorio', 'escritório', 'nome_escritorio', 'nome_escritório', 'empresa', 'cliente', 'office', 'nome da empresa', 'razao social', 'razão social'] },
      { key: 'name', label: 'nome_contato', required: true, type: 'text', example: 'João Silva', dbColumn: 'name',
        aliases: ['nome', 'nome_contato', 'nome_socio', 'nome_sócio', 'contato', 'socio', 'sócio', 'name', 'responsável', 'responsavel'] },
      { key: 'role_title', label: 'cargo', required: false, type: 'text', example: 'Sócio', dbColumn: 'role_title',
        aliases: ['cargo', 'funcao', 'função', 'titulo', 'título', 'role', 'posicao', 'posição', 'position', 'job title'] },
      { key: 'contact_type', label: 'tipo', required: false, type: 'enum', enumValues: ['decisor', 'usuario', 'financeiro'], example: 'decisor', dbColumn: 'contact_type',
        aliases: ['tipo', 'tipo_contato', 'type', 'perfil'] },
      { key: 'email', label: 'email', required: false, type: 'email', example: 'joao@abc.com', dbColumn: 'email',
        aliases: ['email', 'e-mail', 'e_mail', 'email_contato', 'email do sócio', 'email socio'] },
      { key: 'phone', label: 'telefone', required: false, type: 'text', example: '11999999999', dbColumn: 'phone',
        aliases: ['telefone', 'fone', 'tel', 'phone', 'celular'] },
      { key: 'whatsapp', label: 'whatsapp', required: false, type: 'text', example: '11999999999', dbColumn: 'whatsapp',
        aliases: ['whatsapp', 'wpp', 'zap', 'whats'] },
      { key: 'instagram', label: 'instagram', required: false, type: 'text', example: '@joaosilva', dbColumn: 'instagram',
        aliases: ['instagram', 'insta', 'ig'] },
      { key: 'cpf', label: 'cpf', required: false, type: 'text', example: '123.456.789-00', dbColumn: 'cpf',
        aliases: ['cpf', 'documento', 'doc'] },
      { key: 'birthday', label: 'aniversario', required: false, type: 'date', example: '15/03/1990', dbColumn: 'birthday',
        aliases: ['aniversario', 'aniversário', 'nascimento', 'data_nascimento', 'birthday', 'dt_nascimento', 'data de nascimento', 'data nascimento'] },
      { key: 'is_main_contact', label: 'contato_principal', required: false, type: 'boolean', example: 'sim', dbColumn: 'is_main_contact',
        aliases: ['ativo', 'principal', 'contato_principal', 'main', 'is_main'] },
      { key: 'notes', label: 'observacoes', required: false, type: 'text', example: 'Contato principal', dbColumn: 'notes',
        aliases: ['observacoes', 'observações', 'obs', 'notas', 'notes'] },
    ],
  },
  {
    key: 'contracts',
    label: 'Contratos',
    table: 'contracts',
    matchStrategy: { type: 'name_combo', fields: ['office_name', 'start_date'] },
    fields: [
      { key: 'office_name', label: 'escritorio_nome', required: true, type: 'text', example: 'Escritório ABC',
        aliases: ['escritorio', 'escritório', 'nome_escritorio', 'empresa', 'cliente', 'office', 'razao social', 'razão social'] },
      { key: 'product_name', label: 'produto', required: true, type: 'text', example: 'Start CEO',
        aliases: ['produto', 'plano', 'product', 'nome_produto', 'servico', 'serviço', 'programa'] },
      { key: 'start_date', label: 'data_inicio', required: true, type: 'date', example: '01/01/2024', dbColumn: 'start_date',
        aliases: ['data_inicio', 'data_início', 'inicio', 'início', 'start', 'start_date', 'dt_inicio', 'data início', 'data inicio', 'início do contrato', 'inicio do contrato', 'data de início', 'data de inicio', 'data entrada', 'data de entrada', 'data assinatura', 'data da assinatura', 'data ativação'] },
      { key: 'end_date', label: 'data_fim', required: false, type: 'date', example: '31/12/2024', dbColumn: 'end_date',
        aliases: ['data_fim', 'fim', 'end', 'end_date', 'vencimento', 'dt_fim', 'data fim', 'data final', 'fim do contrato', 'data de término', 'data termino', 'data vencimento', 'data fim contrato'] },
      { key: 'renewal_date', label: 'data_renovacao', required: false, type: 'date', example: '01/01/2025', dbColumn: 'renewal_date',
        aliases: ['data_renovacao', 'data_renovação', 'renovacao', 'renovação', 'renewal', 'data renovação', 'data renovacao'] },
      { key: 'value', label: 'valor_total', required: false, type: 'number', example: '12000', dbColumn: 'value',
        aliases: ['valor_total', 'valor', 'value', 'total', 'preco', 'preço', 'valor do contrato', 'valor contrato', 'valor total do contrato', 'contract value'] },
      { key: 'monthly_value', label: 'valor_parcela', required: false, type: 'number', example: '1000', dbColumn: 'monthly_value',
        aliases: ['valor_parcela', 'valor_mensal', 'parcela', 'mensalidade', 'monthly', 'valor da parcela', 'valor da mensalidade', 'valor mensal', 'valor mensalidade'] },
      { key: 'installments_total', label: 'qtd_parcelas', required: false, type: 'number', example: '12', dbColumn: 'installments_total',
        aliases: ['qtd_parcelas', 'parcelas', 'num_parcelas', 'total_parcelas', 'quantidade de parcelas', 'número de parcelas', 'numero de parcelas', 'nº parcelas'] },
      { key: 'installments_overdue', label: 'parcelas_vencidas', required: false, type: 'number', example: '0', dbColumn: 'installments_overdue',
        aliases: ['parcelas_vencidas', 'vencidas', 'inadimplencia', 'inadimplência'] },
      { key: 'status', label: 'status', required: true, type: 'enum', enumValues: ['ativo', 'encerrado', 'cancelado', 'pendente'], example: 'ativo', dbColumn: 'status',
        aliases: ['status', 'situacao', 'situação'] },
      { key: 'negotiation_notes', label: 'notas_negociacao', required: false, type: 'text', example: 'Desconto aplicado', dbColumn: 'negotiation_notes',
        aliases: ['notas_negociacao', 'notas_negociação', 'negociacao', 'negociação', 'obs'] },
      { key: 'asaas_link', label: 'link_asaas', required: false, type: 'text', example: 'https://...', dbColumn: 'asaas_link',
        aliases: ['link_asaas', 'asaas', 'link_pagamento', 'link_cobranca'] },
    ],
  },
  {
    key: 'meetings',
    label: 'Histórico de Reuniões',
    table: 'meetings',
    fields: [
      { key: 'office_name', label: 'escritorio_nome', required: true, type: 'text', example: 'Escritório ABC',
        aliases: ['escritorio', 'escritório', 'nome_escritorio', 'empresa', 'cliente', 'office'] },
      { key: 'scheduled_at', label: 'data', required: true, type: 'date', example: '15/03/2024', dbColumn: 'scheduled_at',
        aliases: ['data', 'data_reuniao', 'data_reunião', 'date', 'scheduled', 'agendamento'] },
      { key: 'title', label: 'titulo', required: false, type: 'text', example: 'Reunião mensal', dbColumn: 'title',
        aliases: ['titulo', 'título', 'assunto', 'tema', 'title', 'nome'] },
      { key: 'status', label: 'status', required: true, type: 'enum', enumValues: ['scheduled', 'completed', 'cancelled'], example: 'completed', dbColumn: 'status',
        aliases: ['status', 'situacao', 'situação'] },
      { key: 'csm_email', label: 'responsavel_email', required: true, type: 'email', example: 'csm@empresa.com',
        aliases: ['responsavel_email', 'responsável_email', 'csm', 'csm_email', 'email_responsavel', 'email_responsável'] },
      { key: 'share_with_client', label: 'share_with_client', required: false, type: 'boolean', example: 'sim', dbColumn: 'share_with_client',
        aliases: ['compartilhar', 'share', 'visivel_cliente', 'visível_cliente'] },
      { key: 'notes', label: 'observacoes', required: false, type: 'text', example: 'Discussão de metas', dbColumn: 'notes',
        aliases: ['observacoes', 'observações', 'obs', 'notas', 'notes', 'anotacoes'] },
      { key: 'duration_minutes', label: 'duracao_minutos', required: false, type: 'number', example: '30', dbColumn: 'duration_minutes',
        aliases: ['duracao', 'duração', 'duracao_minutos', 'duração_minutos', 'tempo', 'minutos'] },
    ],
  },
  {
    key: 'nps_csat',
    label: 'Pesquisas NPS/CSAT',
    table: 'form_submissions',
    fields: [
      { key: 'office_name', label: 'escritorio_nome', required: true, type: 'text', example: 'Escritório ABC',
        aliases: ['escritorio', 'escritório', 'nome_escritorio', 'empresa', 'cliente', 'office'] },
      { key: 'submitted_at', label: 'data', required: true, type: 'date', example: '15/03/2024',
        aliases: ['data', 'data_pesquisa', 'data_resposta', 'date'] },
      { key: 'survey_type', label: 'tipo', required: true, type: 'enum', enumValues: ['NPS', 'CSAT'], example: 'NPS',
        aliases: ['tipo', 'tipo_pesquisa', 'type', 'pesquisa'] },
      { key: 'score', label: 'nota', required: true, type: 'number', example: '9',
        aliases: ['nota', 'score', 'pontuacao', 'pontuação', 'avaliacao', 'avaliação'] },
      { key: 'comment', label: 'comentario', required: false, type: 'text', example: 'Excelente atendimento',
        aliases: ['comentario', 'comentário', 'comment', 'feedback', 'resposta', 'obs'] },
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
  const usedHeaders = new Set<string>();

  for (const field of templateFields) {
    const candidates = new Set<string>();
    candidates.add(normalize(field.key));
    candidates.add(normalize(field.label));
    if (field.dbColumn) candidates.add(normalize(field.dbColumn));
    if (field.aliases) {
      for (const a of field.aliases) candidates.add(normalize(a));
    }

    // 1. Exact normalized match
    let matched: string | null = null;
    for (const h of fileHeaders) {
      if (usedHeaders.has(h)) continue;
      const nh = normalize(h);
      if (candidates.has(nh)) {
        matched = h;
        break;
      }
    }

    // 2. Contains match (either direction)
    if (!matched) {
      for (const h of fileHeaders) {
        if (usedHeaders.has(h)) continue;
        const nh = normalize(h);
        if (nh.length < 2) continue;
        for (const c of candidates) {
          if (c.length < 2) continue;
          if (nh.includes(c) || c.includes(nh)) {
            matched = h;
            break;
          }
        }
        if (matched) break;
      }
    }

    if (matched) {
      mapping[field.key] = matched;
      usedHeaders.add(matched);
    }
  }
  return mapping;
}

export function validateRow(row: Record<string, any>, fields: ImportField[], rowIndex: number): string[] {
  const errors: string[] = [];
  for (const field of fields) {
    const val = row[field.key];
    // Required check
    if (field.required && (val === null || val === undefined || String(val).trim() === '')) {
      errors.push(`Linha ${rowIndex + 1}: Campo "${field.label}" é obrigatório`);
      continue;
    }
    // Skip empty optional fields — never error
    if (val === null || val === undefined || String(val).trim() === '') continue;

    const strVal = typeof val === 'number' ? String(val) : String(val).trim();

    if (field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(strVal)) {
      errors.push(`Linha ${rowIndex + 1}: "${field.label}" não é um email válido`);
    }
    if (field.type === 'number') {
      const numVal = typeof val === 'number' ? val : Number(strVal);
      if (isNaN(numVal)) {
        errors.push(`Linha ${rowIndex + 1}: "${field.label}" não é um número válido`);
      }
    }
    if (field.type === 'enum' && field.enumValues) {
      // Status already normalized by sanitizeValue, just check
      const normalized = normalizeStatus(strVal);
      if (!field.enumValues.includes(normalized) && !field.enumValues.includes(strVal.toLowerCase())) {
        // Default to first enum value instead of rejecting — log as warning only
        // Don't push an error — the insertRow will handle defaulting
      }
    }
    if (field.type === 'boolean' && !['sim', 'nao', 'não', 'yes', 'no', 'true', 'false', '1', '0'].includes(strVal.toLowerCase())) {
      // Don't reject — will default to false
    }
  }
  return errors;
}

export function parseBoolean(val: string): boolean {
  return ['sim', 'yes', 'true', '1'].includes(String(val).trim().toLowerCase());
}

export function parseDateBR(val: string): string | null {
  if (!val) return null;
  // Already ISO
  if (/^\d{4}-\d{2}-\d{2}/.test(val)) return val.slice(0, 10);
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
