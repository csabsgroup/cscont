

# Plano de Implementacao — 7 Blocos SenseData

Este e um conjunto massivo de mudancas. Vou dividir a implementacao em fases incrementais para garantir qualidade. Abaixo esta o plano completo.

---

## Fase 1: Fundacao (Blocos 5 e 1)

### Bloco 5 — Componente Reutilizavel ActivityCounterBadges

Criar `src/components/shared/ActivityCounterBadges.tsx`:
- Props: `counts: { todas, atrasadas, vencemHoje, aVencer, concluidas }` + `onFilter?: (filter: string) => void` + variant opcional para reunioes
- 5 badges horizontais com cores definidas (cinza-escuro, vermelho, laranja, verde, azul)
- Layout: `flex gap-3 justify-center`, cada badge com `rounded-lg px-6 py-3`, numero `text-3xl font-bold`, label `text-xs uppercase`
- Badge clicavel emite filtro via callback

### Bloco 1 — NavigationTabs + Sidebar Simplificada

**Criar `src/components/NavigationTabs.tsx`:**
- 8 tabs horizontais com icones (Home, CheckSquare, Building2, FileText, DollarSign, Phone, Kanban, BarChart3)
- Rotas: `/` (Minha Carteira), `/atividades`, `/clientes`, `/contratos`, `/financeiro`, `/contatos`, `/jornada`, `/relatorios`
- Estilo: fundo branco, `border-b border-gray-200`, tab ativa com `text-red-700 border-b-2 border-red-600 bg-red-50 rounded-t-lg`
- Scroll horizontal em mobile (`overflow-x-auto`)
- Usa `useLocation()` para tab ativa

**Modificar `AppLayout.tsx`:**
- Renderizar NavigationTabs entre header e main content
- Nao mostrar tabs em rotas `/clientes/:id` (360)

**Modificar `AppSidebar.tsx`:**
- Renomear "Dashboard" para "Minha Carteira"
- Simplificar: Operacao (Minha Carteira, Jornada), Gestao (Relatorios, Configuracoes, Auditoria)
- Remover itens duplicados das tabs (Atividades, Clientes, Contratos, etc. ja acessiveis via tabs)

**Modificar `Dashboard.tsx`:**
- Renomear titulo de "Dashboard" para "Minha Carteira"

**Adicionar rota `/financeiro`:**
- Criar pagina `src/pages/Financeiro.tsx` (pode comecar como redirect ou pagina simples agregando dados financeiros de contratos)
- Adicionar rota em `App.tsx`

**Atualizar `pageNames` no AppLayout** para refletir "Minha Carteira"

---

## Fase 2: Minha Carteira Redesign (Bloco 2)

**Reestruturar `Dashboard.tsx`:**

Secao 1 — Indicadores:
- Lado esquerdo: Health Score medio grande com cor, distribuicao por faixa (barras vermelha/amarela/verde com contagens)
- Lado direito: Grid 2x4 de KPIs compactos (MRR, Variacao MRR, MRR em Risco, MRR Expansao, Clientes Ativos, Novos, Em Risco, Expansao)
- Cada KPI: card com label `text-xs uppercase text-gray-400`, valor `text-lg font-bold`, tooltip info

Secao 2 — ActivityCounterBadges (componente do Bloco 5):
- Contar atividades globais do CSM (ou time para admin/manager)
- Clicar filtra a lista abaixo

Secao 3 — Lista de Atividades:
- Botoes "ADICIONAR ATIVIDADE" e "ADICIONAR PLAYBOOK" (outlined vermelho)
- Filtro + dropdown categoria
- Tabela com colunas: checkbox, tipo/descricao, responsavel (avatar), cliente (link 360), categoria, data
- Paginacao

---

## Fase 3: Kanban 3 Visoes (Bloco 3)

**Modificar `Jornada.tsx`:**

- Adicionar toggle de 3 visoes (Lista | Quadro | Tabela) no canto superior direito
- Mover filtros para area comum acima das visoes
- Adicionar ActivityCounterBadges com contagens dos escritorios visiveis
- Titulo da jornada: "[NOME] - (X Clientes)"

**Visao Quadro (redesign):**
- Headers cinza (`bg-gray-200 rounded-t-lg`)
- Cards com borda esquerda colorida por health (4px)
- Card: health score + nome (link) + CSM (avatar) + barra progresso tarefas
- Drag & drop mantido

**Criar componentes auxiliares:**
- `src/components/jornada/JornadaListView.tsx` — tabela flat com colunas ordenáveis
- `src/components/jornada/JornadaTableView.tsx` — estilo planilha compacto com colunas configuráveis

---

## Fase 4: Visao 360 Redesign (Bloco 4)

**Reestruturar `Cliente360.tsx`:**

Header redesenhado:
- Logo circular 48px + nome + health score visual (numero em circulo + 10 barrinhas verticais)
- Botoes: Ver como cliente, Editar, menu ...

Tabs horizontais do 360 (substituir TabsList atual):
- Visao 360, Atividades (N), Arquivos (N), Contratos, Historico, Contatos (N), Notas (N), Formularios, Plano de Acao, Cashback
- Tab ativa: `bg-red-50 text-red-700 border-b-2 border-red-600`

Aba "Visao 360" (nova aba principal):
- Grid 4 colunas de campos informativos com "VER MAIS INFORMACOES" expansivel
- Grid 4 colunas de cards indicadores grandes (Health, NPS, Dias sem Reuniao, Tarefas OKR, Parcelas Atraso, LTV, Cobertura, Dias Renovacao)
- Cada card com "VER DETALHES" linkando para aba correspondente

---

## Fase 5: Portal Calendario + Piperun + Cashback (Blocos 6, 7)

### Bloco 6 — Portal Calendario
- Toggle Lista/Calendario em `PortalEventos.tsx`
- Criar `src/components/portal/PortalCalendar.tsx` com CSS Grid (7 colunas)
- Fetch events + meetings (share_with_client=true)
- Navegacao mes, hoje destacado, click em dia expande itens

### Bloco 7.1 — Piperun Refinado
- Modificar `PiperunConfig.tsx`: adicionar filtro status=won na importacao
- Secao "Mapeamento de Campos" com tabela de/para editavel
- Mapeamentos default pre-definidos salvos no config jsonb
- Adicionar acao `listFields` na edge function para buscar campos do Piperun
- Modificar `importDeals` para aplicar mapeamento e filtrar por status=won

### Bloco 7.2 — Cashback Notificacao
- Modificar portal de bonus: ao criar bonus_request, criar atividade automatica para CSM
- Se Slack integrado, enviar notificacao
- Badge de contagem de solicitacoes pendentes na sidebar/header
- Destacar pendentes na aba Cashback do 360 com `bg-amber-50`

---

## Arquivos Novos

- `src/components/shared/ActivityCounterBadges.tsx`
- `src/components/NavigationTabs.tsx`
- `src/pages/Financeiro.tsx`
- `src/components/jornada/JornadaListView.tsx`
- `src/components/jornada/JornadaTableView.tsx`
- `src/components/portal/PortalCalendar.tsx`

## Arquivos Modificados

- `src/components/AppLayout.tsx` — adicionar NavigationTabs, renomear pageNames
- `src/components/AppSidebar.tsx` — simplificar itens
- `src/pages/Dashboard.tsx` — redesign completo "Minha Carteira"
- `src/pages/Jornada.tsx` — 3 visoes + redesign cards
- `src/pages/Cliente360.tsx` — header + tabs + aba Visao 360
- `src/pages/Atividades.tsx` — usar ActivityCounterBadges
- `src/pages/Reunioes.tsx` — usar ActivityCounterBadges adaptado
- `src/pages/portal/PortalEventos.tsx` — toggle + calendario
- `src/components/configuracoes/integrations/PiperunConfig.tsx` — mapeamento + status won
- `supabase/functions/integration-piperun/index.ts` — listFields + importacao refinada
- `src/App.tsx` — rota /financeiro

## Consideracoes

- Nao ha necessidade de migracoes de banco; todos os dados necessarios ja existem nas tabelas atuais
- A implementacao sera feita em multiplas iteracoes dado o volume (~15+ arquivos, ~3000+ linhas de codigo)
- Prioridade: Blocos 5 → 1 → 2 → 3 → 4 → 6 → 7

