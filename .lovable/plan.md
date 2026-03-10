

# Diagnóstico QA Completo da Plataforma

## Problemas Identificados

### 1. `confirm()` nativo usado em vez de AlertDialog (Violação do padrão UI)
**Severidade: Média** -- Inconsistência visual, experiência ruim em mobile

O padrão do sistema exige `AlertDialog` para todas as confirmações de exclusão, mas 10+ locais ainda usam `confirm()` nativo:

| Arquivo | Linha |
|---------|-------|
| `src/components/atividades/ActivityPopup.tsx` | 64 |
| `src/components/atividades/ActivityEditDrawer.tsx` | 180 |
| `src/components/clientes/ClienteTimeline.tsx` | 244 |
| `src/components/clientes/ClienteContatos.tsx` | 95 |
| `src/components/configuracoes/HierarchyTab.tsx` | 94 |
| `src/components/configuracoes/BonusCatalogTab.tsx` | 80 |
| `src/components/configuracoes/FolderAccordion.tsx` | 102 |
| `src/components/configuracoes/FormTemplatesTab.tsx` | 55 |
| `src/components/configuracoes/PlaybooksTab.tsx` | 140 |
| `src/pages/Configuracoes.tsx` (JourneyStagesTab) | 166-168 |

**Correção**: Substituir todos por `AlertDialog` com estado controlado.

---

### 2. Warning: Badge sem forwardRef no FormTemplatesTab
**Severidade: Baixa** -- Warning no console, potencial quebra futura

O componente `Badge` está recebendo ref no `FormTemplatesTab`, mas não suporta. Isso gera warnings repetidos no console.

**Correção**: Verificar se o Badge está sendo usado como child de componente que passa ref (ex: Tooltip). Provavelmente basta envolver o Badge em `<span>`.

---

### 3. Dependência faltante no useMemo do Dashboard
**Severidade: Média** -- Filtro de CSM pode não reagir corretamente

Em `src/pages/Dashboard.tsx` linha 113, o `filteredOffices` depende de `[offices, selectedCsms, selectedProductId]` mas usa `expandedCsmIds` (derivado de `selectedCsms`). Deveria depender de `expandedCsmIds` em vez de `selectedCsms`.

**Correção**: Trocar `selectedCsms` por `expandedCsmIds` na lista de dependências.

---

### 4. JourneyStagesTab: exclusão sem confirmação
**Severidade: Alta** -- Dados podem ser excluídos acidentalmente

Em `Configuracoes.tsx` linha 166-168, `handleDelete` exclui a etapa de jornada diretamente sem nenhuma confirmação (nem `confirm()` nem `AlertDialog`).

**Correção**: Adicionar AlertDialog antes da exclusão.

---

### 5. `.catch()` em builder de query Supabase
**Severidade: Média** -- Pode causar TypeError em runtime

Dois locais violam o padrão do projeto:
- `src/pages/Cliente360.tsx` linha 169
- `src/components/configuracoes/AutomationRulesTab.tsx` linha 550

**Correção**: Substituir por `const { error } = await ...` pattern.

---

### 6. useEffect com dependência `[]` em componentes que dependem de sessão
**Severidade: Baixa** -- Dados podem não recarregar se sessão mudar

Arquivos como `FormTemplatesTab`, `Formularios`, `Financeiro` fazem fetch no mount com `[]` mas não reagem a mudanças de sessão/auth. Se o usuário trocar de conta sem reload, dados ficam stale.

**Correção**: Baixa prioridade, mas idealmente depender de `session?.user?.id`.

---

### 7. Configuracoes.tsx é um arquivo monolítico de 883 linhas
**Severidade: Baixa (manutenção)** -- Dificulta manutenção, mas funcional

Contém `ProductsTab`, `JourneyStagesTab`, `UsersTab` inline. Não é um bug, mas é debt técnico.

---

## Plano de Correção (ordenado por impacto)

### Fase 1 -- Bugs críticos
1. **JourneyStagesTab**: Adicionar AlertDialog para exclusão de etapas
2. **`.catch()` patterns**: Converter para `{ error }` pattern nos 2 arquivos

### Fase 2 -- Consistência UI (confirm → AlertDialog)
3. Substituir `confirm()` nativo por `AlertDialog` em todos os 10 componentes listados acima. Para cada um:
   - Adicionar estado `deleteId` ou `showDeleteConfirm`
   - Renderizar `AlertDialog` controlado
   - Mover a lógica de delete para o callback do AlertDialog

### Fase 3 -- Warnings e polish
4. **Badge ref warning**: Envolver Badge em `<span>` no FormTemplatesTab onde necessário
5. **Dashboard useMemo deps**: Corrigir dependência de `expandedCsmIds`

### Arquivos afetados (total: ~14 arquivos)
- `src/pages/Configuracoes.tsx` (JourneyStagesTab + exclusão)
- `src/pages/Cliente360.tsx` (.catch pattern)
- `src/pages/Dashboard.tsx` (useMemo deps)
- `src/components/atividades/ActivityPopup.tsx`
- `src/components/atividades/ActivityEditDrawer.tsx`
- `src/components/clientes/ClienteTimeline.tsx`
- `src/components/clientes/ClienteContatos.tsx`
- `src/components/configuracoes/HierarchyTab.tsx`
- `src/components/configuracoes/BonusCatalogTab.tsx`
- `src/components/configuracoes/FolderAccordion.tsx`
- `src/components/configuracoes/FormTemplatesTab.tsx`
- `src/components/configuracoes/PlaybooksTab.tsx`
- `src/components/configuracoes/AutomationRulesTab.tsx`

