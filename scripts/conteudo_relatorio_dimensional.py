"""
Texto de relatório para os instrumentos dimensionais: Valores, Temperamentos,
VAK e Big Five.

O problema
----------
A parte do DISC no relatório tem ~13.500 caracteres e 14 seções. Temperamentos
tinha 3.269 e VAK 3.838 — quatro vezes menos. Quem responde a bateria inteira
recebe um relatório fundo do DISC e um resumo dos outros, o que passa a
impressão errada de que os outros testes valem menos.

A causa não era falta de vontade: o motor só sabia montar três seções para esses
instrumentos (síntese, potencialidades, pontos de atenção). Com o motor ampliado,
este arquivo escreve o que faltava.

Cinco seções novas por dimensão
-------------------------------
perfil          leitura longa de quando a dimensão se destaca
trabalho        como aparece no trabalho
relacoes        como aparece nas relações
pressao         como a pessoa fica sob pressão
desenvolvimento por onde começar a trabalhar isso
sombra          o que significa esta ser a dimensão MAIS BAIXA da pessoa

A `sombra` é a que costuma faltar em relatório comercial: todo mundo descreve o
que se destaca, quase ninguém descreve o que está ausente — e a ausência explica
tanto quanto a presença.

Todo texto é original. As metodologias são de domínio público; os textos de
relatórios comerciais não são.
"""

# instrumento -> dimensão -> seção -> texto
CONTEUDO = {
    # ============================================================ VALORES ====
    "valores": {
        "TEO": {
            "perfil": "**Teórico.** O que te move é entender. Diante de um assunto novo, sua primeira "
                      "pergunta é como aquilo funciona — não para que serve nem quanto rende. Você tolera "
                      "bem a complexidade e desconfia de explicação fácil demais.",
            "trabalho": "**Teórico no trabalho.** Você rende onde há problema para destrinchar e tempo para "
                        "investigar. Vira referência técnica sem procurar por isso. O atrito aparece em "
                        "ambientes que pedem decisão rápida sem base — ali você trava, e chamam de lentidão.",
            "relacoes": "**Teórico nas relações.** Você se aproxima por conversa de conteúdo e valoriza quem "
                        "pensa com você. Pode passar por frio ao responder a um desabafo com análise, quando "
                        "a pessoa queria acolhimento.",
            "pressao": "**Teórico sob pressão.** Você se refugia na análise. Estudar mais um pouco vira uma "
                       "forma de adiar a decisão, e o prazo chega sem escolha feita. Nesses momentos vale "
                       "perguntar: o que eu ainda preciso saber de verdade para decidir?",
            "desenvolvimento": "**Por onde começar.** Estabeleça de antemão quanto de informação basta para "
                               "cada tipo de decisão. Nem tudo merece o mesmo nível de aprofundamento, e "
                               "definir isso antes evita que a curiosidade decida por você.",
            "sombra": "**Teórico é o que menos te move.** Você vai direto ao uso das coisas e tem pouca "
                      "paciência para o porquê. É eficiente, e economiza um tempo que muita gente perde. "
                      "O custo aparece quando o problema volta: sem entender a causa, você resolve o mesmo "
                      "sintoma várias vezes.",
        },
        "ECO": {
            "perfil": "**Econômico.** O que te move é o retorno. Você avalia esforço, custo e resultado antes "
                      "de entrar em qualquer coisa, e tem pouca tolerância a desperdício — de dinheiro, de "
                      "tempo ou de energia. Praticidade, para você, é uma forma de respeito.",
            "trabalho": "**Econômico no trabalho.** Você enxerga rápido o que dá resultado e o que é enfeite. "
                        "É bom em priorizar e em cortar o que não se paga. O atrito vem quando o valor não é "
                        "mensurável: cultura, clima e formação demoram a aparecer em número e você tende a "
                        "subestimá-los.",
            "relacoes": "**Econômico nas relações.** Você demonstra cuidado resolvendo problemas concretos e "
                        "é generoso de forma prática. Pode parecer calculista ao pesar o custo de compromissos "
                        "que, para o outro, eram só afeto.",
            "pressao": "**Econômico sob pressão.** Você corta. Reduz escopo, elimina o supérfluo e protege o "
                       "essencial — o que costuma ser acertado. O risco é cortar também o que sustenta o "
                       "resultado no médio prazo e só perceber quando a conta chega.",
            "desenvolvimento": "**Por onde começar.** Escolha uma decisão recente que você tomou pelo retorno "
                               "e liste o que ela custou fora da planilha. Não para mudar a decisão — para "
                               "treinar o olho em ver o custo que não vem em número.",
            "sombra": "**Econômico é o que menos te move.** Você decide por outros critérios que não o "
                      "retorno, e isso te dá liberdade para escolhas que gente mais pragmática não faria. "
                      "O custo é concreto: projeto que não se paga, tempo investido onde não havia retorno, "
                      "e a sensação recorrente de que faltou planejamento.",
        },
        "EST": {
            "perfil": "**Estético.** O que te move é a forma. Você repara em proporção, acabamento e "
                      "harmonia, e sente incômodo físico com o que está malfeito. Não é vaidade: é um jeito "
                      "de perceber o mundo em que a aparência das coisas carrega informação.",
            "trabalho": "**Estético no trabalho.** Você eleva o padrão do que passa pela sua mão. Apresentação, "
                        "texto e produto saem melhor acabados. O atrito aparece em ambientes onde 'está bom o "
                        "suficiente' é a regra — ali seu capricho vira, aos olhos dos outros, atraso.",
            "relacoes": "**Estético nas relações.** Você cuida do ambiente e dos gestos, e as pessoas se "
                        "sentem bem perto de você sem saber explicar por quê. Também pode julgar pelo "
                        "invólucro e demorar a enxergar quem se apresenta mal.",
            "pressao": "**Estético sob pressão.** Você refina quando deveria entregar. O acabamento vira "
                       "refúgio: é mais confortável mexer na forma do que encarar a decisão difícil que "
                       "está por baixo dela.",
            "desenvolvimento": "**Por onde começar.** Defina o nível de acabamento antes de começar, não "
                               "durante. 'Rascunho', 'bom' e 'impecável' pedem esforços muito diferentes, e "
                               "decidir isso na largada evita polir o que não precisava.",
            "sombra": "**Estético é o que menos te move.** Forma, para você, é secundária: o que importa é "
                      "funcionar. Isso te faz rápido e sem frescura. O custo é que a apresentação também "
                      "comunica — trabalho bom mal apresentado é recebido como trabalho mediano.",
        },
        "SOC": {
            "perfil": "**Social.** O que te move é o outro. Você mede o valor do que faz pelo efeito que "
                      "aquilo teve na vida de alguém, e se dispõe a ajudar mesmo quando não sobra tempo. "
                      "Ver alguém crescer perto de você é o que dá sentido ao esforço.",
            "trabalho": "**Social no trabalho.** Você segura o time nos momentos ruins e cria o ambiente em "
                        "que os outros rendem. É procurado quando alguém precisa desabafar. O atrito vem na "
                        "decisão dura: cortar, cobrar e demitir custam a você mais do que à média.",
            "relacoes": "**Social nas relações.** Você acolhe, escuta e está presente. As pessoas confiam em "
                        "você rápido. O risco é o desequilíbrio: dar muito mais do que recebe e chamar isso "
                        "de normal por tempo demais.",
            "pressao": "**Social sob pressão.** Você cuida de todo mundo e se esquece. Assume tarefa dos "
                       "outros para poupá-los e chega ao limite sem ter avisado ninguém — porque avisar "
                       "pareceria pesar sobre quem já está pesado.",
            "desenvolvimento": "**Por onde começar.** Treine dizer 'não posso agora' sem justificar. Uma "
                               "recusa explicada demais soa negociável, e você acaba cedendo na segunda "
                               "insistência. A frase curta é a que protege.",
            "sombra": "**Social é o que menos te move.** Você separa bem a tarefa da pessoa e decide sem "
                      "que o vínculo pese — o que torna você confiável nas horas difíceis. O custo é que "
                      "eficiência sem cuidado desgasta a relação, e o desgaste só aparece quando você "
                      "precisa da colaboração de quem se sentiu tratado como recurso.",
        },
        "POL": {
            "perfil": "**Político.** O que te move é influência. Você quer ter voz no rumo das coisas e se "
                      "incomoda genuinamente em ser espectador. Percebe onde está o poder num ambiente antes "
                      "da maioria e se posiciona em relação a ele.",
            "trabalho": "**Político no trabalho.** Você assume responsabilidade, negocia bem e faz sua "
                        "posição ser ouvida. Cresce em ambientes competitivos. O atrito vem quando o desejo "
                        "de conduzir passa por cima da contribuição alheia — e as pessoas param de trazer "
                        "ideia para não vê-la absorvida.",
            "relacoes": "**Político nas relações.** Você tem presença e as pessoas te seguem com naturalidade. "
                        "Também pode transformar convivência em disputa sem perceber, e quem não quer "
                        "competir se afasta em silêncio.",
            "pressao": "**Político sob pressão.** Você fecha o controle. Centraliza decisão, reduz o espaço "
                       "dos outros e assume mais do que consegue tocar — porque delegar, nesse momento, "
                       "parece perder terreno.",
            "desenvolvimento": "**Por onde começar.** Escolha uma decisão por semana para delegar de verdade: "
                               "quem decide é o outro, e você segura a mão. O desconforto dos primeiros dias "
                               "é a medida exata do quanto isso precisava ser treinado.",
            "sombra": "**Político é o que menos te move.** Você não disputa espaço e não se incomoda de "
                      "ficar fora da decisão — o que faz de você alguém fácil de conviver e sem agenda "
                      "escondida. O custo é ficar de fora de escolhas que te afetam, e depois conviver com "
                      "regras que você não ajudou a escrever.",
        },
        "REL": {
            "perfil": "**Religioso.** O que te move é sentido. Você precisa que o que faz se encaixe em algo "
                      "maior — não necessariamente uma fé, mas um conjunto de princípios que dá unidade às "
                      "suas escolhas. Incoerência te incomoda mais do que erro.",
            "trabalho": "**Religioso no trabalho.** Você entrega mais quando acredita no propósito e sustenta "
                        "posição impopular quando ela é coerente com o que pensa. O atrito aparece quando o "
                        "trabalho é só trabalho: sem sentido à vista, seu rendimento cai de verdade.",
            "relacoes": "**Religioso nas relações.** Você busca profundidade e conversa sobre o que importa "
                        "sem rodeio. Também pode cobrar dos outros uma coerência que eles não combinaram de "
                        "ter, e se decepcionar por conta disso.",
            "pressao": "**Religioso sob pressão.** Você se recolhe para pensar. Precisa reencontrar o "
                       "sentido antes de voltar a agir, e esse tempo nem sempre existe. Quando falta, você "
                       "age sem convicção — e sente isso como uma pequena traição a si mesmo.",
            "desenvolvimento": "**Por onde começar.** Escreva em uma frase o que torna aceitável um trabalho "
                               "que não te empolga. Ter isso claro evita duas armadilhas: largar cedo demais "
                               "e aguentar tempo demais.",
            "sombra": "**Religioso é o que menos te move.** Você não precisa de propósito declarado para "
                      "funcionar bem, e isso te dá uma resiliência que os mais idealistas não têm. O custo "
                      "aparece no longo prazo: sem uma linha que ligue as escolhas, é fácil olhar para trás "
                      "e não reconhecer o caminho.",
        },
    },
    # ====================================================== TEMPERAMENTOS ====
    "temperamentos": {
        "COL": {
            "perfil": "**Colérico.** Você reage rápido e a reação dura. É o temperamento da intensidade: "
                      "decide em segundos, se envolve inteiro e não desiste com facilidade. Onde os outros "
                      "hesitam, você já se moveu.",
            "trabalho": "**Colérico no trabalho.** Você tira projeto do papel e sustenta a pressão que "
                        "derruba os outros. É quem assume quando ninguém quer. O atrito é o ritmo: o seu é "
                        "mais rápido que o da maioria, e o que para você é urgência, para o time é atropelo.",
            "relacoes": "**Colérico nas relações.** Você é leal e direto — quem convive sabe onde pisa. "
                        "Também explode com facilidade e às vezes deixa marca em quem não tem a sua casca. "
                        "Você esquece rápido; o outro nem sempre.",
            "pressao": "**Colérico sob pressão.** Você acelera e endurece. Toma a frente, corta a discussão "
                       "e decide sozinho. Funciona na emergência e cobra caro depois, quando as pessoas que "
                       "foram passadas por cima param de se envolver.",
            "desenvolvimento": "**Por onde começar.** Instale uma pausa: quando sentir a reação subindo, "
                               "adie a resposta por dez minutos. Não é sobre engolir — é sobre escolher as "
                               "palavras com o mesmo cuidado com que você escolhe o rumo.",
            "sombra": "**Colérico é o que menos aparece em você.** Você raramente se exalta e não gosta de "
                      "confronto, o que torna a convivência leve. O custo é o momento em que a firmeza "
                      "faria falta: nem toda situação se resolve com jeito, e algumas pedem que alguém "
                      "bata o pé.",
        },
        "SAN": {
            "perfil": "**Sanguíneo.** Você reage rápido e passa rápido. Sente forte na hora e não carrega "
                      "depois — briga hoje e amanhã está tudo bem. Vive no presente e contagia quem está "
                      "por perto.",
            "trabalho": "**Sanguíneo no trabalho.** Você abre portas, faz o clima do time e emplaca ideia "
                        "nova com facilidade. O atrito é a continuidade: quando a empolgação do começo "
                        "acaba e sobra o operacional, seu rendimento cai bem antes do fim.",
            "relacoes": "**Sanguíneo nas relações.** Você faz amizade em qualquer lugar e as pessoas gostam "
                        "de estar com você. Também se compromete no impulso com mais do que consegue "
                        "cumprir, e a frustração de quem contava com você é real, mesmo sem má intenção.",
            "pressao": "**Sanguíneo sob pressão.** Você dispersa. Começa várias coisas, conversa com muita "
                       "gente e termina o dia com a sensação de ter corrido sem sair do lugar. O bom humor "
                       "segue firme, o que às vezes esconde que o problema não andou.",
            "desenvolvimento": "**Por onde começar.** Escolha uma coisa por vez e combine o fim com alguém. "
                               "Compromisso com outra pessoa funciona para você melhor do que qualquer "
                               "sistema de organização — porque o vínculo te segura onde a disciplina não.",
            "sombra": "**Sanguíneo é o que menos aparece em você.** Você não se anima com facilidade e "
                      "mantém a mesma temperatura o tempo todo, o que traz consistência. O custo é o "
                      "entusiasmo que não chega aos outros: o time também precisa de alguém que celebre, "
                      "e esse papel raramente é seu.",
        },
        "MEL": {
            "perfil": "**Melancólico.** Você reage devagar e a impressão fica. Processa por dentro, "
                      "demora a se abrir e guarda o que sentiu por muito tempo. É o temperamento da "
                      "profundidade — e do peso que vem junto com ela.",
            "trabalho": "**Melancólico no trabalho.** Você enxerga o que pode dar errado antes de todo mundo "
                        "e entrega com um cuidado que os outros não alcançam. O atrito é o começo: você "
                        "demora a se mover, e a análise que protege o resultado também atrasa a largada.",
            "relacoes": "**Melancólico nas relações.** Você é leal e presente para poucos, com uma "
                        "profundidade rara. Também se magoa com o que passou despercebido para o outro, e "
                        "costuma não dizer — e a mágoa fica.",
            "pressao": "**Melancólico sob pressão.** Você se fecha e antecipa o pior. A autocrítica sobe e "
                       "vira paralisia: quanto mais importa, mais difícil começar, porque começar mal "
                       "parece pior do que não começar.",
            "desenvolvimento": "**Por onde começar.** Diga o que te incomodou na semana em que aconteceu, "
                               "não meses depois. É desconfortável e é exatamente por isso que funciona — "
                               "o que você fala na hora não vira acúmulo.",
            "sombra": "**Melancólico é o que menos aparece em você.** Você não remói e não se abala com "
                      "facilidade, o que te poupa muito sofrimento. O custo é a profundidade que fica de "
                      "fora: nem tudo se resolve seguindo em frente, e algumas coisas só se entendem "
                      "quando a gente para para senti-las.",
        },
        "FLE": {
            "perfil": "**Fleumático.** Você reage pouco, e o que sente não transborda. Mantém a mesma "
                      "temperatura na bonança e na crise. É o temperamento da constância — as pessoas se "
                      "apoiam em você justamente porque nada te desmonta.",
            "trabalho": "**Fleumático no trabalho.** Você sustenta o ritmo longo sem oscilar e é quem mantém "
                        "a cabeça fria quando o resto perde. O atrito é a iniciativa: você espera ser "
                        "chamado, e isso faz o seu trabalho render menos reconhecimento do que merece.",
            "relacoes": "**Fleumático nas relações.** Você é fácil de conviver, não cria conflito e ouve "
                        "mais do que fala. Também guarda para si o que pensa, e quem convive com você às "
                        "vezes não sabe se está tudo bem de verdade.",
            "pressao": "**Fleumático sob pressão.** Você desacelera e espera passar. Muitas vezes é a "
                       "resposta certa. Outras, o problema precisava de alguém que se mexesse — e a sua "
                       "calma, ali, é o que atrasa a solução.",
            "desenvolvimento": "**Por onde começar.** Escolha um assunto em que você tem opinião e diga "
                               "primeiro, antes de a sala se posicionar. Você quase sempre tem uma leitura "
                               "boa; o que falta é ela chegar antes de a decisão já estar tomada.",
            "sombra": "**Fleumático é o que menos aparece em você.** Você sente e demonstra com intensidade, "
                      "e ninguém precisa adivinhar como você está. O custo é o desgaste: viver em alta "
                      "rotação cobra do corpo, e a calma que falta é justamente o que permitiria durar mais.",
        },
    },
    # ================================================================ VAK ====
    "vak": {
        "V": {
            "perfil": "**Visual.** Você organiza o mundo pelo que vê. Entende quando enxerga a estrutura — "
                      "um esquema, uma tabela, um desenho — e guarda imagem melhor do que palavra falada. "
                      "Bagunça visual te atrapalha de verdade, não é implicância.",
            "trabalho": "**Visual no trabalho.** Peça a pauta antes da reunião e transforme em diagrama o "
                        "que for explicado só de boca. Suas anotações rendem mais com cor, seta e destaque "
                        "do que com texto corrido — e isso não é enfeite, é como você recupera depois.",
            "relacoes": "**Visual nas relações.** Você lê expressão facial com precisão e percebe pela cara "
                        "da pessoa antes de ela falar. Também pode se prender à aparência das coisas e "
                        "julgar cedo demais por ela.",
            "pressao": "**Visual sob pressão.** O excesso de estímulo te satura: tela cheia, ambiente "
                       "movimentado e mesa desorganizada derrubam sua concentração antes do cansaço real. "
                       "Limpar o campo de visão costuma render mais do que insistir com força de vontade.",
            "desenvolvimento": "**Por onde começar.** Ao final de qualquer conversa importante, desenhe o "
                               "que foi combinado em três caixas. Leva um minuto e resolve o ponto fraco "
                               "do seu canal, que é reter o que foi dito só em voz.",
            "sombra": "**Visual é o canal que menos usa.** Você acompanha bem sem apoio de imagem, o que "
                      "te dá independência de slide e de material bonito. O custo aparece no volume: "
                      "informação demais sem organização visual vira massa, e o que era importante se "
                      "perde no meio.",
        },
        "A": {
            "perfil": "**Auditivo.** Você organiza o mundo pelo que ouve. Entende conversando, retém o tom "
                      "de voz e costuma repetir por dentro o que precisa gravar. Barulho de fundo atrapalha "
                      "você mais do que atrapalha a média.",
            "trabalho": "**Auditivo no trabalho.** Suas melhores conclusões saem falando com alguém. "
                        "Explicar em voz alta o que você acabou de ler vale mais do que reler. Reunião "
                        "rende para você — desde que você tenha espaço para falar, não só ouvir.",
            "relacoes": "**Auditivo nas relações.** Você percebe pelo tom o que as palavras não dizem, e "
                        "acerta bastante. Também guarda frases — o que foi dito num momento ruim volta a "
                        "você com uma nitidez que a outra pessoa nem imagina.",
            "pressao": "**Auditivo sob pressão.** O diálogo interno acelera. A conversa que deu errado fica "
                       "se repetindo e ocupa espaço mental que faria falta em outro lugar. Falar com "
                       "alguém, aí, costuma desligar o loop mais rápido do que tentar parar sozinho.",
            "desenvolvimento": "**Por onde começar.** Grave um áudio de dois minutos resumindo o que "
                               "aprendeu, em vez de escrever resumo. Você retém pelo canal que usou para "
                               "produzir, e escrever é o que menos te serve.",
            "sombra": "**Auditivo é o canal que menos usa.** Você não depende de explicação falada e "
                      "acompanha bem por conta própria. O custo é o que só circula por conversa: "
                      "combinado de corredor, contexto e recado costumam escapar de você, e isso pode ser "
                      "lido como desatenção.",
        },
        "K": {
            "perfil": "**Cinestésico.** Você organiza o mundo pelo corpo e pela experiência. Aprende "
                      "fazendo, decide pelo que sente e precisa se mexer para pensar. Ficar parado ouvindo "
                      "por muito tempo não é falta de interesse — é o seu canal desligando.",
            "trabalho": "**Cinestésico no trabalho.** Você aprende ferramenta nova mexendo, não lendo "
                        "manual. Peça para fazer junto em vez de assistir. Reunião longa sentado rende "
                        "pouco para você; caminhar enquanto pensa rende muito.",
            "relacoes": "**Cinestésico nas relações.** Você sente o clima do ambiente no corpo e percebe "
                        "quando algo está errado antes de qualquer sinal explícito. Também absorve tensão "
                        "alheia e sai de reuniões difíceis fisicamente cansado.",
            "pressao": "**Cinestésico sob pressão.** A tensão vai para o corpo: ombro, estômago, sono "
                       "picado. Você costuma perceber pelo físico antes de perceber pela cabeça — e "
                       "ignorar esse sinal é o erro mais comum de quem tem este canal.",
            "desenvolvimento": "**Por onde começar.** Antes de decidir algo importante, dê uma volta de "
                               "dez minutos com o assunto na cabeça. Não é distração: para você, o "
                               "movimento é parte do processamento, e a clareza costuma chegar andando.",
            "sombra": "**Cinestésico é o canal que menos usa.** Você aprende bem sem pôr a mão e absorve "
                      "conteúdo abstrato com facilidade. O custo é a distância entre saber e fazer: o que "
                      "você entendeu na teoria pode não sobreviver ao primeiro contato com a prática.",
        },
    },
    # =========================================================== BIG FIVE ====
    # Aqui a leitura é diferente: os cinco traços são independentes, e o alto e o
    # baixo de cada um valem igual. `perfil` descreve o traço quando ele está
    # ALTO; `sombra`, quando é o mais baixo dos cinco.
    "bigfive": {
        "O": {
            "perfil": "**Abertura alta.** Você é atraído pelo que ainda não conhece. Gosta de ideia, de "
                      "variedade e de repensar o que já estava resolvido. Rotina longa demais te sufoca "
                      "antes de cansar os outros.",
            "trabalho": "**Abertura no trabalho.** Você é forte em começo de coisa e em problema sem "
                        "manual. Traz o ângulo que ninguém tinha considerado. O risco é a inquietação: "
                        "mexer no que já funciona só porque ficou parecido demais consigo mesmo.",
            "relacoes": "**Abertura nas relações.** Você se interessa por gente diferente de você e "
                        "aguenta bem a discordância — inclusive gosta dela. Pode achar entediante quem "
                        "tem a vida arrumada e não quer mexer.",
            "pressao": "**Abertura sob pressão.** Você busca saída nova quando talvez bastasse fazer o "
                       "básico bem feito. A criatividade, aí, é uma forma de fuga do trabalho repetitivo "
                       "que resolveria o problema.",
            "desenvolvimento": "**Por onde começar.** Antes de propor o jeito novo, escreva por que o "
                               "atual não serve mais. Se você não conseguir, o problema pode ser tédio, "
                               "não deficiência do processo.",
            "sombra": "**Abertura é o seu traço mais baixo.** Você fica com o que funciona e não perde "
                      "tempo reinventando — o que traz uma estabilidade que os outros aproveitam. O custo "
                      "aparece quando o contexto muda: o método que serviu por anos vira desvantagem, e "
                      "quem confia no que já deu certo é o último a perceber.",
        },
        "C": {
            "perfil": "**Conscienciosidade alta.** Você termina o que começa e cumpre o que combina. "
                      "Planeja antes, confere depois e não deixa pendência solta. Das cinco, é a "
                      "característica que mais prevê entrega — e a que mais cobra de você.",
            "trabalho": "**Conscienciosidade no trabalho.** Você é a pessoa em quem se confia o que não "
                        "pode falhar. Prazo, padrão e detalhe estão sob controle. O risco é o excesso: "
                        "capricho onde bastava terminar, e dificuldade para delegar sem refazer.",
            "relacoes": "**Conscienciosidade nas relações.** Você é confiável e as pessoas sabem que pode "
                        "contar. Também pode cobrar dos outros um padrão que ninguém combinou de seguir, e "
                        "se frustrar com quem não funciona assim.",
            "pressao": "**Conscienciosidade sob pressão.** Você aumenta o controle: mais lista, mais "
                       "conferência, mais horas. Funciona até o ponto em que o cansaço come a qualidade "
                       "que você estava tentando proteger.",
            "desenvolvimento": "**Por onde começar.** Escolha uma entrega por semana para fazer no nível "
                               "'bom' em vez de 'impecável', e observe se alguém nota. A resposta costuma "
                               "recalibrar o quanto o seu padrão é necessidade e o quanto é hábito.",
            "sombra": "**Conscienciosidade é o seu traço mais baixo.** Você é flexível, se adapta ao "
                      "imprevisto e não se prende a plano — o que rende em cenário instável. O custo é "
                      "concreto e acumula: prazo estourado, combinado esquecido e a fama de que com você "
                      "é preciso lembrar duas vezes.",
        },
        "E": {
            "perfil": "**Extroversão alta.** Você busca contato e movimento. Fala com facilidade, ocupa "
                      "espaço e sai de um dia cheio de gente com mais energia do que entrou. Ambiente "
                      "silencioso demais te esvazia.",
            "trabalho": "**Extroversão no trabalho.** Você articula, apresenta e destrava conversa parada. "
                        "É quem faz a ponte entre áreas. O risco é ocupar espaço demais e não perceber que "
                        "a sala inteira parou de contribuir.",
            "relacoes": "**Extroversão nas relações.** Você aproxima rápido e mantém uma rede ampla. "
                        "Também pode confundir quantidade com profundidade e chegar a um momento difícil "
                        "com muita gente conhecida e pouca gente próxima.",
            "pressao": "**Extroversão sob pressão.** Você fala mais e pensa menos. Precisa processar em "
                       "voz alta, e o que era rascunho sai como posição — depois é preciso desfazer o que "
                       "nem chegou a ser decidido.",
            "desenvolvimento": "**Por onde começar.** Em reunião, espere duas pessoas falarem antes de "
                               "você. É pequeno e muda o que a sala entrega — e você descobre coisas que "
                               "não apareceriam se tivesse falado primeiro.",
            "sombra": "**Extroversão é o seu traço mais baixo.** Você trabalha bem sozinho, escuta mais do "
                      "que fala e chega com contribuições mais maduras. O custo é a visibilidade: quem "
                      "não aparece é lembrado depois, e trabalho bom feito em silêncio às vezes não conta.",
        },
        "A": {
            "perfil": "**Amabilidade alta.** Você parte da confiança, procura entender antes de julgar e "
                      "prefere ceder a criar atrito. Cooperar é o seu modo padrão, e as pessoas sentem "
                      "isso rápido.",
            "trabalho": "**Amabilidade no trabalho.** Você constrói acordo, reduz conflito e faz o time "
                        "funcionar junto. O risco é ceder onde deveria sustentar: aceitar prazo impossível "
                        "e escopo indevido para não desagradar, e pagar sozinho a conta depois.",
            "relacoes": "**Amabilidade nas relações.** Você é fácil de conviver e as pessoas se abrem com "
                        "você. Também pode acumular ressentimento silencioso, porque o que você não disse "
                        "para preservar a paz não desaparece — só fica guardado.",
            "pressao": "**Amabilidade sob pressão.** Você absorve. Aceita mais tarefa, mais cobrança e "
                       "mais desaforo do que deveria, e o limite chega de uma vez, na forma de uma reação "
                       "desproporcional que surpreende até você.",
            "desenvolvimento": "**Por onde começar.** Pratique discordar em assunto pequeno, onde o custo é "
                               "baixo. Discordância é habilidade e treina como qualquer outra — quem só "
                               "tenta na hora grave descobre que não sabe fazer.",
            "sombra": "**Amabilidade é o seu traço mais baixo.** Você fala o que pensa, negocia duro e não "
                      "cede por conveniência — o que é valioso em negociação e em decisão difícil. O custo "
                      "é o desgaste: franqueza sem cuidado faz as pessoas pararem de trazer problema para "
                      "você, e aí você passa a saber das coisas tarde demais.",
        },
        "N": {
            "perfil": "**Instabilidade emocional alta.** Você sente as coisas com intensidade e demora a "
                      "voltar ao normal depois de um baque. Preocupação e autocrítica ocupam bastante "
                      "espaço. Isso também te dá antenas: você percebe risco e desconforto antes dos outros.",
            "trabalho": "**Sob esse traço, no trabalho.** Você antecipa o que pode dar errado e cuida do "
                        "detalhe que ninguém viu. O custo é o desgaste: a mesma sensibilidade que protege "
                        "o resultado consome energia que faria falta na execução.",
            "relacoes": "**Sob esse traço, nas relações.** Você percebe rápido quando algo está errado "
                        "com alguém. Também interpreta silêncio como sinal ruim com mais frequência do "
                        "que o silêncio merece, e confere com a pessoa resolve boa parte disso.",
            "pressao": "**Sob esse traço, sob pressão.** O ruído interno sobe e a leitura da realidade "
                       "distorce: o problema parece maior e mais permanente do que é. Decisão importante "
                       "tomada nesse estado costuma ser revista depois.",
            "desenvolvimento": "**Por onde começar.** Adie decisão grande em dia ruim — nada além disso. "
                               "O mesmo problema, olhado com o corpo descansado, quase sempre muda de "
                               "tamanho, e você economiza as revisões.",
            "sombra": "**Estabilidade emocional é o seu ponto mais forte.** Você não se abala com "
                      "facilidade, encara imprevisto com tranquilidade e esquece rápido de "
                      "desentendimento. É a base de uma resiliência real. O custo é discreto: quem não "
                      "se incomoda com pouco às vezes demora a perceber que um problema está crescendo.",
        },
    },
}


def blocos():
    out = []
    i = 0
    for instrumento, dims in CONTEUDO.items():
        for chave, secoes in dims.items():
            for suf, texto in secoes.items():
                i += 1
                out.append({
                    "section": f"{instrumento}_{suf}",
                    "dimension_key": chave,
                    "title": None,
                    "body": texto,
                    "mode": "natural",
                    "version_id": None,
                    "band_min": None,
                    "band_max": None,
                    "sort_order": i,
                })
    return out


if __name__ == "__main__":
    import sys
    from collections import Counter
    bs = blocos()
    esperadas = {"perfil", "trabalho", "relacoes", "pressao", "desenvolvimento", "sombra"}
    print(f"blocos: {len(bs)}", file=sys.stderr)
    for instr, dims in CONTEUDO.items():
        print(f"  {instr}: {len(dims)} dimensões × {len(esperadas)} seções", file=sys.stderr)
        for chave, secoes in dims.items():
            faltando = esperadas - set(secoes)
            assert not faltando, f"{instr}/{chave} sem: {faltando}"
            sobrando = set(secoes) - esperadas
            assert not sobrando, f"{instr}/{chave} com seção desconhecida: {sobrando}"
    curtos = [(b["section"], b["dimension_key"]) for b in bs if len(b["body"]) < 150]
    assert not curtos, f"bloco raso: {curtos[:3]}"
    print(f"  menor bloco: {min(len(b['body']) for b in bs)} caracteres", file=sys.stderr)
    print(f"  total escrito: {sum(len(b['body']) for b in bs)} caracteres", file=sys.stderr)
    print("ok", file=sys.stderr)
