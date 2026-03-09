

# Plano: Fluxo Cashback Completo + Membros Ativos + QA

## 1. Cashback — Aprovação marca como "utilizado"

**Problema atual:** Em `ClienteBonus.tsx`, `handleRequestAction` apenas atualiza o status da solicitação para `approved`, mas NÃO debita do saldo (campos `used`/`available` em `bonus_grants`).

**Correção em `ClienteBonus.tsx`:**
Quando CSM aprova uma solicitação (`approved`):
1. Atualizar status do `bonus_requests` para `approved`
2. Buscar grants disponíveis do mesmo `catalog_item_id` para o `office_id`
3. Debitar a quantidade solicitada dos grants (decrementar `available`, incrementar `used`), distribuindo entre grants com saldo disponível
4. Se não houver saldo suficiente, alertar o CSM

## 2. Membros Ativos — Incluir todos os escritórios ativos + contato principal

**Problema atual:** `PortalMembros.tsx` filtra por `visible_in_directory = true` e não mostra contato principal.

**Correção em `PortalMembros.tsx`:**
- Remover filtro `.eq('visible_in_directory', true)` — mostrar todos com status `ativo`
- Manter filtro `.in('status', ['ativo'])` (apenas ativo, remover upsell/bonus_elite conforme solicitado)
- Adicionar campos `whatsapp` na query do offices
- Após buscar offices, buscar contatos principais: `contacts` com `is_main_contact = true` para os office_ids retornados
- No card de cada membro: foto, nome do escritório, email, whatsapp (link clicável), instagram, cidade, estado, **nome do contato principal**

## 3. QA Testing — Plano de testes completo

Após implementar as correções acima, executarei testes automatizados com as ferramentas de browser para:
- Navegar por todas as páginas do sistema
- Verificar se cada botão e interação funciona
- Identificar erros de console, falhas de rede, e quebras visuais
- Montar relatório de bugs encontrados

## Arquivos modificados
- `src/components/clientes/ClienteBonus.tsx` — lógica de débito ao aprovar
- `src/pages/portal/PortalMembros.tsx` — remover filtro directory, adicionar contato principal + whatsapp

