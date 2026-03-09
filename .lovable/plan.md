

# Plan: Pastas para Playbooks e Automações

## Resumo
Criar sistema de pastas manuais livres com UI de accordion colapsável, separado para Playbooks e Automações.

## Database

**Nova tabela: `config_folders`**
```sql
CREATE TABLE public.config_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  scope text NOT NULL CHECK (scope IN ('playbooks', 'automations')),
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.config_folders ENABLE ROW LEVEL SECURITY;
-- Admin full access
CREATE POLICY "Admin can manage config_folders" ON public.config_folders FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
-- Authenticated read
CREATE POLICY "Authenticated can view config_folders" ON public.config_folders FOR SELECT USING (true);
```

**Novas colunas:**
- `playbook_templates.folder_id uuid REFERENCES config_folders(id) ON DELETE SET NULL`
- `automation_rules_v2.folder_id uuid REFERENCES config_folders(id) ON DELETE SET NULL`

## UI — Componente compartilhado

**Novo arquivo: `src/components/configuracoes/FolderAccordion.tsx`**

Componente reutilizável que recebe:
- `scope: 'playbooks' | 'automations'`
- `items: any[]` (playbooks ou regras)
- `renderItem: (item) => ReactNode`
- `onMoveItem: (itemId, folderId | null) => void`

Comportamento:
- Lista pastas como seções colapsáveis com chevron + nome + badge com contagem
- Seção "Sem pasta" no final para itens sem `folder_id`
- Botão "Nova pasta" no topo — inline input para digitar nome
- Cada pasta tem menu (renomear, excluir)
- Excluir pasta move itens para "Sem pasta" (ON DELETE SET NULL)
- Cada item dentro de pasta tem opção "Mover para pasta" via dropdown no menu de ações

## Mudanças nos componentes existentes

### `PlaybooksTab.tsx`
- Fetch `config_folders` com `scope = 'playbooks'`
- Agrupar playbooks por `folder_id`
- Renderizar via `FolderAccordion` em vez da tabela flat
- Adicionar campo "Pasta" no editor dialog (Select dropdown)
- Ao salvar playbook, incluir `folder_id` no payload

### `AutomationRulesTab.tsx`
- Fetch `config_folders` com `scope = 'automations'`
- Agrupar regras por `folder_id`
- Renderizar via `FolderAccordion` em vez da listagem flat
- Adicionar campo "Pasta" no editor de regra (Select dropdown)
- Ao salvar regra, incluir `folder_id` no payload

## Fluxo do usuário
1. Abre Configurações > Playbooks (ou Automações)
2. Clica "Nova pasta" → digita nome → Enter
3. Abre playbook/regra existente → seleciona pasta no dropdown → salva
4. Novos itens podem já ser criados dentro de uma pasta
5. Pastas colapsam/expandem com clique no header

