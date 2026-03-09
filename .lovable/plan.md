

# Plano: Atualização em massa dos contratos existentes

## O que será feito

Executar 3 comandos SQL para atualizar os contratos de todos os escritórios que já possuem status de perda:

1. **Churn** → todos os contratos ficam `cancelado`
2. **Não Iniciado** → todos os contratos ficam `cancelado`
3. **Não Renovado** → todos os contratos ficam `encerrado`

## Comandos

```sql
-- 1. Churn → cancelado
UPDATE contracts SET status = 'cancelado'
WHERE office_id IN (SELECT id FROM offices WHERE status = 'churn');

-- 2. Não Iniciado → cancelado
UPDATE contracts SET status = 'cancelado'
WHERE office_id IN (SELECT id FROM offices WHERE status = 'nao_iniciado');

-- 3. Não Renovado → encerrado
UPDATE contracts SET status = 'encerrado'
WHERE office_id IN (SELECT id FROM offices WHERE status = 'nao_renovado');
```

Nenhum arquivo de código será alterado -- apenas dados no banco.

