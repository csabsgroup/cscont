

# Relatório de QA -- Auditoria de Usabilidade e Bugs

## Resumo Executivo

Foram identificados **14 problemas** classificados por severidade: Crítico (3), Alto (5), Médio (4), Baixo (2).

---

## Bugs Criticos

### 1. Botão "Enviar Arquivos" na aba Arquivos do Evento NÃO FUNCIONA
**Onde:** `src/pages/EventoDetalhe.tsx` linha 376
**Problema:** O `<Button>` tem `pointer-events-none`, impedindo cliques de alcançar o `<label>` pai -- exatamente o mesmo bug que já foi corrigido no botão "Alterar capa", mas permanece no botão de upload de arquivos.
**Correção:** Remover `pointer-events-none` do Button e usar `<span>` estilizado (mesmo padrão aplicado na capa), ou simplesmente remover a classe.

### 2. Warning React: Select recebendo ref sem forwardRef
**Onde:** Console -- `EventoDetalhe.tsx`
**Problema:** Os componentes `<Select>` de Radix dentro de `EventoDetalhe` estão emitindo warning "Function components cannot be given refs". Isso pode causar comportamentos instáveis em future React versions.
**Correção:** Verificar se há `ref` sendo passada indevidamente aos Select; geralmente é causado por componente wrapper. Investigar a versão do Radix Select.

### 3. Exclusão de evento usa `window.confirm()` nativo
**Onde:** `src/pages/EventoDetalhe.tsx` linha 141
**Problema:** `window.confirm()` é bloqueante, inconsistente visualmente com o resto do sistema (que usa `AlertDialog` em `Cliente360.tsx`), e em contextos embed/iframe pode não funcionar corretamente.
**Correção:** Substituir por `AlertDialog` com confirmação textual, como já implementado em `Cliente360.tsx`.

---

## Bugs de Severidade Alta

### 4. Exclusão de contatos sem confirmação
**Onde:** `src/pages/ContatosGlobal.tsx` linha 102-104
**Problema:** `handleDelete` exclui o contato diretamente sem nenhuma confirmação do usuário. Um clique acidental apaga permanentemente.
**Correção:** Adicionar dialog de confirmação.

### 5. Vários deletes sem confirmação em componentes de configuração
**Onde:** `HealthScoreTab.tsx` (linhas 110-113, 131-133, 274, 386), `BonusCatalogTab.tsx` (linha 79-81), `HierarchyTab.tsx` (linha 93-96)
**Problema:** Funções de exclusão executam sem qualquer prompt de confirmação.
**Correção:** Adicionar confirmação antes de cada delete.

### 6. Validação insuficiente no formulário de evento
**Onde:** `src/pages/EventoDetalhe.tsx` -- `handleSave`
**Problema:** 
- Não valida se `event_date` está preenchido (campo obrigatório no DB).
- Não valida se `end_date > event_date`.
- `new Date(form.event_date).toISOString()` pode gerar `Invalid Date` se o campo estiver vazio.
**Correção:** Adicionar validação antes do save com mensagens de erro claras.

### 7. Upload de capa não trata erro de storage bucket inexistente gracefully
**Onde:** `src/pages/EventoDetalhe.tsx` linha 108
**Problema:** Se o bucket `event-covers` não existir ou tiver problemas de permissão, o erro é mostrado como string técnica. O toast mostra a mensagem crua do Supabase.
**Correção:** Tratar erros comuns com mensagens amigáveis.

### 8. Toast de sucesso exibido mesmo quando upload de arquivo falha parcialmente
**Onde:** `src/pages/EventoDetalhe.tsx` linhas 151-168
**Problema:** O `toast.success('Arquivo(s) enviado(s)!')` é exibido após o loop, mesmo que TODOS os uploads tenham falhado (o `continue` no error só pula para o próximo arquivo).
**Correção:** Contar sucessos e só mostrar toast de sucesso se pelo menos 1 arquivo foi enviado com sucesso.

---

## Bugs de Severidade Média

### 9. Ícone errado na aba "Arquivos"
**Onde:** `src/pages/EventoDetalhe.tsx` linha 257-258
**Problema:** A aba "Arquivos" usa o ícone `<Plus>` (sinal de +), que sugere ação de criar, quando deveria usar `<FileText>` ou um ícone de pasta/arquivo.
**Correção:** Trocar `Plus` por `FileText` ou `Paperclip`.

### 10. Estado do formulário não é recarregado ao navegar entre eventos
**Onde:** `src/pages/EventoDetalhe.tsx`
**Problema:** O `useCallback` de `fetchEvent` depende de `[id, navigate]`, mas o estado `loading` não é resetado ao mudar o `id`. Se o usuário navegar de um evento para outro sem passar pela lista, pode ver dados stale.
**Correção:** Adicionar `setLoading(true)` no início de `fetchEvent` e resetar `form` quando `id` muda.

### 11. Campo `max_participants` armazena string no state mas é enviado como int
**Onde:** `src/pages/EventoDetalhe.tsx` linhas 71, 131, 317
**Problema:** O valor `max_participants` é inicializado como `data.max_participants || ''` (string), editado como string, e convertido com `parseInt` ao salvar. Se o valor for `0`, `data.max_participants || ''` retorna `''` porque 0 é falsy.
**Correção:** Usar `data.max_participants ?? ''` em vez de `||`.

### 12. Portal Login permite ataque de timing via enumeration
**Onde:** `src/pages/portal/PortalLogin.tsx`
**Problema:** Após login bem-sucedido, o código verifica o papel e faz `signOut()` se não for cliente, expondo a informação de que o email/senha são válidos (mensagem diferente de erro de credencial vs acesso negado).
**Correção:** Unificar mensagens de erro para não revelar se as credenciais eram válidas.

---

## Bugs de Severidade Baixa

### 13. Auth.tsx expõe tab de "Criar conta" publicamente
**Onde:** `src/pages/Auth.tsx`
**Problema:** Qualquer pessoa pode criar uma conta pelo formulário de signup, mas a conta ficará sem role e sem acesso a nada. Isso pode gerar contas órfãs no sistema.
**Correção:** Considerar remover o tab de signup se o fluxo de criação de usuários é feito pelo admin em Configurações.

### 14. Falta feedback de "unsaved changes" ao navegar para fora
**Onde:** `src/pages/EventoDetalhe.tsx`
**Problema:** O usuário pode editar campos e clicar "Voltar" sem salvar, perdendo alterações sem aviso.
**Correção:** Implementar `beforeunload` ou prompt de navegação com react-router.

---

## Plano de Correção Priorizado

| Prioridade | Item | Esforço |
|---|---|---|
| P0 | #1 -- Botão "Enviar Arquivos" quebrado (`pointer-events-none`) | 5 min |
| P0 | #3 -- Substituir `confirm()` por `AlertDialog` | 15 min |
| P0 | #6 -- Validação do formulário de evento | 15 min |
| P1 | #4, #5 -- Adicionar confirmação nos deletes sem proteção | 30 min |
| P1 | #8 -- Fix toast de sucesso parcial no upload de arquivos | 10 min |
| P1 | #9 -- Trocar ícone da aba Arquivos | 2 min |
| P1 | #11 -- Fix falsy check no `max_participants` | 2 min |
| P2 | #7 -- Mensagens de erro amigáveis no upload | 10 min |
| P2 | #10 -- Reset de estado ao mudar de evento | 10 min |
| P2 | #2 -- Investigar warning de ref no Select | 15 min |
| P3 | #12 -- Unificar mensagens de erro no Portal Login | 10 min |
| P3 | #13 -- Avaliar remoção do signup público | 5 min |
| P3 | #14 -- Aviso de alterações não salvas | 20 min |

Deseja que eu inicie a correção seguindo esta priorização?

