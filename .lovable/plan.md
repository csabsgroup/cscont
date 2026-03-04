

## Fase 2 — Cliente 360 + Contatos + Contratos + Seed

### O que será implementado

**1. Página Cliente 360 (`/clientes/:id`)**
- Substituir o ComingSoon por uma tela completa com abas usando Radix Tabs
- **Aba Resumo**: Cabeçalho com nome, status badge, produto, health placeholder, dados do escritório (CNPJ, cidade/UF, email, telefone, instagram), datas (onboarding, ativação), contrato ativo (valor, parcelas vencidas, renovação), contato principal
- **Aba Contatos**: Lista de sócios/contatos do escritório com CRUD (nome, cargo, email, telefone, instagram, aniversário, foto, notas, flag contato principal)
- **Aba Contratos**: Histórico de contratos/ciclos com produto, valores, datas, status, link Asaas, parcelas, notas de negociação. Criar novo contrato via dialog
- **Aba Notas/Arquivos**: Campo de notas do escritório (save inline). Arquivos virão em fase futura (placeholder)

**2. Componentes**
- `ClienteHeader` — cabeçalho com avatar, nome, badges de status/produto, botão editar
- `ClienteResumo` — card grid com dados principais
- `ClienteContatos` — tabela de contatos + dialog criar/editar
- `ClienteContratos` — tabela de contratos + dialog criar/editar  
- `ClienteNotas` — textarea com save
- `StatusBadge` e `EditOfficeDialog` — componentes reutilizáveis

**3. Edição de escritório**
- Dialog para editar dados do escritório (nome, CNPJ, cidade, estado, email, telefone, instagram, status, produto, tags, notas, datas onboarding/ativação, visible_in_directory)

**4. Seed de dados**
- Inserir via migration/insert: 10 escritórios com produtos variados, 20 contatos vinculados, contratos ativos para cada escritório

**5. Melhorias na tabela de Clientes**
- Adicionar coluna de contato principal (sponsor) buscando da tabela contacts

### Estrutura de arquivos

```
src/pages/Cliente360.tsx          — página principal com tabs
src/components/clientes/ClienteHeader.tsx
src/components/clientes/ClienteResumo.tsx
src/components/clientes/ClienteContatos.tsx
src/components/clientes/ClienteContratos.tsx
src/components/clientes/ClienteNotas.tsx
src/components/clientes/EditOfficeDialog.tsx
src/components/clientes/StatusBadge.tsx
```

### Alterações em arquivos existentes
- `App.tsx`: trocar rota `/clientes/:id` de ComingSoon para Cliente360
- Nenhuma alteração de schema necessária — tabelas `offices`, `contacts`, `contracts` já existem com todos os campos

### RLS
- Já configurado na Fase 1. Contacts e contracts usam `get_visible_office_ids` para SELECT e `get_csm_office_ids` para write pelo CSM. Admin tem ALL.

