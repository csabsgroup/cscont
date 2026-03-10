

# Nova Aba "Histórico" na Visão 360 do Cliente

## Resumo
Criar uma nova aba dedicada no Cliente 360 que exibe uma timeline completa de todas as movimentações do cliente, agregando dados de múltiplas tabelas existentes e registrando novos eventos em uma tabela dedicada para capturar alterações de campos.

## Fonte de Dados (Híbrida)

**Tabelas existentes a serem consultadas em tempo real:**
- `office_stage_history` — mudanças de etapa na jornada
- `activities` (completed_at IS NOT NULL) — atividades concluídas
- `meetings` (status = completed) — reuniões realizadas
- `contracts` — criação/alteração de contratos
- `bonus_grants` — cashbacks concedidos
- `bonus_requests` — cashbacks solicitados
- `form_submissions` — formulários preenchidos
- `audit_logs` (entity_id = office_id) — alterações auditadas (campos, exclusões, etc.)

**Nova tabela dedicada:**
- `office_timeline_events` — para registrar eventos que não são capturados pelas tabelas acima (ex: alteração de campo do header, mudança de status, reatribuição de CSM). Também permite inserção retroativa se necessário.

## Schema da Nova Tabela

```sql
CREATE TABLE public.office_timeline_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id uuid NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  event_type text NOT NULL, -- 'field_change', 'status_change', 'csm_reassign', 'note_added', etc.
  title text NOT NULL,
  description text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.office_timeline_events ENABLE ROW LEVEL SECURITY;

-- RLS: visível para quem tem acesso ao office
CREATE POLICY "Users see timeline of visible offices"
  ON public.office_timeline_events FOR SELECT TO authenticated
  USING (office_id IN (SELECT get_visible_office_ids(auth.uid())));

CREATE POLICY "Authenticated can insert timeline events"
  ON public.office_timeline_events FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Admin can manage timeline events"
  ON public.office_timeline_events FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'));
```

## Componente: `ClienteHistorico.tsx`

Novo componente com:
- **Chips de filtro** por tipo de evento: Todos, Etapas, Atividades, Reuniões, Contratos, Cashbacks, Formulários, Alterações de Campo
- **Timeline visual vertical** com ícones coloridos por tipo, data formatada, descrição e autor
- **Paginação** (carregar mais) para performance
- Consulta todas as fontes em paralelo, unifica em uma lista ordenada por data (mais recente primeiro)

## Integração de Registro de Eventos

Pontos no código onde inserir na `office_timeline_events`:
1. **`Cliente360.tsx` / `ClienteVisao360.tsx`** — ao salvar campos via `saveField` (status, cidade, estado, etc.)
2. **`Cliente360.tsx`** — ao reatribuir CSM (`saveReassign`), adicionar nota rápida (`saveQuickNote`), alterar status (`StatusChangeModal`)
3. **`ClienteBonus.tsx`** — ao aprovar/rejeitar cashback

## Nova Aba no `Cliente360.tsx`

Adicionar `{ key: 'historico', label: 'Histórico', icon: History }` ao array `tabs360`, posicionado após "Visão 360".

## Arquivos Afetados
1. **Nova migração SQL** — criar tabela `office_timeline_events`
2. **Novo** `src/components/clientes/ClienteHistorico.tsx` — componente da timeline
3. **Editar** `src/pages/Cliente360.tsx` — adicionar aba e renderizar componente
4. **Editar** `src/components/clientes/ClienteVisao360.tsx` — inserir eventos ao salvar campos
5. **Editar** `src/components/clientes/ClienteBonus.tsx` — inserir eventos ao aprovar/rejeitar

