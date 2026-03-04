

## Plataforma de Customer Success — Contador CEO

Sistema completo de CS/CRM para gerenciar escritórios contábeis membros de programas de mentoria. Baseado nas referências visuais compartilhadas: layout limpo, fundo branco, vermelho vivo (#E11D48) como cor de destaque, sidebar escura, cards com bordas suaves e boa hierarquia visual.

---

### Fase 1 — Fundação (Auth, RBAC, Layout, Tabelas Core)

**O que será entregue:**
- Configuração do Lovable Cloud (Auth + Database)
- Tabelas base: `offices`, `contacts`, `contracts`, `products`, `user_roles`, `profiles`
- RBAC com 5 perfis (admin, manager, csm, viewer, client) usando tabela `user_roles` + função `has_role` + RLS em todas as tabelas
- Layout principal: Sidebar escura com logo Contador CEO, topbar com avatar/nome do usuário, navegação para todas as telas do sitemap
- Tela de Login/Registro com branding
- Página de Clientes (tabela de escritórios) com filtros básicos e empty/loading/error states
- Seed de 3 produtos (Start CEO, Aceleração CEO, Elite CEO)

---

### Fase 2 — Cliente 360 + Contatos + Contratos

**O que será entregue:**
- Tela Cliente 360 com abas: Resumo, Contatos, Contratos/Cobrança, Notas/Arquivos
- Cadastro completo de escritório (dados, status, produto ativo)
- Gestão de contatos (sócios) vinculados ao escritório
- Contratos com ciclos, datas, valores, status, link Asaas (manual), parcelas vencidas
- Badge de status do cliente (Ativo, Churn, Não Renovado, etc.)
- Seed: 10 escritórios, 20 sócios, contratos ativos

---

### Fase 3 — Health Score + Jornada (Kanban)

**O que será entregue:**
- Configuração de Health Score por produto: pilares, indicadores, pesos, overrides
- Cálculo automático do score 0–100 com faixas (verde/amarelo/vermelho) e neutralização
- Tela de Jornada: Kanban drag & drop com colunas dinâmicas por produto
- Modal de motivo ao mover card + histórico de movimentação
- Cards do Kanban com: nome, health badge, status, dias renovação, parcelas vencidas, última reunião
- Filtros no Kanban: saúde, status, CSM, renovação
- Aba Jornada no Cliente 360 (etapa atual + checklist)

---

### Fase 4 — Atividades + Reuniões + Formulários

**O que será entregue:**
- Tela de Atividades com tabs (Hoje/Atrasadas/Futuras/Concluídas)
- Tipos de atividade: ligação, follow-up, tarefa interna, check-in, e-mail, whatsapp, reunião, planejamento, outra
- Checklist/subtarefas + popup de conclusão com observações
- Tela de Reuniões: criar manual ou calendar stub, marcar realizada com formulário
- Flag `share_with_client` por reunião
- Construtor de formulários: campos customizáveis, modelos de reunião (Kickoff, Nutrição, Renovação, etc.)
- Mapeamento de campos do formulário para indicadores de Health Score
- Timeline no Cliente 360 (atividades + reuniões com popup editar/concluir/excluir)
- Seed: 30 atividades, 10 reuniões

---

### Fase 5 — Dashboard + Relatórios

**O que será entregue:**
- Dashboard interno com todos os cards obrigatórios: clientes ativos, em risco, churn breakdown, NPS médio, health médio, distribuição por saúde, atenção hoje (lista acionável), agenda do dia, funil por etapas, rankings
- Filtros por CSM/produto/período
- Relatórios com tabs: Visão executiva, Churn & Retenção, Receita & LTV, Health/NPS/CSAT, Cobertura/Cadência, Jornada Analytics, Inadimplência, Evolução do cliente
- Gráficos com Recharts (barras, linhas, pizza, evolução temporal)
- Comparação de períodos

---

### Fase 6 — Eventos + Cashback/Bônus + Plano de Ação (OKR)

**O que será entregue:**
- Tela de Eventos: criar evento, vincular produtos elegíveis, puxar automaticamente escritórios ativos, controle de participação (convidado/confirmado/participou/faltou)
- Catálogo de Bônus/Cashback (admin): itens, unidade, validade, elegibilidade por produto
- Controle por escritório: concedido/usado/disponível + histórico
- Plano de Ação (OKR) no Cliente 360: tarefas com título, descrição, vencimento, status, observações, % conclusão
- Seed: 3 eventos com participantes

---

### Fase 7 — Portal do Cliente + Configurações + Visões Salvas

**O que será entregue:**
- Portal do Cliente (role=client): Home, Meu Contrato, Plano de Ação (editar status/obs), Reuniões (com share flag), Eventos, Bônus/Cashback (solicitar + saldo), Arquivos, Contatos, Membros Ativos (diretório do produto com `visible_in_directory`)
- Solicitação de bônus no portal → notificação para CSM aprovar/negar
- Configurações (admin): Produtos, Jornadas, Health Score, Formulários, Templates/Automações, Catálogo de bônus, Integrações (stubs), Usuários/Permissões
- Visões salvas de tabela por usuário (colunas configuráveis + reordenáveis)
- Playbooks automáticos por faixa de health (criar atividades ao mudar de faixa)
- Stubs de integração: Google Calendar, Asaas, Slack, Piperun, WhatsApp, Fireflies

---

### Design e UX

- **Paleta**: Fundo branco, vermelho vivo (#E11D48) para CTAs e destaques, preto para textos, cinzas para bordas/secundários
- **Sidebar escura** (preto/cinza escuro) com ícones + texto, colapsável para modo mini
- **Cards** com bordas suaves, sombras leves, seções numeradas (como nas referências)
- **Tabelas responsivas** com hover, seleção, paginação
- **Badges coloridos** para status e health (verde/amarelo/vermelho)
- **Empty states** ilustrados, loading skeletons, tratamento de erro em todas as telas
- **Viewer**: botões e ações desabilitados/ocultos para role viewer
- **Idioma**: Interface 100% em português brasileiro

