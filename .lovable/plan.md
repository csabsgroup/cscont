

# Plano: Redesign da Página de Eventos

## Resumo

Redesenhar a página de Eventos com layout em cards visuais (com imagem de capa), filtros por produto e categoria, edição ao clicar no card, gestão de presença com status detalhados, e integração com o portal do cliente para confirmação. As categorias são fixas, observações são visíveis ao cliente, eventos passados ficam colapsados.

---

## 1. Alterações no Banco de Dados

### Tabela `events` — novos campos:
```sql
ALTER TABLE events
  ADD COLUMN cover_url text,
  ADD COLUMN category text NOT NULL DEFAULT 'encontro',
  ADD COLUMN observations text,
  ADD COLUMN confirmation_deadline_days integer DEFAULT 3;
```

Categorias fixas: `encontro`, `imersao`, `workshop`, `treinamento`, `confraternizacao`, `outro`.

- `cover_url`: URL da imagem de capa (armazenada no bucket `office-files` ou novo bucket `event-covers`)
- `confirmation_deadline_days`: até quantos dias antes do evento o cliente pode confirmar (padrão 3)

### Tabela `event_participants` — atualizar status:
O campo `status` já existe como text. Os novos valores serão:
- `a_confirmar` (ainda não respondeu)
- `confirmado` (confirmou que vai)
- `nao_vai` (confirmou que não vai)
- `compareceu` (CS marcou presença)
- `nao_compareceu` (CS marcou ausência)

Migração para status antigos:
```sql
UPDATE event_participants SET status = 'a_confirmar' WHERE status = 'convidado';
UPDATE event_participants SET status = 'compareceu' WHERE status = 'participou';
UPDATE event_participants SET status = 'nao_compareceu' WHERE status = 'faltou';
```

### Novo bucket de storage:
Criar bucket `event-covers` (público) para upload de imagens de capa.

---

## 2. Página de Eventos (Admin/CSM/Manager)

### Arquivo: `src/pages/Eventos.tsx` — reescrever

**Layout:**
- Header: título + botão "Novo Evento"
- Filtros: Select de produto + Select de categoria
- Seção "Próximos Eventos": grid de cards (2-3 colunas)
- Seção "Eventos Passados": collapsible com cards em opacidade reduzida

**Card do evento:**
- Imagem de capa no topo (ou placeholder colorido se sem imagem)
- Título, data formatada, badge de tipo (presencial/online/híbrido), badge de categoria
- Local (se houver)
- Contador de participantes confirmados / total
- Ao clicar → abre drawer/dialog de edição

### Arquivo: `src/components/eventos/EventDetailDrawer.tsx` — novo

**Drawer lateral (Sheet) com:**
- Upload de imagem de capa
- Campos editáveis: título, descrição, data início/fim, local, tipo, categoria, observações, prazo de confirmação, produtos elegíveis, máx. participantes
- Salvar alterações inline
- Abaixo: seção de Participantes (ParticipantManager atualizado)

### Arquivo: `src/components/eventos/ParticipantManager.tsx` — atualizar

**Novos status no select:**
- `a_confirmar` → "A Confirmar" (cinza)
- `confirmado` → "Confirmado" (azul)
- `nao_vai` → "Não Vai" (laranja)
- `compareceu` → "Compareceu" (verde)
- `nao_compareceu` → "Não Compareceu" (vermelho)

**Colunas da tabela:**
- Escritório | Status do Escritório | Confirmação | Presença | Ações

A coluna "Confirmação" mostra se o cliente confirmou/não vai. A coluna "Presença" é um select que o CSM preenche após o evento (compareceu/não compareceu), habilitado apenas se a data do evento já passou.

---

## 3. Portal do Cliente

### Arquivo: `src/pages/portal/PortalEventos.tsx` — atualizar

- Ao clicar no card/linha do evento, abre um dialog com:
  - Imagem de capa
  - Título, descrição, data, horário, local, observações
  - Botão de confirmação de presença (se dentro do prazo)
  - Status atual da confirmação do cliente

- Lógica do prazo: se `confirmation_deadline_days` = 3, o cliente pode confirmar até 3 dias antes do `event_date`
- Após o prazo, o botão fica desabilitado com mensagem "Prazo encerrado"

---

## 4. Health Score

A integração com HS será configurável por produto via a tela de configuração de Health Score existente. Um novo indicador `event_attendance` poderá ser adicionado com janela de tempo configurável. A implementação do cálculo no motor de HS será feita em etapa separada para manter o escopo controlado.

---

## Arquivos a criar/modificar

| Arquivo | Ação |
|---|---|
| Migration SQL | Criar (add columns + update status + bucket) |
| `src/pages/Eventos.tsx` | Reescrever com layout de cards e filtros |
| `src/components/eventos/EventDetailDrawer.tsx` | Criar novo |
| `src/components/eventos/EventCard.tsx` | Criar novo |
| `src/components/eventos/ParticipantManager.tsx` | Atualizar status e layout |
| `src/pages/portal/PortalEventos.tsx` | Atualizar com dialog de detalhes e confirmação |

