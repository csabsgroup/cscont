

# Diagnostico: Erro na Edge Function do Piperun

## Problema Identificado

Analisando os logs da Edge Function e o codigo, o problema principal NAO esta no codigo da funcao, mas sim na **API do Piperun retornando 503 (Service Temporarily Unavailable)**. Os logs mostram multiplas ocorrencias:

```
[PIPERUN] Error: Piperun API error [503]: <html>...<h1>503 Service Temporarily Unavailable</h1>...
```

Quando a API do Piperun retorna 503, a funcao lanca uma excecao que e capturada pelo `catch` e retorna status 500 com `"Internal server error"`. O frontend (`supabase.functions.invoke`) interpreta qualquer status non-2xx como erro, exibindo "Edge Function returned a non-2xx status code".

## Verificacao do Codigo

| Item | Status | Detalhe |
|---|---|---|
| Nome do Secret | OK | `PIPERUN_API_TOKEN` no codigo = `PIPERUN_API_TOKEN` nos Secrets |
| `Deno.env.get()` | OK | Usado corretamente |
| URL base | OK | `https://api.pipe.run/v1` |
| Header de auth | OK | `{ token: getToken() }` (Piperun aceita lowercase) |
| CORS | OK | Headers corretos, OPTIONS tratado |
| `verify_jwt = false` | OK | Configurado no config.toml |
| Auth JWT no codigo | OK | Valida Bearer token e role antes de processar |

## O que precisa melhorar

Embora o codigo esteja correto, ha dois problemas praticos:

1. **Erro generico mascarando a causa real**: O `catch` retorna `"Internal server error"` sem indicar que o problema e no Piperun. O usuario nao consegue distinguir entre token invalido, API fora do ar, ou bug interno.

2. **Sem logs de debug uteis**: Nao ha log do token sendo usado (parcial), da URL sendo chamada, ou do status recebido antes de lancar excecao.

## Plano de Correcao

### 1. Melhorar tratamento de erro nas funcoes `piperunGet` e `piperunGetAll`

Em vez de lancar excecao generica, retornar um erro com contexto (status code, se e timeout/503, etc.) e propagar isso como resposta 200 com `{ success: false, error: "..." }` para que o frontend exiba a mensagem correta.

### 2. Adicionar logs de debug no `testConnection`

Logar: token encontrado (sim/nao), URL chamada, status da resposta.

### 3. Retornar mensagem amigavel no catch

Diferenciar entre "token nao configurado", "API do Piperun indisponivel (503)", "token invalido (401/403)" e "erro interno".

### Arquivos modificados

- `supabase/functions/integration-piperun/index.ts` — melhorar error handling e adicionar logs

### Mudancas especificas

Na funcao `piperunGet` (linhas 17-24): adicionar log da URL e status antes de lancar erro.

No bloco `testConnection` (linhas 84-90): envolver em try/catch proprio que retorne `{ success: false, error: "mensagem especifica" }` em vez de deixar propagar para o catch generico.

No `catch` principal (linhas 218-222): incluir informacao contextual sobre o tipo de erro (token missing vs API error vs internal).

