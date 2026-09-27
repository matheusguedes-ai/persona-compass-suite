# Biblioteca — como o acesso é decidido (#313)

A Biblioteca saiu da Academy em 27/09/2026 e virou menu próprio: `/biblioteca` no painel, `/aluno/biblioteca`
na área do aluno. Este documento é o contrato do acesso — quem for mexer (a #312 vai ligar a assistente a
ela) parte daqui.

## Três camadas

| Camada | Onde se configura | Tabela |
|---|---|---|
| 1. **Menu** | "Escolher grupos", no topo da Biblioteca | `biblioteca_menu_grupos` (grupo) |
| 2. **Pasta** | ⋮ da pasta → "Liberar ou bloquear…" | `biblioteca_pasta_destinos` (liberar) · `biblioteca_pasta_bloqueios` (bloquear) — grupo OU pessoa |
| 3. **Material** | ⋮ do material → "Liberar ou bloquear…" | `biblioteca_material_destinos` · `biblioteca_material_bloqueios` |

Pastas vão até **3 níveis** (pasta, subpasta, sub-subpasta). O limite e a proibição de ciclo moram no banco
(gatilho `bib_pasta_confere_arvore`); a tela só não oferece o que o banco recusaria.

## A regra — uma função só: `bib_decide`

Para uma pessoa e um item, na ordem (a primeira que casar decide):

1. **Bloqueio no próprio material** → não vê.
2. **Bloqueio em qualquer pasta acima** (a mais próxima primeiro) → não vê.
3. **Liberação direta no material** → vê.
4. **Liberação em uma pasta acima** → vê (herança).
5. **Grupo dela tem o menu Biblioteca** → vê (herança do menu).
6. Nada disso → não vê. Item sem regra nenhuma e sem menu = **"não liberado para ninguém"**.

Consequências:

- **A negação sempre vence**: um bloqueio em qualquer ponto do caminho derruba qualquer liberação, direta
  ou herdada. Liberar para alguém não "fura" um bloqueio feito numa pasta de cima.
- **A liberação desce**: liberar uma pasta libera tudo o que está dentro dela, em qualquer nível — menos
  o que tiver bloqueio próprio no caminho.
- **O menu é a liberação mais ampla**: quem tem o menu vê a Biblioteca inteira da conta, menos os bloqueios.
- **Liberar para quem não tem o menu** funciona: a pessoa vê só aquele item (ou aquela pasta com o que tem
  dentro). No aluno, o que ele vê sem ver a pasta de cima aparece no início da Biblioteca dele.
- **Equipe da conta** (dono, mentor, colaborador) vê tudo pelo painel. Colaborador só entra com a
  permissão de Educação (checado no servidor, #226). Só o dono muda regras.

## As portas (todas passam por `bib_decide`)

| Porta | Para quê |
|---|---|
| `bib_pode_ver_material(id)` / `bib_pode_ver_pasta(id)` | Link direto e download: o arquivo só é assinado se der `true` |
| `bib_visiveis(pessoa?)` | Lista do aluno (tela, busca, prévia "ver como aluno") e o item do menu |
| `bib_quem_ve(pasta, material)` | "Quem vê isto": a lista final, pessoa a pessoa, com o motivo |
| `bib_resumo_acesso()` | O selo de cada item ("N pessoas veem", "Não liberado para ninguém") |
| RLS `bib_read` / `bibp_read` | Leitura direta pela API (etapa 2) |
| `bib_materiais_liberados` / `bib_pastas_liberadas` | Funções antigas, hoje só perguntam a `bib_visiveis` — **é por onde a assistente do aluno lê** |

`bib_decide` e `bib_decide_pessoa` não são chamáveis por login (EXECUTE revogado); as portas são
`SECURITY DEFINER` e respondem só pelo próprio login (ou, na prévia, por pessoa da conta de quem pergunta).

## Apagar pasta

`bib_apagar_pasta` nunca apaga material: o que está direto na pasta sobe um nível, e as liberações e
bloqueios da pasta são **copiados** para cada item que subiu — ninguém ganha nem perde acesso por uma
pasta ter sumido. Material só some por "Apagar" no próprio material, com confirmação.

## Leituras (regra da #314)

Toda lista da Biblioteca que cresce com o uso é lida em partes até o fim (`lerTodasOuRecusar`, de
`src/lib/ler-todas.ts`), com ordem terminando numa coluna única: o acervo e o selo de cada item no painel,
a Biblioteca do aluno (`bib_visiveis`), o "Quem vê isto" (uma linha por pessoa da conta), as regras de um
item, os grupos com o menu e as irmãs de uma pasta ao reordenar. Se um dia não der para ler tudo, a tela
recusa com uma frase em vez de mostrar número errado. Listas de ids que vão num `.in()` vão em lotes de 150
(a lista vai na URL). Provado em 27/09 com páginas de 2 linhas: o total da API bate e juntar as páginas dá
o conjunto inteiro, sem repetir nem pular.

## Ressalvas conhecidas

- **Seletor de pessoas** ("Liberar ou bloquear" → pessoas): usa `listarPessoasParaEscolher`, que ainda lê
  numa consulta só (está no levantamento da #314, `docs/leituras-sem-teto.md`). Numa conta com mais de
  1.000 pessoas, as que passarem disso não aparecem para escolher — nada é liberado errado, mas falta gente
  na lista.

- **Link de arquivo já aberto**: o link assinado de um PDF vale 10 minutos (os leitores de PDF buscam o
  arquivo em pedaços enquanto a pessoa rola). Bloquear alguém que está com o material aberto naquele
  instante não fecha a aba dele; o próximo clique já é recusado.
- **Assistente (#312)**: `plataforma.server.ts` só consulta a Biblioteca quando o aluno tem a área
  **Academy**. Aluno com o menu Biblioteca mas sem Academy fica com a assistente dizendo que não vê a
  Biblioteca — erro para o lado seguro, a corrigir na #312 (trocar a condição por "tem algo em
  `bib_visiveis`").

## Testar

Só com a conta fictícia (nunca na conta real: enquanto a regra antiga existia, material de teste
aparecia para aluno de verdade):

```
python3 scripts/fixture_biblioteca.py criar arq.json     # dona, 2 grupos, 4 alunos com login, 3 pastas, 6 materiais
python3 scripts/fixture_biblioteca.py link arq.json aluna_a [endereço]   # entrar como um papel
python3 scripts/fixture_biblioteca.py provar arq.json    # lista × link direto × "quem vê isto" × tabela × assistente
python3 scripts/fixture_biblioteca.py apagar arq.json    # cita cada id antes de apagar
```

`provar` falha se a lista do aluno, a porta do link direto e o "Quem vê isto" da dona discordarem em
qualquer item.
