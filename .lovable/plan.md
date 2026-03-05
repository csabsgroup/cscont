

# Plan: Central de Notificações Completa

## Visão Geral
Criar uma tabela `notifications` no banco, um componente de painel de notificações (Popover) no ícone do sino, e uma página dedicada `/notificacoes` com histórico, filtros e marcação de leitura.

## 1. Tabela `notifications` (migração)

```sql
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  message text,
  type text NOT NULL DEFAULT 'info',  -- info, warning, success, error
  entity_type text,                    -- office, activity, meeting, etc.
  entity_id uuid,
  link text,                           -- rota para navegar ao clicar
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users see own notifications
CREATE POLICY "Users see own notifications"
  ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Users can update own (mark read)
CREATE POLICY "Users update own notifications"
  ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- System/admin can insert
CREATE POLICY "Authenticated can insert notifications"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (true);

-- Users can delete own
CREATE POLICY "Users delete own notifications"
  ON public.notifications FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
```

## 2. Componente `NotificationPanel.tsx`
- Popover que abre ao clicar no sino em `AppLayout.tsx`
- Lista as últimas 20 notificações do usuário logado
- Mostra título, mensagem resumida, tempo relativo (ex: "há 5 min")
- Ícone colorido por tipo (info=azul, warning=amarelo, success=verde, error=vermelho)
- Notificações não lidas com fundo destacado
- Botão "Marcar todas como lidas"
- Link "Ver todas" que navega para `/notificacoes`
- Badge com contagem de não lidas no sino
- Realtime: subscribe a `notifications` para updates em tempo real

## 3. Página `/notificacoes`
- Nova página `src/pages/Notificacoes.tsx`
- Tabela com todas as notificações do usuário
- Filtros: tipo, status (lidas/não lidas), período
- Ações: marcar como lida/não lida, excluir
- Botão "Marcar todas como lidas"

## 4. Integração no AppLayout
- Substituir o `<button>` do sino pelo `<NotificationPanel>`
- Badge dinâmico com contagem real de não lidas (substituindo o dot estático)

## 5. Rota
- Adicionar `/notificacoes` no `App.tsx`

## Arquivos

| Arquivo | Mudança |
|---------|---------|
| Migração SQL | Criar tabela `notifications` com RLS e realtime |
| `src/components/NotificationPanel.tsx` | Novo componente (popover + lista) |
| `src/pages/Notificacoes.tsx` | Nova página com histórico completo |
| `src/components/AppLayout.tsx` | Integrar NotificationPanel no sino |
| `src/App.tsx` | Adicionar rota `/notificacoes` |

