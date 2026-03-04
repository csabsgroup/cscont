

# Plan: Desfazer Importacao + Exclusao em Massa

## 1. Tabela `import_batches` (nova)

Criar tabela para rastrear cada importacao realizada, armazenando os IDs dos registros criados para permitir rollback.

```sql
CREATE TABLE public.import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  entity_type text NOT NULL,        -- 'offices', 'contacts', etc.
  table_name text NOT NULL,
  record_ids uuid[] NOT NULL DEFAULT '{}',
  record_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  undone_at timestamptz           -- NULL = ativo, preenchido = desfeito
);

ALTER TABLE public.import_batches ENABLE ROW LEVEL SECURITY;

-- Apenas admin e manager podem ver/gerenciar batches
CREATE POLICY "Admin can manage import_batches" ON public.import_batches
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Manager can manage import_batches" ON public.import_batches
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'manager')) WITH CHECK (has_role(auth.uid(), 'manager'));

CREATE POLICY "Users can view own batches" ON public.import_batches
  FOR SELECT TO authenticated USING (user_id = auth.uid());
```

## 2. Modificar `ImportWizard.tsx`

Apos cada importacao bem-sucedida:
- Coletar todos os IDs inseridos (capturar retorno do `.insert().select('id')`)
- Inserir um registro em `import_batches` com os IDs
- Exibir no resultado a opcao de "Desfazer importacao"

## 3. Nova secao "Historico de Importacoes" no `ImportExportTab.tsx`

- Listar as ultimas importacoes de `import_batches` (onde `undone_at IS NULL`)
- Cada item mostra: data, entidade, quantidade, usuario
- Botao "Desfazer" com confirmacao (AlertDialog)
- Ao desfazer: deletar os registros pelos IDs armazenados, marcar `undone_at = now()`
- Registrar no `audit_logs`

## 4. Nova secao "Exclusao em Massa" no `ImportExportTab.tsx`

- Cards para cada entidade (Clientes, Contatos, Contratos, Reunioes)
- Ao clicar, abre dialog com:
  - Filtros opcionais (status, produto, CSM)
  - Preview da quantidade de registros que serao deletados
  - Campo de confirmacao (digitar "EXCLUIR" para confirmar)
  - Botao de exclusao com processamento em lotes
- Exclusao registra audit_log com detalhes
- Restrito a Admin apenas

## 5. Componentes novos

- `src/components/import-export/ImportHistorySection.tsx` — lista de batches com botao desfazer
- `src/components/import-export/BulkDeleteDialog.tsx` — dialog de exclusao em massa
- `src/components/import-export/UndoImportDialog.tsx` — confirmacao de rollback

## 6. Resumo de arquivos

| Arquivo | Acao |
|---|---|
| Migration SQL | Criar tabela `import_batches` com RLS |
| `src/components/import-export/ImportWizard.tsx` | Capturar IDs e salvar batch |
| `src/components/import-export/ImportHistorySection.tsx` | Novo: listar batches, desfazer |
| `src/components/import-export/BulkDeleteDialog.tsx` | Novo: exclusao em massa |
| `src/components/configuracoes/ImportExportTab.tsx` | Adicionar secoes de historico e exclusao |

