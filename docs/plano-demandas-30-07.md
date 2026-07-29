# Novas demandas — plano

Onze frentes pedidas pelo Matheus em 29/07/2026: seis prioritárias, cinco para
depois. Nada iniciado.

---

## O que decide a ordem

Três critérios, nesta hierarquia:

1. **O que muda estrutura vem antes do que muda aparência.** Mexer na navegação
   depois de redesenhar telas obriga a redesenhar de novo.
2. **O que é independente vem antes do que depende.** A agenda do aluno (6)
   depende da barra lateral dele existir; enquete e menção (4) dependem da
   comunidade já ter recebido o ranking.
3. **O barato e útil primeiro**, quando empata.

Por isso a ordem executada **não** é a numeração dele.

---

## Ordem proposta

| # | Item | Peso | Depende de |
|---|---|---|---|
| A | (5) Envios e Devolutivas dentro de Testes | leve | — |
| B | (6a) Menu lateral do aluno, recolhível | médio | — |
| C | (1) Exportar dados em Pessoas | médio | — |
| D | (3) Evento rico + pop-up na Agenda | médio | — |
| E | (6b) Agenda no painel do aluno | leve | B, D |
| F | (4a) Ranking dentro da Comunidade + Membros | médio | B |
| G | (2) Educação: biblioteca + banners + cara de LMS | pesado | — |
| H | (4b) Enquetes, menções e eventos na comunidade | pesado | F |
| I | (6c) Publicar gráfico de resultado na comunidade | médio | F · ⚠️ decisão |

---

## A — Envios e Devolutivas dentro de Testes (item 5)

**Construir.** Um menu **Testes** com três abas: *Catálogo* (o que existe hoje),
*Envios* e *Devolutivas*. As telas atuais viram abas; nada é reescrito.

**Cuidado que ninguém vê até quebrar:** hoje as permissões de colaborador são
separadas (`testes`, `envios`, `devolutivas`). Se o menu virar um só, um
colaborador com permissão apenas de Envios não pode passar a enxergar Testes e
Devolutivas de brinde. A aba tem de sumir conforme a permissão, e o menu só
aparece se ele tiver ao menos uma das três.

**Testar:** entrar como colaborador com uma permissão só e conferir que as
outras abas não existem — não basta estarem escondidas.

---

## B — Menu lateral do aluno (item 6, primeira parte)

**Construir.** A barra do aluno passa de horizontal para lateral esquerda, igual
à do dono, com botão de recolher. O estado recolhido fica salvo no navegador
dele.

**Cuidado:** o mentor usa esse mesmo painel. A barra precisa comportar os itens
extras dele (Grupos, Agenda) sem virar rolagem.

---

## C — Exportar dados em Pessoas (item 1)

**Construir.** Botão **Exportar dados** ao lado de "Importar planilha", com
seleção por pessoa ou "todas", e escolha entre **XLSX** e **PDF**.

**O que vai no arquivo** precisa ser decidido: cadastro apenas, ou também
resultados dos testes? São coisas muito diferentes em tamanho e em sensibilidade.
**Proposta:** o mentor escolhe as seções antes de exportar (cadastro · grupos ·
testes respondidos · resultados · devolutivas).

⚠️ **Isto é dado pessoal saindo da plataforma.** Uma planilha com perfil
comportamental de 200 pessoas é um arquivo que vaza fácil. Recomendo: registrar
quem exportou e quando, e escrever no rodapé do PDF a quem pertence o dado. Não
impede nada — só deixa rastro.

**Testar:** exportar 1 pessoa e 50; abrir o XLSX no Excel e no Google Sheets
(acentuação costuma quebrar em um dos dois).

---

## D — Evento rico e pop-up na Agenda (item 3)

**Construir.** O evento ganha **hora de início e fim**, **imagem** (JPG/PNG) e
**link externo**. Clicar nele abre um pop-up com tudo e um botão de fechar.

Colunas novas em `eventos` (`termina_em`, `imagem_url`, `link_url`) e um balde
de imagens com as mesmas regras do bucket `marca`.

**Cuidado:** hoje o evento tem duração fixa de 60 min ao ir para o Google. Com
hora de fim de verdade, isso passa a valer — e a sincronização precisa mandar o
fim correto.

---

## E — Agenda no painel do aluno (item 6)

**Construir.** O componente já existe e já é usado pelo mentor; falta o item no
menu lateral novo. É o mais barato da lista.

---

## F — Ranking e Membros dentro da Comunidade (item 4, primeira parte)

**Construir.** O ranking sai de menu próprio e vira coluna à esquerda do feed.
Nova aba **Membros**, com a lista de quem está no grupo e link para o perfil.

⚠️ **"Acesso ao perfil dos demais" precisa de limite.** O perfil hoje inclui
e-mail, telefone e resultados. Entre colegas, isso não pode ir junto.
**Proposta:** membro vê foto, nome, cargo e o que a pessoa escolher publicar —
nada de contato e nada de resultado, a menos que ela publique (ver item I).

---

## G — Educação com cara de LMS (item 2)

**Construir**, em três partes:

1. **Biblioteca** — materiais soltos, fora de aula, com categoria e busca.
2. **Banners rotativos** no topo, JPG/PNG com link, que o master adiciona e
   remove e cuja ordem ele controla.
3. **Layout estilo Netflix** — trilhas em fileiras horizontais com capa.

É o item mais pesado dos seis, e o único que é majoritariamente visual.
**Sugiro fazer por partes**, na ordem acima: a biblioteca é a que entrega valor
sem depender do redesenho.

**Cuidado:** capa e banner pesados travam o carregamento em celular. Limite de
tamanho e recorte no envio, como já é feito com avatar.

---

## H — Enquetes, menções e eventos na comunidade (item 4)

**Construir.** Três coisas distintas, e vale separá-las:

- **Enquete** — pergunta com opções e voto. Precisa decidir: voto é anônimo?
  **Recomendo que sim**, com o total visível e quem votou oculto — enquete
  identificada em grupo de empresa vira constrangimento.
- **Menção** — escrever `@` abre a lista de membros do grupo; quem for marcado
  recebe notificação (o sino já existe).
- **Evento no feed** — reaproveita o evento da Agenda, aparecendo como cartão.

---

## I — Publicar o resultado na comunidade (item 6) ⚠️ decisão sua

**Isto inverte uma decisão sua.** Em 28/07 você definiu que a comunidade
começaria **sem** compartilhar resultado de teste, e a plataforma foi construída
assim.

Não sou contra mudar — a diferença é que agora a plataforma tem gente de
verdade usando. Três coisas para você pesar:

- Publicar é **irreversível na prática**: o colega já viu, mesmo que se apague.
- Num grupo de empresa, "todo mundo publicou menos você" **vira pressão**.
- Perfil comportamental é dado sensível: pode virar apelido, e pior, virar
  critério informal de promoção.

**Se for em frente, recomendo:** só o próprio avaliado publica o dele (nunca o
mentor pelo aluno), com aviso claro de quem vai ver, e com opção de remover.

---

## Menor prioridade — o que eu observaria

- **Design dos relatórios** — melhoria contínua; pode entrar em qualquer fresta.
- **Perfil do aluno com empresa, banner e redes** — encaixa junto de F.
- **Domínio personalizado** — quase todo o trabalho é DNS e é *seu*; o Lovable
  tem a tela pronta. Fazer depois de tudo estável: troca de domínio mexe no
  login com Google (mais um endereço de retorno).
- **Assistente de IA na Educação** — ⚠️ o único item com **custo recorrente por
  uso**. Precisa decidir quem paga e qual o teto antes de construir, senão
  aparece como surpresa na fatura.
- **Menu Integrações via API** — o mais arriscado da lista inteira: dar chave de
  API a terceiros é abrir a porta dos dados de todo mundo. Exige escopo por
  chave, registro de uso e revogação. Não começar sem desenhar isso.

---

## Decisões do Matheus — 29/07/2026

1. **Publicar resultado na comunidade: SIM.** Ele confirmou a inversão da
   decisão de 28/07, ciente de que publicar é irreversível na prática e do risco
   de pressão em grupo de empresa. As salvaguardas do item I valem: só o próprio
   avaliado publica o dele, com aviso de quem vai ver e opção de remover.
2. **Export leva SÓ o cadastro.** Nada de resultados, respostas ou devolutivas —
   o que reduz muito o risco do arquivo. O seletor de seções do plano original
   sai: não há o que escolher.
3. **Enquete com voto IDENTIFICADO.** Contra a minha recomendação, e ele decidiu
   sabendo: eu apontei o constrangimento em grupo de empresa. Fica registrado
   para não ser relitigado — se um dia incomodar, é mudança de produto, não bug.
4. **Ordem confirmada:** estrutura (A, B) antes do visual.
5. **Bug do fuso no Remarcar → menor prioridade**, a pedido dele. ⚠️ Enquanto
   não corrigido, remarcar mexendo só no dia move o compromisso 3 horas. Não é
   cosmético; é dado errado, calado.

## Acrescentados em 29/07 (depois do plano original)

**J — Educação vira "Academy".** ✅ Feito. Só o RÓTULO mudou; as rotas continuam
`/educacao`. Trocar o endereço quebraria links já enviados por e-mail e o mapa
de destino das notificações — e não traria ganho nenhum.

**K — Dados da empresa no rodapé de todas as páginas.** A definir com ele:

O rodapé aparece em telas de DOIS públicos, e isso muda o que pode ir nele:
- as telas do mentor e do dono (internas);
- as telas do avaliado — inclusive **o teste e o relatório, que são abertos por
  link, sem login**.

CNPJ, endereço e telefone no rodapé de uma página pública ficam expostos a
quem tiver o link. Para dado de empresa isso costuma ser aceitável — é o que
vai no rodapé de qualquer site —, mas é escolha dele, não minha.

**Proposta:** um único conjunto de campos em Configurações → Marca (razão
social, CNPJ, endereço, telefone, site), com uma chave "mostrar também nas
páginas públicas". Assim ele decide onde aparece sem eu adivinhar.

Encaixa junto do item "perfil do aluno com empresa e redes", da lista de menor
prioridade — é a mesma mecânica de campos livres de marca.

## Menor prioridade — lista final

- Bug do fuso no campo "Remarcar" (acima)
- Design dos relatórios
- Perfil do aluno com empresa, banner e redes
- Domínio personalizado
- Assistente de IA na Educação (⚠️ custo recorrente)
- Menu Integrações via API (⚠️ o mais arriscado)
