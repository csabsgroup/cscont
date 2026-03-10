

# Três Ajustes: Bug Campo Data, Lógica Condicional Estilo Typeform e Conclusão sem Êxito

## 1. Bug: Campo "Data" renderizado como escala 1-10

**Diagnóstico**: O código de renderização em `FormFillDialog` e `FormPublic` está correto -- ambos tratam `case 'date'` com `<Input type="date">`. O bug provavelmente ocorre quando o campo é salvo no banco com um tipo corrompido ou quando o template é carregado e o tipo sofre overwrite. Vou adicionar uma camada de proteção na função `addField` e na carga dos campos para garantir que o tipo seja preservado. Também vou verificar se há algum conflito com `scale_min`/`scale_max` que possa estar causando o fallthrough.

**Arquivos**: `src/components/configuracoes/FormTemplatesTab.tsx`

---

## 2. Lógica Condicional estilo Typeform/Google Forms

**Problema atual**: A lógica condicional está configurada no campo DESTINO ("mostrar este campo quando campo X = valor Y"). O usuário quer o modelo inverso, usado no Typeform: configurar no campo ORIGEM ("se o usuário responder X nesta pergunta, ir para seção Y").

**Solução**: Reescrever a lógica condicional para funcionar por pergunta de origem:
- No campo de tipo `dropdown`, `multi_select`, `boolean`, `rating_5`, `rating_nps`, `linear_scale` -- adicionar configuração de **roteamento por resposta**
- Para cada opção da pergunta (ou Sim/Não no boolean), o admin define "ir para qual seção"
- No formulário de preenchimento (FormFillDialog + FormPublic), implementar **navegação por seções** -- quando o usuário responde uma pergunta com roteamento, o formulário pula para a seção configurada
- Manter compatibilidade com a lógica de show/hide existente

**Modelo de dados** (dentro do campo, no JSON `conditional_logic`):
```json
{
  "enabled": true,
  "routing_type": "answer_routing",
  "routes": [
    { "answer_value": "Opção A", "target_section_id": "uuid-secao-1" },
    { "answer_value": "Opção B", "target_section_id": "uuid-secao-2" }
  ],
  "default_target_section_id": "uuid-secao-3"
}
```

**UI de configuração**: Quando lógica condicional está ativada num campo com opções (dropdown, boolean, multi_select), mostrar uma tabela "Resposta → Ir para seção" com as opções da pergunta como linhas e um Select de seção em cada linha.

**Arquivos**:
- `src/components/configuracoes/FormTemplatesTab.tsx` -- UI de configuração do roteamento
- `src/components/reunioes/FormFillDialog.tsx` -- navegação por seções no preenchimento
- `src/pages/FormPublic.tsx` -- mesma navegação no formulário público

---

## 3. Conclusão com/sem Êxito nas Atividades

**Mudanças no banco**: Adicionar coluna `completion_outcome` (text, nullable, default null) na tabela `activities`. Valores: `'success'` (concluída com êxito) ou `'no_show'` (sem êxito/no-show).

**UI do drawer de edição** (`ActivityEditDrawer.tsx`):
- Substituir o botão "Concluir" por dois botões:
  - ✅ "Concluir" (verde) -- seta `completion_outcome = 'success'`
  - ❌ "Sem êxito" (vermelho/laranja) -- seta `completion_outcome = 'no_show'`
- Ambos exigem observações obrigatórias
- O sub-dialog de conclusão recebe o tipo selecionado e mostra título adequado

**UI do popup** (`ActivityPopup.tsx`):
- Mesmo ajuste: duas opções no dropdown (Concluir / Sem êxito)

**Visual na listagem** (`Atividades.tsx` -- `ActivityCard`):
- Concluída com êxito: ícone ✅ verde + badge "Concluída"
- Concluída sem êxito: ícone ❌ vermelho + badge "Sem êxito"
- Badge de status no drawer: "Concluída ✅" ou "Sem êxito ❌"

**Automações**: O trigger `activity.completed` passa o `completion_outcome` no contexto para que automações possam diferenciar.

**Migration SQL**:
```sql
ALTER TABLE public.activities ADD COLUMN completion_outcome text;
```

### Arquivos afetados
- **Migration SQL**: nova coluna `completion_outcome`
- `src/components/atividades/ActivityEditDrawer.tsx`
- `src/components/atividades/ActivityPopup.tsx`
- `src/pages/Atividades.tsx`
- `src/components/configuracoes/FormTemplatesTab.tsx`
- `src/components/reunioes/FormFillDialog.tsx`
- `src/pages/FormPublic.tsx`

