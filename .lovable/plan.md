

# Plan: Hierarquia, WhatsApp no Perfil e Contatos no Portal

## 1. Campo WhatsApp no perfil do usuário

**Tabela `profiles`**: Já possui coluna `phone`. Adicionar nova coluna `whatsapp` (text, nullable).

**`UserProfileDialog.tsx`**: Adicionar campo "WhatsApp" (input com placeholder "5511999999999") que salva em `profiles.whatsapp`.

**`admin-manage-user` edge function**: Incluir `whatsapp` no `update_profile` action para que admins também possam definir o WhatsApp ao editar usuários.

**`UsersTab` (Configuracoes.tsx)**: Na aba "Dados" do edit dialog, adicionar campo WhatsApp.

## 2. Aba "Hierarquia" em Configurações

**Nova seção no sidebar**: `{ key: 'hierarquia', label: 'Hierarquia', icon: GitBranch, category: 'Usuários & Permissões', adminOnly: true }`

**Novo componente `HierarchyTab.tsx`**:
- Lista todos os Managers com seus CSMs vinculados (via `manager_csm_links`)
- Para cada Manager: card expandível mostrando CSMs atuais + botão para adicionar/remover CSMs
- Select dropdown com CSMs disponíveis (sem vínculo ou para reatribuir)
- Operações: INSERT/DELETE em `manager_csm_links`
- Campo para selecionar qual Admin aparece como contato no portal → salva em `portal_settings` como `portal_contact_admin_id`

**RLS**: `manager_csm_links` já tem policies para admin gerenciar. Sem mudanças de schema necessárias além da coluna whatsapp.

## 3. Admin configurável no portal

**`portal_settings`**: Nova chave `portal_contact_admin_id` (UUID do admin escolhido). Configurável na aba Hierarquia.

## 4. Portal Contatos — refatoração

**`PortalContatos.tsx`**: Refatorar a lógica para:
1. Buscar `offices.csm_id` → perfil do CSM
2. Buscar `manager_csm_links` para o CSM → perfil(s) do(s) Gestor(es)
3. Buscar `portal_settings.portal_contact_admin_id` → perfil do Admin configurado
4. Para cada contato, exibir:
   - Nome, role (CSM / Gestor / Diretor de Operações)
   - Link clicável para WhatsApp: `https://wa.me/{whatsapp}` usando `profiles.whatsapp`
   - Ícone do WhatsApp verde ao lado do número

## 5. Migração SQL

```sql
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS whatsapp text;
```

## Arquivos modificados
- **Migração**: nova coluna `whatsapp` em `profiles`
- **`src/components/UserProfileDialog.tsx`**: campo WhatsApp
- **`src/components/configuracoes/HierarchyTab.tsx`**: novo componente
- **`src/pages/Configuracoes.tsx`**: sidebar entry + renderContent + import
- **`src/pages/portal/PortalContatos.tsx`**: refatoração completa
- **`supabase/functions/admin-manage-user/index.ts`**: suporte a whatsapp no update_profile
- **`src/hooks/usePortalSettings.ts`**: incluir `portal_contact_admin_id` no tipo

