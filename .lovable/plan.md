
Diagnóstico completo (estado atual)

1) Engine de automações
- Função existente: `supabase/functions/execute-automations/index.ts`.
- Suporta `action: "triggerV2"` com `{ trigger_type, office_id, context }` (linhas 597-606).
- Busca `automation_rules_v2` (linhas 422-426), avalia condições (475-496), executa ações (515-523), tenta logar em `automation_logs` (533-537).
- Problema crítico encontrado: uso inválido de `.catch()` em builders do Supabase (linhas 454, 505, 537, 551). Isso gera:
  - `TypeError: supabase.from(...).insert(...).catch is not a function`
  - Abortando execução e impedindo logs/fluxo completo (confirmado nos logs da função).

2) Chamadas da engine nos fluxos
- Criação manual (`src/pages/Clientes.tsx`)
  - INSERT office: linha 528
  - invoke existente: linha 540
  - Falta: usa `action: "onNewOffice"` (linha 542) e depende de `product_id`; se nulo, cai em erro de validação no backend.
- Webhook Piperun (`supabase/functions/piperun-webhook/index.ts`)
  - INSERT office: linha 160
  - Falta: não chama `execute-automations triggerV2` após criação.
  - Além disso, quebra antes por `.catch()` inválido no insert de contrato/contato (linhas 172, 183).
- Mudança de status (`src/components/clientes/StatusChangeModal.tsx`)
  - UPDATE status: linha 91
  - invoke `triggerV2 office.status_changed`: linha 111 (ok).
- Mudança de etapa
  - `src/components/clientes/EditOfficeDialog.tsx`: update/insert etapa linhas 114-117, sem invoke de automação.
  - `src/pages/Jornada.tsx`: update etapa linha 143 + histórico linha 151, sem invoke de automação.

3) Execução de ações
- Handler existe e cobre tipos relevantes atuais: `change_csm`, `set_product`, `create_activity`, `send_notification`, `send_email`.
- Ações configuradas ativas no banco são compatíveis.
- Problema adicional: condições de regra usam `field: "product_id"` e `field: "days_since_creation"`, mas o resolver não mapeia esses campos corretamente; regra tende a não casar.

4) Logs
- Tabela `automation_logs` já existe (não precisa criar).
- Está vazia porque a engine falha antes/depois de tentar inserir logs (erro `.catch()`).
- Aba de logs na UI já existe e consulta `automation_logs`; sem dados por falha de execução.

5) Mapeamento Piperun (Passo 9)
- `field_mappings_v2` está salvo com campos técnicos corretos (`crm` + `piperun_key`), não labels.
- `resolveNestedValue` já suporta arrays, `.length` e `fields.find.{id}`.
- `sourceData` está em formato correto (deal root + company/person/proposals/fields/action).
- Motivo de “dados faltando” hoje: webhook quebra após criar office por `.catch()` inválido em contrato/contato; por isso `contracts` e `contacts` ficam vazios.
- Evidência real: office criado com campos principais preenchidos; contratos/contatos inexistentes; `webhook_logs.error` com mesmo TypeError.

Plano de correção (implementação imediata)

Passo A — Corrigir crash estrutural (`.catch` inválido)
- Arquivos:
  - `supabase/functions/execute-automations/index.ts`
  - `supabase/functions/piperun-webhook/index.ts`
  - `supabase/functions/integration-piperun/index.ts`
- Trocar todos os padrões `await ...insert(...).catch(...)` por tratamento correto:
  - `const { error } = await ...; if (error) { ... }`
- Isso sozinho destrava:
  - execução de regra
  - gravação de `automation_logs`
  - criação de `contracts/contacts` no webhook
  - atualização de `webhook_logs.processed`

Passo B — Fortalecer engine v2 (condições + logs detalhados)
- Em `execute-automations/index.ts`:
  - Adicionar logs detalhados por trigger/regra/condição/ação (modelo que você pediu).
  - Corrigir `resolveConditionValue` para campos que já existem no builder de regras:
    - `product_id` => `office.active_product_id`
    - `days_since_creation` => dias desde `office.created_at`
    - `journey_stage_id` => buscar em `office_journey`
    - `health_score` / `health_band` => `health_scores`
  - Garantir que cada regra gera 1 registro em `automation_logs` (sucesso, skip ou erro).

Passo C — Garantir gatilhos nos fluxos obrigatórios
- Manual (`Clientes.tsx`):
  - Após insert (linha 528), disparar `triggerV2` explícito:
    - `office.registered`
    - `office.created`
  - Manter fallback legado (`onNewOffice`) só quando `active_product_id` existir.
- Webhook (`piperun-webhook/index.ts`):
  - Após office criado e inserts complementares, disparar:
    - `office.registered`
    - `office.imported_piperun`
  - Não bloquear fluxo principal se automação falhar (try/catch isolado).
- Status (`StatusChangeModal.tsx`):
  - Já correto; manter.
- Etapa:
  - `EditOfficeDialog.tsx`: após update/insert de etapa, chamar `triggerV2 office.stage_changed`.
  - `Jornada.tsx`: após mover etapa com sucesso, chamar `triggerV2 office.stage_changed`.

Passo D — Ajustes de autenticação para chamada interna (webhook/import)
- Hoje `execute-automations` exige usuário autenticado.
- Para chamadas internas (webhook/import backend), permitir execução interna segura:
  - aceitar token de serviço apenas para ações internas de trigger, sem expor via frontend.
  - manter validação rígida para chamadas do cliente.
- Objetivo: webhook conseguir disparar engine v2 sem quebrar segurança.

Passo E — Passo 9 (mapeamento + debug operacional)
- `piperun-webhook/index.ts`:
  - Logar cada mapeamento aplicado:
    - `from -> to -> valor`
    - skips por vazio
  - Logar `officeData`, `contractData`, `contactData` finais.
- Corrigir persistência derivada:
  - garantir insert de contrato/contato após office.
  - manter match de produto por contains.
  - manter cálculo de mensalidade quando necessário.
- Resultado esperado:
  - office + contract + main contact completos no mesmo processamento.

Passo F — Logs/UI
- `automation_logs`: sem migração (já existe).
- `AutomationRulesTab`:
  - manter leitura atual e ajustar mensagem vazia para orientação operacional:
    - “Nenhuma automação foi executada. Verifique se as regras estão ativas e os triggers conectados.”

Validação pós-correção (E2E)
1. Reprocessar fluxo manual:
- criar office manualmente com produto.
- confirmar:
  - `automation_logs` com `trigger_type=office.registered/office.created`
  - atividades criadas
  - CSM atribuído (se regra aplicar)

2. Reprocessar webhook:
- reenviar payload do Piperun.
- confirmar:
  - office criado com campos
  - contrato e contato criados
  - `automation_logs` com `office.imported_piperun`/`office.registered`
  - `webhook_logs.processed=true`

3. Etapa/status:
- mudar status e etapa.
- confirmar novos logs `office.status_changed` e `office.stage_changed`.

Resumo do que está faltando por passo (objetivo)
- Passo 1: existe, mas quebrado por `.catch` inválido + resolver de condição incompleto.
- Passo 2: manual/status ok parcial; webhook e etapa estão sem trigger v2.
- Passo 3: executor existe; falha operacional impede efeito.
- Passo 4: logs detalhados insuficientes.
- Passo 5: estrutura existe, mas insert de log quebra no runtime.
- Passo 6: tabela já existe; não criar novamente.
- Passo 7: tela existe; está vazia por falha backend.
- Passo 8: precisa reteste E2E após correções.
- Passo 9: mapeamento técnico está correto; quebra de contrato/contato é erro de runtime, não de path/config.
