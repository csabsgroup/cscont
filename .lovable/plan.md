

# Plano: Cashback por tipo + OKR com Objetivos e KRs

## 1. Cashback no Portal — Cards agrupados por tipo

**Arquivo:** `src/pages/portal/PortalBonus.tsx`

Refatorar a seção "Meus Bônus" para agrupar grants por `catalog_item_id`. Para cada tipo de bônus, renderizar um Card visual com:
- Nome do item e unidade
- Quantidade total ganha (soma de `quantity`)
- Quantidade utilizada (soma de `used`)
- Quantidade restante (soma de `available`)
- Barra de progresso visual (usado/ganho)
- Data de expiração mais próxima, se houver

Substituir a tabela flat atual por cards individuais por tipo.

**Arquivo:** `src/components/clientes/ClienteBonus.tsx`

Mesma lógica de agrupamento na visão do CSM: agrupar grants por tipo no card "Bônus Concedidos", mostrando ganho/usado/restante por tipo.

## 2. OKR — Reestruturação do Plano de Ação

### Schema: Nova tabela `okr_objectives` + refatorar `action_plans`

**Migração SQL:**
```sql
-- Tabela de Objetivos
CREATE TABLE public.okr_objectives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id uuid NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  area text NOT NULL DEFAULT 'gestao_estrategica',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.okr_objectives ENABLE ROW LEVEL SECURITY;

-- RLS: mesmas policies do action_plans
CREATE POLICY "Admin can manage okr_objectives" ON public.okr_objectives FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "CSM can manage okr_objectives" ON public.okr_objectives FOR ALL TO authenticated USING (has_role(auth.uid(), 'csm') AND office_id IN (SELECT get_csm_office_ids(auth.uid()))) WITH CHECK (has_role(auth.uid(), 'csm') AND office_id IN (SELECT get_csm_office_ids(auth.uid())));
CREATE POLICY "Users see okr_objectives of visible offices" ON public.okr_objectives FOR SELECT TO authenticated USING (office_id IN (SELECT get_visible_office_ids(auth.uid())));
CREATE POLICY "Client can view okr_objectives" ON public.okr_objectives FOR SELECT TO authenticated USING (has_role(auth.uid(), 'client') AND office_id IN (SELECT get_client_office_ids(auth.uid())));

-- Adicionar colunas ao action_plans para vinculá-lo como KR
ALTER TABLE public.action_plans
  ADD COLUMN IF NOT EXISTS objective_id uuid REFERENCES public.okr_objectives(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS kr_type text NOT NULL DEFAULT 'action',
  ADD COLUMN IF NOT EXISTS area text NOT NULL DEFAULT 'gestao_estrategica';
```

**Áreas (dropdown):** Gestão Estratégica, Marketing, Vendas, Sucesso do Cliente, Gestão de Pessoas, Financeiro.

**Tipos de KR:** `meta` (meta/resultado esperado) ou `action` (ação a executar). Ambos têm apenas status (pendente/em andamento/concluído/cancelado).

### UI — `ClienteOKR.tsx` (CSM)

Refatorar completamente:
- Fetch `okr_objectives` + `action_plans` (via `objective_id`)
- Listar Objetivos como cards expansíveis (Collapsible)
- Cada objetivo mostra: título, área (badge), progresso automático (% de KRs concluídas)
- Dentro: lista de KRs com tipo (Meta/Ação badge), status, prazo
- Botão "Novo Objetivo" → dialog com título, descrição, área
- Dentro de cada objetivo: botão "Nova KR" → dialog com título, tipo (meta/ação), área, prazo, status
- CRUD completo para objetivos e KRs

### UI — `PortalOKR.tsx` (Cliente)

Refatorar para modelo OKR:
- Listar objetivos com progresso
- Dentro: KRs editáveis (status + observações pelo cliente)
- Progresso automático por objetivo

