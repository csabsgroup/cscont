

# Ajuste: Configuração completa do Health Score com faixas de pontuação, dropdowns e bandas configuráveis

## Resumo

Evoluir a tela de configuração do Health Score para suportar a lógica completa do documento: faixas de pontuação configuráveis por indicador, fonte de dados via dropdown, e faixas de categorização (Saudável/Em Risco/Crítico) configuráveis por produto.

## Alterações no Banco de Dados

### 1. Nova coluna `scoring_rules` na tabela `health_indicators`
Armazena as faixas de pontuação como JSONB. Exemplo:
```json
[
  { "min": 9, "max": 10, "score": 100 },
  { "min": 7, "max": 8, "score": 60 },
  { "min": 0, "max": 6, "score": 0 }
]
```

### 2. Nova tabela `health_band_config`
Faixas de categorização configuráveis por produto:
```sql
CREATE TABLE public.health_band_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  green_min integer NOT NULL DEFAULT 80,
  yellow_min integer NOT NULL DEFAULT 50,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(product_id)
);
```
Lógica: `score >= green_min` → Saudável, `score >= yellow_min` → Em Risco, senão → Crítico.

## Alterações na UI (`HealthScoreTab.tsx`)

### Indicadores — Dialog melhorado:
- **Fonte de dados**: Dropdown com opções:
  - Reuniões (`meetings`) → Chaves: `days_since_last`, `count_period`
  - Financeiro (`contracts`) → Chaves: `installments_overdue`
  - Formulários (`form_submission`) → Chaves: `nps`, `csat`, `percepcao`
  - Eventos (`events`) → Chave: `participation_rate`
  - Planos de Ação (`action_plans`) → Chave: `completion_rate`
  - Atividades (`activities`) → Chave: `completion_rate`
- **Chave**: Dropdown dinâmico que muda conforme a fonte selecionada
- **Faixas de pontuação**: Editor visual inline onde o admin adiciona regras tipo "De X a Y = Z pontos". Botão "+ Faixa" para adicionar linhas.

### Nova sub-aba "Faixas" (ou seção dentro de Pilares):
- Campos para configurar `green_min` e `yellow_min` por produto
- Preview visual com as 3 faixas coloridas

## Alterações na Edge Function (`calculate-health-score`)

### `resolveIndicator` atualizado:
1. Buscar o valor bruto do indicador (dias sem reunião, nota NPS, parcelas vencidas, etc.)
2. Se o indicador tem `scoring_rules`, aplicar as faixas configuradas em vez do switch hardcoded
3. Fallback para lógica atual se `scoring_rules` estiver vazio

### Bandas configuráveis:
1. Buscar `health_band_config` para o produto
2. Usar `green_min` e `yellow_min` para determinar a banda em vez dos valores fixos 70/40

## Arquivos afetados: 3
1. **Migração SQL** — `scoring_rules` em `health_indicators` + tabela `health_band_config`
2. **`src/components/configuracoes/HealthScoreTab.tsx`** — UI completa com dropdowns, editor de faixas, config de bandas
3. **`supabase/functions/calculate-health-score/index.ts`** — Usar `scoring_rules` e `health_band_config`

