

# Criar Acesso do Cliente na Tela 360

## Resumo
Adicionar opção "Gerenciar Acesso Portal" no menu de ações (⋮) do header do Cliente 360. Abre um dialog que:
- Se não existe acesso: formulário com email + senha temporária → cria usuário via edge function `admin-create-user` (já existente)
- Se já existe acesso: mostra email, status (ativo/inativo), com ações de resetar senha, ativar/desativar e desvincular

## Verificação de acesso existente
Consultar `client_office_links` pelo `office_id` → se existir, buscar o perfil e status do usuário via `admin-manage-user` (já suporta `action: 'get_metadata'`).

## Componente novo
**`src/components/clientes/ClientAccessDialog.tsx`**
- Props: `officeId`, `officeName`, `open`, `onOpenChange`
- Estado: carrega link existente ao abrir
- **Modo criar**: campos Email + Senha + botão "Criar Acesso" → chama `admin-create-user` com `role: 'client'` e `office_id`
- **Modo gerenciar**: exibe email do usuário, badge de status, botões:
  - Resetar Senha (input nova senha → `admin-manage-user` com `action: 'reset_password'`)
  - Ativar/Desativar (→ `admin-manage-user` com `action: 'toggle_ban'`)
  - Desvincular (→ deleta `client_office_links` e opcionalmente exclui o user)

## Mudanças em arquivos existentes

### `ClienteHeader.tsx`
- Adicionar prop `onManageAccess`
- Novo item no DropdownMenu: `<KeyRound />` "Gerenciar Acesso Portal"
- Visível para CSM, Manager e Admin (não Viewer/Client)

### `Cliente360.tsx`
- Importar `ClientAccessDialog`
- Estado `accessDialogOpen`
- Passar `onManageAccess` ao header
- Renderizar o dialog

## Edge function
A `admin-create-user` já cria o usuário com role `client` e vincula ao office. A `admin-manage-user` já suporta reset de senha e toggle de ban. **Preciso verificar se CSMs podem chamar essas funções** — atualmente exigem admin ou manager. Será necessário permitir CSMs também, pois eles são os que criam acesso.

### Alteração: `admin-create-user/index.ts` e `admin-manage-user/index.ts`
- Adicionar check para role `csm` (além de admin/manager)
- CSMs só podem criar/gerenciar usuários com role `client` vinculados aos seus offices

## Sem mudanças de schema
Tudo usa tabelas existentes (`client_office_links`, `profiles`, `user_roles`).

