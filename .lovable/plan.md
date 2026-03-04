

## Analise: Funcionalidades Implementadas vs. Pendentes

### Ja Implementado
- Auth com RBAC (admin, manager, csm, viewer, client)
- Tabelas: offices, contacts, contracts, activities, meetings, events, event_participants, journey_stages, office_journey, products, profiles, user_roles, manager_csm_links, client_office_links
- Pages: Dashboard (dados reais), Clientes (busca+filtros), Cliente 360 (resumo/contatos/contratos/notas), Jornada (kanban), Atividades (CRUD), Reunioes (CRUD), Eventos (CRUD basico), Contratos Global, Contatos Global, Relatorios (graficos), Configuracoes (produtos/etapas/usuarios)
- Branding vermelho/preto/branco, sidebar, RLS policies

### Funcionalidades Faltantes (ordenadas por prioridade/impacto)

---

### FASE 1 — Health Score (sistema completo)

**Database:**
- Tabela `health_pillars` (product_id, name, weight, position)
- Tabela `health_indicators` (pillar_id, name, weight, data_source, data_key)
- Tabela `health_overrides` (product_id, condition_type, threshold, action: force_red/reduce_score)
- Tabela `health_scores` (office_id, score, band: red/yellow/green, calculated_at, breakdown jsonb)
- Tabela `health_playbooks` (product_id, band, activity_template jsonb)

**Configuracoes:** Nova tab "Health Score" — CRUD de pilares, indicadores com pesos, overrides, playbooks por faixa/produto.

**Calculo:** Edge function `calculate-health` que recebe office_id, busca pilares/indicadores do produto ativo, aplica neutralizacao, calcula score 0-100, aplica overrides, salva em health_scores.

**UI:** Badge de health no Cliente 360, Clientes table, Kanban cards, Dashboard (health medio, distribuicao V/A/V, em risco).

---

### FASE 2 — Cliente 360 completo (abas faltantes)

**Abas faltantes:**
- **Timeline**: atividades + reunioes do escritorio, com popup para editar/concluir/reabrir/excluir
- **Plano de Acao (OKR)**: tabela `action_plans` (office_id, title, description, due_date, status, observations). CRUD interno, % conclusao
- **Reunioes**: historico de reunioes do escritorio dentro do 360
- **Jornada**: etapa atual + historico de movimentacao (office_journey)
- **Metricas**: LTV (soma ciclos), retencao, evolucao health

---

### FASE 3 — Formularios Customizaveis

**Database:**
- Tabela `form_templates` (name, type: kickoff/nutricao/renovacao/etc, product_id, fields jsonb, post_actions jsonb)
- Tabela `form_submissions` (template_id, office_id, meeting_id, user_id, data jsonb, submitted_at)

**Configuracoes:** Nova tab "Formularios" — construtor de campos (texto, numero, data, dropdown, multi, rating, NPS, booleano, arquivo).

**Reunioes:** ao marcar "realizada", selecionar formulario e preencher. Mapeamento para indicadores do Health Score.

---

### FASE 4 — Cashback/Bonus (catalogo)

**Database:**
- Tabela `bonus_catalog` (name, unit, default_validity_days, visible_in_portal, requires_approval, eligible_product_ids)
- Tabela `bonus_grants` (office_id, catalog_item_id, quantity, granted_at, expires_at, used, available)
- Tabela `bonus_requests` (office_id, catalog_item_id, quantity, notes, status: pending/approved/denied, reviewed_by)

**Configuracoes:** Nova tab "Catalogo de Bonus".
**Cliente 360:** Nova aba "Bonus/Cashback" com saldo e solicitacoes.

---

### FASE 5 — Portal do Cliente (role=client)

**Novo layout** separado do interno (sem sidebar interna, com navegacao propria).

**Paginas:**
- Home (resumo)
- Meu Contrato (parcelas, renovacao)
- Meu Plano de Acao (editar apenas status/observacoes)
- Reunioes (apenas share_with_client=true) — requer campo `share_with_client` na tabela meetings
- Eventos (do produto)
- Bonus/Cashback (saldo + solicitacoes)
- Arquivos compartilhados — requer campo `shared_with_client` na tabela de notas/arquivos
- Contatos (CSM, Gestor)
- Membros Ativos (diretorio: offices ativos do mesmo produto com visible_in_directory=true)

**Database:** adicionar `share_with_client boolean default false` em meetings.

---

### FASE 6 — Dashboard avancado (itens faltantes)

Itens do prompt ainda nao cobertos:
- Em risco (health vermelho)
- NPS medio + cobertura
- Health medio + distribuicao V/A/V
- Sem percepcao coletada no mes
- +30 dias sem reuniao
- Proximos eventos
- Ranking evolucao clientes
- Agenda do dia (calendar)
- Funil/etapas por produto
- Rankings: top churn risk, top expansao

---

### FASE 7 — Eventos com participacao automatica

Ao criar evento, selecionar produto(s) elegiveis. Ao abrir confirmacao, puxar automaticamente TODOS os offices ativos dos produtos e criar registros em event_participants. Controle de presenca (convidado/confirmado/participou/faltou).

---

### FASE 8 — Melhorias menores

- **Atividades:** tabs Hoje/Atrasadas/Futuras/Concluidas (atualmente so Pendentes/Concluidas). Tipos expandidos (ligacao, follow-up, check-in, e-mail, whatsapp, reuniao, planejamento). Checklist/subtarefas. Popup menu com edicao.
- **Reunioes:** flag share_with_client. Campo transcript.
- **Jornada:** drag & drop real (atualmente e select). Filtros por saude, status, CSM. Card com health, dias renovacao, parcelas vencidas, ultima reuniao.
- **Clientes:** colunas CSM, etapa, health, LTV, ultimo contato, proximo passo, parcelas vencidas, dias renovacao. Visoes salvas.
- **Relatorios:** tabs (Visao executiva, Churn & retencao, Receita & LTV, Health/NPS, Cobertura, Jornada analytics, Inadimplencia, Evolucao). Filtro de periodo + comparacao.
- **Configuracoes:** tabs faltantes — Health Score, Formularios, Templates/Automacoes, Catalogo de bonus, Integracoes.

---

### FASE 9 — Integracoes (stubs)

Tela de Integracoes em Configuracoes com cards para: Google Calendar, Asaas, Slack, Piperun, WhatsApp, Fireflies. Cada um mostrando status "Nao conectado" com botao de configurar + campos de API key/webhook.

---

### FASE 10 — Seed Data

Edge function ou migration com dados de exemplo: 10 escritorios, 20 socios, 30 atividades, 10 reunioes, 3 eventos, 3 produtos com jornadas e health configurados.

---

## Recomendacao de Implementacao

Dado o volume, recomendo implementar em **blocos de 2-3 fases por iteracao**, comecando por **Fase 1 (Health Score) + Fase 2 (Cliente 360 completo)** pois sao o nucleo do sistema de CS e desbloqueiam as fases seguintes (Dashboard avancado depende do Health Score, Portal depende do 360 completo).

Cada fase envolve: migracao de banco → componentes UI → integracao com telas existentes.

