# Biblioteca — como o acesso é decidido (#313)

A Biblioteca saiu da Academy em 27/09/2026 e virou menu próprio: `/biblioteca` no painel, `/aluno/biblioteca`
na área do aluno. Este documento é o contrato do acesso — quem for mexer (a #312 vai ligar a assistente a
ela) parte daqui.

## Três camadas

| Camada | Onde se configura | Tabela |
|---|---|---|
| 1. **Menu** | "Escolher grupos", no topo da Biblioteca — **e** a aba Acesso da ficha do grupo, junto de Comunidade/Agenda/Academy/etc (#315) | `biblioteca_menu_grupos` (grupo) |
| 2. **Pasta** | ⋮ da pasta → "Liberar ou bloquear…" | `biblioteca_pasta_destinos` (liberar) · `biblioteca_pasta_bloqueios` (bloquear) — grupo OU pessoa |
| 3. **Material** | ⋮ do material → "Liberar ou bloquear…" | `biblioteca_material_destinos` · `biblioteca_material_bloqueios` |

Pastas vão até **3 níveis** (pasta, subpasta, sub-subpasta). O limite e a proibição de ciclo moram no banco
(gatilho `bib_pasta_confere_arvore`); a tela só não oferece o que o banco recusaria.

## Duas telas, uma tabela só (#315)

Até 27/09/2026 o menu Biblioteca só se configurava na tela própria da Biblioteca — as outras cinco áreas
do painel do aluno (Resultados, Comunidade, Mentorias, Agenda, Academy, Classroom) se configuram na aba
**Acesso** da ficha do grupo (`groups.areas_aluno`). Um mentor com turmas em ambos os lugares tinha de
lembrar de dois lugares, e o chat já errou por causa disso: foi conferir a liberação em `areas_aluno`,
não achou nada, e concluiu (errado) que a liberação do dono não tinha funcionado.

A partir da #315 a Biblioteca aparece **também** na aba Acesso, na mesma lista de checkboxes — mas
continua **fora** de `groups.areas_aluno`, de propósito:

- o CHECK do banco em `areas_aluno` só aceita as seis áreas de sempre; "biblioteca" não é um valor válido;
- `areas_aluno = NULL` significa "sem restrição, tudo liberado, inclusive área nova que a plataforma
  ganhar depois" — mas a Biblioteca nasce **fechada** (#313), ao contrário disso. Juntar as duas
  semânticas abriria a Biblioteca sozinha para todo grupo com `areas_aluno = NULL` (a maioria) na hora em
  que "biblioteca" virasse uma área reconhecida — exatamente o que a #315 foi proibida de fazer
  ("não liberar nem remover acesso de ninguém"). Dado real que provou o risco: em 27/09 "Turma Teste" e
  "TESTE 15/08" tinham as duas `areas_aluno = NULL`, mas só a primeira tinha o menu Biblioteca.

Por isso o checkbox da Biblioteca na aba Acesso é uma **prop à parte** de `<AreasDoAluno>`
(`src/components/areas-do-aluno.tsx`), não mais um item do array `areas`: ele lê e grava
`biblioteca_menu_grupos` direto (`grupoTemMenuBiblioteca` em `data.functions.ts` para ler,
`definirMenuBibliotecaDoGrupo` em `biblioteca.functions.ts` para gravar — a MESMA tabela e a mesma
permissão "educacao" que a tela própria da Biblioteca já usava; nada de `bib_decide` mudou). As duas telas
não podem divergir porque são a mesma linha da mesma tabela — não duas tabelas sincronizadas.

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
- ~~**Assistente**: `plataforma.server.ts` só consulta a Biblioteca quando o aluno tem a área
  Academy~~ — **corrigido na #315**: `areasDoAluno()` agora soma "biblioteca" ao conjunto perguntando a
  `bib_visiveis` (a mesma checagem de `minhasAreas()`), e a leitura da Biblioteca passou a olhar essa área
  em vez de "academy". (Nota: o rótulo "#312" que estava aqui era engano — #312 é a demanda do parágrafo
  abaixo, que só chegou depois.)

## A assistente lê o conteúdo, não só o título (#312)

Antes: a assistente sabia o TÍTULO e a DESCRIÇÃO de cada material (já bastava para ligar um livro a
uma fragilidade do relatório). Agora, quando o material é um PDF já processado, ela também busca no
TEXTO e cita trechos, sempre parafraseados.

- **Indexação, uma vez, no upload**: `salvarMaterial` (só quando `kind = "pdf"` e o arquivo é novo ou
  trocou) chama `indexarMaterialPdf` (`src/lib/biblioteca-indexacao.server.ts`), que assina a URL
  (`assinarUrl` — o bucket é privado), baixa o PDF, extrai o texto com **`unpdf`** e grava em
  `biblioteca_material_trechos`: pedaços de ~200 palavras, com 25 de sobra do trecho anterior (uma
  ideia não fica cortada bem no meio), cada um sabendo a página onde começa e termina.
  `biblioteca_materiais.indexacao_status` diz o estado: `pendente` → `pronto` (ou `erro`, com o motivo
  em `indexacao_erro`); não-PDF nasce `nao_aplicavel`. Roda DENTRO da mesma requisição do upload — o
  medido em produção: o maior PDF do acervo (308 páginas) levou **2,5 s** no workerd real.
- **`unpdf`, não `pdf-lib`**: `pdf-lib` (já usado no projeto) só DESENHA PDF; para LER texto era preciso
  outro pacote. `unpdf` foi escolhido por rodar em qualquer runtime JS, Cloudflare Workers incluído —
  testado de verdade com `wrangler dev` antes de publicar (regra do projeto), não só no `vite dev`.
- **Busca por TEXTO, não por embedding**: `bib_buscar_trechos(_query, _material_id?, _limite?)` transforma
  a pergunta num OR entre as palavras significativas dela (`to_tsvector('portuguese', …)`) e ordena por
  `ts_rank` — favorece achar algo relevante a ser exigente demais, com só 9 livros no acervo hoje. Zero
  custo de indexação (nada de API de terceiro: só Postgres) e nenhum provedor novo além da Anthropic.
  Para "resuma o livro inteiro", `bib_amostra_trechos(_material_id, _limite?)` troca relevância por
  cobertura: uma amostra espalhada por igual do começo ao fim do livro.
- **A MESMA regra de permissão, sem caminho paralelo**: as duas funções filtram
  `material_id IN (SELECT id FROM bib_visiveis() WHERE tipo='material')` — a MESMA porta de sempre.
  Livro bloqueado ou fora do menu não aparece na busca, nem para dizer que existe.
  `biblioteca_material_trechos` **não tem policy nenhuma para `authenticated`**: ninguém lê o texto
  cru pela API — só as duas funções, que conferem a permissão antes.
- **Onde os trechos entram na conversa**: na ÚLTIMA MENSAGEM do histórico, montada por
  `perguntaComTrechosDaBiblioteca` (`src/lib/assistente/biblioteca-busca.server.ts`) — NUNCA no bloco de
  sistema (`<plataforma_do_aluno>`, `<dados_da_conta>`), que fica em cache na API. Se os trechos
  entrassem lá, cada pergunta nova pagaria de novo o relatório e a plataforma inteiros. Função ÚNICA
  para o aluno E o mentor (o mentor vê o acervo inteiro da conta — é o dono, sem o limite de permissão
  de aluno) e para `scripts/avaliar_assistente.ts`, que precisa chamar a MESMA função, senão avaliaria
  uma assistente mais fraca que a real.
- **Direito autoral**: instrução no texto de sistema, não trava de código — cita no máximo uma frase
  curta (~20 palavras) por resposta, sempre entre aspas, o resto parafraseado; pedido de "transcreva o
  capítulo" é recusado em uma frase, com o motivo.
- **Material que ainda não foi processado**: `PlataformaDoAluno["biblioteca"]` carrega
  `conteudoLegivel`/`aindaProcessando` (de `biblioteca_materiais.indexacao_status`) — a assistente sabe
  dizer "esse eu ainda não consigo ler" em vez de fingir que leu.
- Backfill dos PDFs que já existiam: `npx tsx scripts/indexar_biblioteca_existente.ts [--forcar]`.

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
