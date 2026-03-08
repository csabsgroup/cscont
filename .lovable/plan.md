

# Fix: Ordenação por ID — Somente pelo número final

## Problema identificado

A seta muda (toggle funciona), mas a ordem não muda visivelmente. Isso acontece porque o sort atual compara a string completa (`"ELT - 001"` vs `"ACE - 002"`), e como a maioria dos registros tem prefixos diferentes, a ordenação agrupa por prefixo em vez de ordenar pelo número.

O usuário quer ordenar **somente pelo número final**: 001, 002, 003... ignorando o prefixo.

## Fix em `src/pages/Clientes.tsx`

Alterar o `case 'officeCode'` (linha 425) para extrair o número final do `office_code`:

```typescript
case 'officeCode': {
  const numA = parseInt((a.office_code || '').replace(/\D/g, '').slice(-3) || '0', 10);
  const numB = parseInt((b.office_code || '').replace(/\D/g, '').slice(-3) || '0', 10);
  va = numA; vb = numB; break;
}
```

Isso extrai os últimos 3 dígitos numéricos: `"ELT - 001"` → `1`, `"ACE - 042"` → `42`.

Como `va` e `vb` serão números, a comparação cairá no branch numérico (`(va - vb)`) em vez do `localeCompare`.

Registros sem `office_code` terão valor `0` e irão para o início (ASC) ou final (DESC).

