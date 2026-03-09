

# Relatório QA — Auditoria Completa do Sistema

## Metodologia

Análise estática detalhada de todo o código-fonte, consultas ao banco de dados, verificação de RLS policies, tipos TypeScript, e fluxos de dados entre componentes. Todos os arquivos críticos foram inspecionados.

---

## Bugs e Problemas Encontrados

### 1. **PortalHome — Cálculo OKR inclui action_plans órfãos** (Severidade: Média)
**Arquivo:** `src/pages/portal/PortalHome.tsx` (linha 39)
**Problema:** A query `supabase.from('action_plans').select('status').eq('office_id', officeId)` busca TODOS os action_plans, incluindo os que não têm `objective_id` (tarefas legadas/avulsas). Com a migração para OKR, o progresso deveria considerar apenas KRs vinculadas a objetivos.
**Correção:** Adicionar `.not('objective_id', 'is', null)` à query, igual ao `ClienteOKR.tsx` e `PortalOKR.tsx`.

### 2. **Cliente360 — Tabs "Timeline" e "Histórico" renderizam o mesmo componente** (Severidade: Baixa)
**Arquivo:** `src/pages/Cliente360.tsx` (linhas 372-376 e 387-389)
**Problema:** As tabs `timeline` e `historico` renderizam ambas `<ClienteTimeline officeId={office.id} readOnly={isViewer} />`. São duplicatas. A tab "Atividades" (key=timeline) mostra o ActivityCounterBadges + ClienteTimeline, e "Histórico" mostra apenas ClienteTimeline sem os counters. Funcionalidade redundante que confunde o usuário.
**Correção:** Remover a tab "Histórico" ou diferenciar seu conteúdo (ex: histórico de status, audit logs do cliente).

### 3. **PortalBonus — bg-amber-50 sem variante dark mode** (Severidade: Baixa)
**Arquivo:** `src/pages/portal/PortalBonus.tsx` (linha 195) e `src/components/clientes/ClienteBonus.tsx` (linha 225)
**Problema:** `className={r.status === 'pending' ? 'bg-amber-50/50' : ''}` não tem variante dark mode. Em tema escuro, o fundo amber-50 fica esbranquiçado e com baixo contraste.
**Correção:** Usar `bg-amber-50/50 dark:bg-amber-900/20`.

### 4. **ClienteOKR — Deleção de Objetivo sem confirmação** (Severidade: Média)
**Arquivo:** `src/components/clientes/ClienteOKR.tsx` (linha 195)
**Problema:** `onClick={() => removeObj(obj.id)}` deleta o objetivo e todas as KRs (CASCADE) sem pedir confirmação. Um clique acidental pode causar perda de dados significativa.
**Correção:** Adicionar `AlertDialog` de confirmação antes da exclusão.

### 5. **ClienteOKR — Deleção de KR sem confirmação** (Severidade: Baixa)
**Arquivo:** `src/components/clientes/ClienteOKR.tsx` (linha 221)
**Problema:** Mesmo caso, `removeKr` executa sem confirmação.
**Correção:** Adicionar confirmação ou toast com undo.

### 6. **PortalMembros — Não filtra por produto do cliente** (Severidade: Média)
**Arquivo:** `src/pages/portal/PortalMembros.tsx` (linhas 21-26)
**Problema:** A query filtra por `active_product_id` do escritório logado, mas se o escritório não tiver produto ativo (`active_product_id` = null), a query retorna vazio (`setLoading(false); return;` na linha 19). Deveria mostrar uma mensagem mais clara ou listar todos os ativos.

### 7. **ClienteBonus — handleRequestAction race condition** (Severidade: Média)
**Arquivo:** `src/components/clientes/ClienteBonus.tsx` (linhas 109-144)
**Problema:** O débito FIFO usa dados do state (`grants`) que podem estar desatualizados se dois aprovações ocorrerem em sequência rápida sem refresh intermediário. Idealmente deveria re-fetch grants antes de debitar ou usar uma transaction no backend.
**Correção:** Adicionar `await fetchAll()` ou `supabase.from('bonus_grants').select(...)` no início do `handleRequestAction` para garantir dados frescos.

### 8. **PortalOKR — Textarea onBlur dispara update desnecessário** (Severidade: Baixa)
**Arquivo:** `src/pages/portal/PortalOKR.tsx` (linhas 131-138)
**Problema:** Usa `defaultValue` + `onBlur` para salvar observações. Se o usuário clica fora sem alterar nada, a comparação `e.target.value !== (kr.observations || '')` funciona, mas se `kr.observations` é `null` e o campo está vazio, `'' !== ''` é false, então está ok. Porém o `fetchAll()` após cada update causa re-render que reseta o textarea cursor — irritante durante edição.
**Correção:** Usar debounce ou botão de salvar explícito.

### 9. **HierarchyTab — Profile interface inclui product_id inexistente** (Severidade: Muito Baixa)
**Arquivo:** `src/components/configuracoes/HierarchyTab.tsx` (linha 18)
**Problema:** Interface `Profile` tem `product_id: string | null` mas a tabela `profiles` não tem essa coluna. A query na linha 53 seleciona `id, full_name, avatar_url` sem `product_id`, então funciona mas o tipo é misleading.
**Correção:** Remover `product_id` da interface.

### 10. **PortalContatos — Sem fallback se CSM não tem perfil** (Severidade: Baixa)
**Arquivo:** `src/pages/portal/PortalContatos.tsx` (linhas 31-33)
**Problema:** Se `office.csm_id` existe mas não tem perfil correspondente (ex: usuário deletado), a página mostra "Nenhum contato disponível" sem explicação.
**Correção:** Tratar caso onde perfil não existe.

### 11. **okr_objectives RLS — Falta policy de Manager** (Severidade: Média)
**Problema:** A tabela `okr_objectives` tem policies para Admin, CSM e Client, mas não para Manager. Managers que gerenciam CSMs não conseguem ver os objetivos dos escritórios sob sua supervisão.
**Correção:** Adicionar policy: `Manager can view okr_objectives` usando `get_manager_office_ids`.

### 12. **Cliente360 — action_plans fetch não filtra por objective_id** (Severidade: Baixa)
**Arquivo:** `src/pages/Cliente360.tsx` (linha 93)
**Problema:** `supabase.from('action_plans').select('*').eq('office_id', id)` busca TODOS os action_plans, incluindo os vinculados a OKR e os avulsos. Esses dados são passados para `ClienteVisao360` como `actionPlans`. Dependendo de como Visao360 usa, pode mostrar dados duplicados ou confusos.

---

## Problemas de Usabilidade

### U1. **Reuniões tab não listada no Cliente360**
A tab "Reuniões" existe (`activeTab === 'reunioes'`) e funciona, mas está corretamente na lista `tabs360`. OK, confirmado presente.

### U2. **Instagram no PortalMembros não é clicável**
**Arquivo:** `src/pages/portal/PortalMembros.tsx` (linha 97)
**Problema:** Instagram mostra apenas texto `{m.instagram}` sem link. Deveria ser `https://instagram.com/{m.instagram}`.
**Correção:** Converter para link clicável.

### U3. **PortalLogin — Sem opção "Esqueci minha senha"**
**Arquivo:** `src/pages/portal/PortalLogin.tsx`
**Problema:** O formulário de login do portal não tem link para recuperação de senha. Clientes que esquecem a senha ficam bloqueados.

---

## Plano de Correção (Priorizado)

| # | Severidade | Item | Ação |
|---|-----------|------|------|
| 1 | Média | PortalHome OKR query | Adicionar `.not('objective_id', 'is', null)` |
| 2 | Média | Deleção OKR sem confirmação | Adicionar AlertDialog em ClienteOKR |
| 3 | Média | okr_objectives RLS Manager | Criar migration com policy Manager SELECT |
| 4 | Média | Cashback race condition | Re-fetch grants antes de debitar |
| 5 | Média | PortalMembros sem produto | Mensagem clara ou listar todos |
| 6 | Baixa | Dark mode amber-50 | Adicionar variantes dark: |
| 7 | Baixa | Tabs Timeline/Histórico duplicadas | Remover duplicata |
| 8 | Baixa | Instagram não clicável | Converter para link |
| 9 | Baixa | PortalOKR textarea UX | Melhorar fluxo de salvamento |
| 10 | Baixa | PortalLogin sem "Esqueci senha" | Adicionar link de reset |
| 11 | Muito Baixa | HierarchyTab interface | Limpar tipo |
| 12 | Baixa | PortalContatos fallback CSM | Tratar perfil inexistente |

Total: **12 issues** encontrados (4 médios, 7 baixos, 1 muito baixo). Nenhum bug crítico/bloqueante. O sistema está funcional no core, mas precisa das correções acima para robustez e usabilidade no dia a dia.

