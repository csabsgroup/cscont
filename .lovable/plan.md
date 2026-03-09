

# Fix Formulários: 3 Bugs + Nova Página

## Resumo

Corrigir 3 problemas no sistema de formulários e criar página dedicada para CSMs preencherem formulários.

## Bug 1 — Campo de cliente no FormFillDialog

O `FormFillDialog` recebe `officeId` como prop obrigatória (vem da reunião/360), mas não tem campo para selecionar cliente quando usado avulso.

**Fix:** Refatorar `FormFillDialog` para:
- Tornar `officeId` opcional na interface Props
- Adicionar campo de seleção de cliente no topo (dropdown com busca por name, external_id, cnpj)
- Se `officeId` é passado: campo pré-preenchido e bloqueado (🔒)
- Se não: dropdown obrigatório filtrado pela carteira do CSM
- Adicionar campo de CSM (pré-preenchido com logado, editável por admin/manager)
- Tornar `meetingId` também opcional (para uso avulso sem reunião)

## Bug 2 — Nova página Formulários

Criar `src/pages/Formularios.tsx` com duas seções:

**Seção 1 — Formulários disponíveis:** Cards de `form_templates` ativos, com botão "Preencher" (internos → abre FormFillDialog avulso) e "Copiar link" (externos).

**Seção 2 — Últimos preenchimentos:** Tabela de `form_submissions` com data, formulário, cliente, CSM, botão ver (👁️ abre drawer com respostas).

**Navegação:**
- Sidebar: adicionar "Formulários" (📝 `FileText`) no grupo Operação, entre Jornada e Tarefas Internas
- NavigationTabs: adicionar tab "Formulários" com path `/formularios`
- AppLayout: adicionar ao `pageNames`
- App.tsx: nova rota `/formularios`

## Bug 3 — Options do builder (vírgula não funciona)

Linha 554-561 do `FormTemplatesTab.tsx` usa um `<Input>` único com split por vírgula. Problema: ao digitar vírgula, o split imediato remove o que está sendo digitado.

**Fix:** Substituir por inputs individuais estilo Google Forms:
- Array de inputs, um por opção
- Botão "+ Adicionar opção" e 🗑️ para remover
- Mínimo 1 opção

## Ajuste adicional — Visualizar submissão

Componente `SubmissionViewDrawer` (Sheet) que mostra todos os campos e respostas de uma submissão, com indicação de campos mapeados para o header.

## Arquivos

| Arquivo | Ação |
|---------|------|
| `src/pages/Formularios.tsx` | Criar — página principal |
| `src/components/reunioes/FormFillDialog.tsx` | Editar — adicionar campo cliente + CSM, tornar officeId/meetingId opcionais |
| `src/components/configuracoes/FormTemplatesTab.tsx` | Editar — substituir input de opções por inputs individuais (linhas 554-561) |
| `src/App.tsx` | Editar — nova rota `/formularios` |
| `src/components/AppSidebar.tsx` | Editar — adicionar "Formulários" no grupo Operação |
| `src/components/NavigationTabs.tsx` | Editar — adicionar tab Formulários |
| `src/components/AppLayout.tsx` | Editar — adicionar ao pageNames |

