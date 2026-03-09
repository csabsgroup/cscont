

# Plano: Sincronizar status dos contratos ao mudar status do cliente

## Lógica

Quando o status do escritório mudar para um status de perda, todos os contratos desse escritório devem ter seu status atualizado automaticamente:

- **Churn** → contratos ficam `cancelado`
- **Não Iniciado** → contratos ficam `cancelado`
- **Não Renovado** → contratos ficam `encerrado`

A reversão (voltar para Ativo) **não** altera contratos automaticamente.

## Alteração

### `src/components/clientes/StatusChangeModal.tsx`

Após o `update` do status do escritório (linha 91), adicionar uma query para atualizar todos os contratos do escritório:

```typescript
// Após atualizar o office, sincronizar contratos
if (isChurnLike) {
  const contractStatus = targetStatus === 'nao_renovado' ? 'encerrado' : 'cancelado';
  await supabase.from('contracts')
    .update({ status: contractStatus })
    .eq('office_id', officeId);
}
```

Apenas 1 arquivo modificado, ~5 linhas adicionadas.

