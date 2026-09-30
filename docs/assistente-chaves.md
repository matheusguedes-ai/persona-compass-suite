# As quatro chaves de privacidade da assistente (#316, fatia A)

O contrato que as próximas fatias (B — memória; D — resumo ao mentor; e as que ligarem o aprendizado com
a plataforma e a calibragem) precisam cumprir. Decisões do dono do produto de 28/09/2026.

## As chaves

| Chave (id) | Título na tela e no termo | Grupo | Liga (quando existir) | Função existe? |
|---|---|---|---|---|
| `lembrar_conversas` | Lembrar das nossas conversas | fica (só ela e o aluno) | memória entre conversas | não — fatia B |
| `aprender_plataforma` | Aprender com o que eu faço na plataforma | fica | ajustar respostas ao comportamento ao longo do tempo | não |
| `mentor_acompanha` | Meu mentor acompanha meu progresso | **sai** (para o mentor) | tema, padrão e progresso — nunca transcrição | não — fatia D |
| `melhorar_assistente` | Ajudar a melhorar a assistente | **sai** (despersonalizado) | calibragem com conversas sem identificação | não |

- **Independentes**, não uma escala. **Tudo começa desligado**: sem linha em `assistente_chaves` = tudo
  desligado, e nenhuma função liga chave por conta própria.
- **A 3 só liga com a 1**, e **desliga junto** quando a 1 desliga (CHECK no banco + `assistente_gravar_chaves`).
- **Desligar pede a escolha, na hora**: apagar o que a chave guardou, ou manter em espera. O banco recusa
  desligar sem a escolha. "Manter" = o dado fica parado, sem uso, até religar ou apagar.
- A chave 2 **não** é a leitura do painel que a assistente já faz para responder (aulas, presença, pontos —
  isso é o uso básico descrito no termo, desde a #305). Ela liga *aprender com o jeito de usar ao longo do
  tempo*. O termo diz isso com todas as letras; quem construir essa função não pode ampliar o sentido.

## Onde mora cada coisa

- **Estado atual**: `assistente_chaves` (dono = `user_id` do login + `conta_id`). Só o próprio aluno lê.
- **Histórico**: `assistente_chaves_registro` — cada `aceite`, `mudanca`, `apagar_tudo` e `revogacao`, com o
  aceite em vigor (`consentimento_id` → versão e TEXTO aceitos), o estado das quatro chaves depois do evento,
  as que desligaram e a escolha de cada uma (`ao_desligar`). Não se edita (gatilho). É a prova do critério
  "quem aceitou qual versão e com quais chaves".
- **Quem grava**: só funções do banco sobre `auth.uid()` — `assistente_aceitar`, `assistente_definir_chaves`,
  `assistente_apagar_tudo`, `assistente_revogar`. Nenhuma tela ou servidor escreve nas tabelas.
- **Tela**: `src/lib/assistente/chaves.ts` (títulos, grupos, dependência, marca `disponivel`) e
  `src/components/assistente/chaves-de-privacidade.tsx` (os dois blocos com separador, o diálogo de desligar).

## O que cada fatia nova PRECISA fazer

1. **Ler a chave antes de usar ou guardar** — do banco, a cada vez (o aluno muda quando quer). Chave
   desligada = não usa E não guarda nada novo; o que já estava guardado fica em espera.
2. **Pôr o DELETE do que guarda em `assistente_apagar_guardado(_user_id, _chaves)`** — a única porta por
   onde "apagar" chega aos dados de uma chave. Desligar com "apagar", "apagar tudo" e revogar passam todos
   por ela; quem guardar dado fora dela deixa o aluno sem o direito de apagar.
3. **Marcar a chave como disponível** em `DEFINICAO_DAS_CHAVES` (`disponivel: true`) — some o "em breve"
   e a nota de "nada foi guardado".
4. **Atualizar a linha das chaves nas orientações** (`instrucoes.server.ts`, seção Privacidade: hoje diz
   "Nenhuma dessas funções existe ainda") e rodar a bateria de qualidade nos três níveis.
5. Tabela nova com dado do aluno entra na lista `PROIBIDAS` de `scripts/testar_assistente_mentor.ts` se o
   mentor não puder lê-la. A fatia D (o que o mentor recebe) abre caminho próprio e explícito — nunca
   afrouxando as policies de conversa (`user_id = auth.uid()`).

## O termo

- `assistente_termos.explica_chaves`: só sob um termo que explica as chaves a tela as mostra e o banco
  aceita ligar alguma (sob o texto de 19/09 nenhuma liga; desligar sempre pode).
- **Versão em vigor = a maior publicada.** Aceite de versão anterior não basta para conversar: a tela mostra
  o texto novo (com as chaves como o próprio aluno já tinha deixado) e, embaixo, o caminho para baixar,
  apagar tudo ou revogar SEM aceitar. Ao aceitar, o aceite antigo fica marcado `substituido_em` (não é
  apagado nem revogado) e as conversas continuam.
- Fonte: `scripts/conteudo_termo_assistente.py`. `aplicar` grava a versão nova como **rascunho**; só
  `publicar --confirmo` põe em vigor — e **só com o código da #316A já no ar** (regra 5): publicado com o
  código antigo, o aluno aceitaria pela tela antiga, sem as chaves.
- O bloco sobre a observação do mentor é do dono (28/09) e entra palavra por palavra (`conferir` falha se
  mudar). Três decisões moram nele: "pode registrar"; manda perguntar ao mentor; não diz que ela não conta.

## Como provar de novo

- Banco, com rastro zero: `scripts/testar_chaves_assistente.sql` (um `DO` que publica a versão nova SÓ
  dentro do teste, faz um aluno fictício aceitar a antiga e a nova, mexe nas chaves e termina com
  `raise exception` — tudo se desfaz). Troque o login fictício no topo.
- Tela: `python3 scripts/fixture_assistente.py criar --login`, entrar no servidor local (memória "testar
  como aluno logado") e, para ver as chaves antes de a versão nova ser publicada, apontar SÓ o aceite do
  fictício para o rascunho (`termo_id`/`termo_versao` da versão 2, pela chave de serviço).
