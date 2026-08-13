# Se o app cair com erro de permissão — o que fazer

Este documento é para uma situação específica: alguma tela para de funcionar
e o erro, no console ou nos logs, menciona **permissão negada** numa função
do banco (algo como `permission denied for function...`). Já aconteceu antes
(demanda #114) — o scanner de segurança do Lovable revogou, por engano, a
permissão que as políticas de acesso (RLS) precisam para funcionar.

Não precisa entender o porquê para consertar. O conserto é uma linha só.

## O conserto — uma linha

1. Abra o **editor SQL do Supabase** (painel do projeto → SQL Editor).
2. Cole exatamente isto:

   ```sql
   SELECT public.reconceder_grants();
   ```

3. Rode. O resultado é um número:
   - **Um número maior que zero** → achou funções sem a permissão e já
     concedeu de volta. O app volta a funcionar na hora, sem precisar
     publicar nada — é só banco.
   - **Zero** → não tinha nada para consertar. Se o erro continuar depois
     disso, o problema é outro (não é isto aqui).

Pode rodar essa linha quantas vezes quiser, a qualquer momento, mesmo sem
nada quebrado — ela nunca faz mal. É só um "conferir e corrigir se precisar".

## Como conferir ANTES de precisar (sem esperar o app cair)

Cole isto no mesmo editor SQL:

```sql
SELECT * FROM public.grants_faltando();
```

O que cada resultado quer dizer:

- **Veio vazio (nenhuma linha)** → está tudo certo. Nenhuma função está sem
  a permissão que precisa.
- **Veio alguma linha** → aquela função está com um problema de permissão
  agora mesmo. As colunas dizem exatamente qual papel está faltando:
  - `falta_authenticated = true` → falta a permissão que o app usa quando
    alguém está logado. **Esta é a que derruba telas** — se aparecer,
    rode o conserto da seção anterior.
  - `falta_service_role = true` ou `falta_postgres = true` → falta a
    permissão de um papel interno/administrativo. Mais raro de acontecer e
    menos provável de ser visível numa tela, mas o mesmo conserto resolve.

### Quadro completo (opcional, para ver tudo, não só o que falta)

Se quiser ver a situação de TODAS as funções protegidas, não só as com
problema:

```sql
select
  p.proname as funcao,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated,
  has_function_privilege('service_role', p.oid, 'EXECUTE') as service_role,
  has_function_privilege('postgres', p.oid, 'EXECUTE') as postgres
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prosecdef
  and not (p.proname = any (public.grants_excecoes()))
order by 1;
```

Cada linha é uma função. `true` na coluna quer dizer "esse papel pode usar a
função"; `false` quer dizer "não pode" — e se `authenticated` estiver
`false` em alguma linha, é isso que está quebrando telas.

## O que NÃO aparece nessas consultas, de propósito

Existem 6 funções de manutenção/uso interno que **não devem** aparecer com
`authenticated = true` — isso é esperado, não é bug. São ferramentas
internas (`grants_faltando`, `reconceder_grants`, `retrato_do_schema`) e
funções auxiliares que só outra função do banco deveria chamar
(`track_liberada_para`, `bib_pasta_liberada_para`,
`bib_material_liberado_para`). A lista completa das exceções está em
`public.grants_excecoes()`, e as consultas acima já a levam em conta.

## Por trás da linha de conserto

`reconceder_grants()` e `grants_faltando()` vivem no banco desde a demanda
#114/#241, e foram estendidas na #273 para cobrir três papéis
(`authenticated`, `service_role`, `postgres`) em vez de só um. O código-fonte
das duas está versionado em
`supabase/migrations/20260812200000_grants_tres_papeis.sql`.
