"""
Texto do relatório de Tipos Psicológicos.

Por que este arquivo existe
---------------------------
O MBTI tinha ZERO bloco de relatório. A pessoa respondia 40 perguntas e recebia
quatro barras coloridas, sem uma linha de leitura. Era o teste com a maior
distância entre o que pede do respondente e o que devolve.

Como foi montado
----------------
A narrativa sai dos EIXOS, não do rótulo de quatro letras. São quatro
preferências medidas de forma independente; "ENFJ" é só o apelido do conjunto.
Escrever 16 descrições de tipo daria a impressão de que existem 16 pessoas no
mundo — e faria o relatório afirmar coisas sobre um eixo que ficou 52% a 48%.

Então: uma síntese curta por tipo (16 blocos, é o que a pessoa espera ver) e o
corpo do relatório eixo a eixo (8 polos × 4 seções = 32 blocos). Quando um eixo
fica abaixo de 55%, o motor omite aquele polo das seções e diz por quê.

Todo texto é original. As metodologias são de domínio público; os textos de
relatórios comerciais não são.
"""

# ------------------------------------------------------------------ eixos ----
# polo -> {seção: texto}
POLOS = {
    "E": {
        "eixo":
            "**Extroversão (E).** Você se orienta para fora. Pensa falando, resolve conversando, e "
            "costuma descobrir o que acha de um assunto no meio da frase. Ambiente com gente e "
            "movimento te abastece; tempo demais sozinho vai tirando o seu gás.",
        "trabalho":
            "**Extroversão no trabalho.** Você rende em times, reuniões e conversas de corredor. "
            "Tende a responder rápido e a ocupar espaço na discussão. O risco é decidir no calor da "
            "conversa e não deixar silêncio suficiente para os mais reservados aparecerem.",
        "relacoes":
            "**Extroversão nas relações.** Você aproxima com facilidade e mantém uma rede ampla. "
            "As pessoas sabem o que você está pensando, porque você fala. Quem é mais fechado pode "
            "levar um tempo para acompanhar o seu ritmo de aproximação.",
        "atencao":
            "**Ponto cego da Extroversão.** Falar antes de pensar. Como o pensamento acontece em voz "
            "alta, o que era rascunho pode ser ouvido como decisão. Vale marcar explicitamente: "
            "“estou pensando alto, ainda não decidi”.",
    },
    "I": {
        "eixo":
            "**Introversão (I).** Você se orienta para dentro. Processa antes de falar, e o que sai "
            "já vem trabalhado. Precisa de um tempo sozinho para recuperar energia, e isso não é "
            "timidez nem falta de interesse — é como o seu sistema recarrega.",
        "trabalho":
            "**Introversão no trabalho.** Você entrega bem em tarefas que exigem concentração "
            "contínua e costuma trazer contribuições mais maduras. Em reunião, pode perder espaço "
            "para quem fala primeiro — pedir a pauta antes muda bastante o seu rendimento.",
        "relacoes":
            "**Introversão nas relações.** Você tem poucos vínculos e profundos. Investe onde há "
            "reciprocidade e evita o convívio de superfície. Quem convive com você precisa aprender "
            "que silêncio, aí, não é sinal de problema.",
        "atencao":
            "**Ponto cego da Introversão.** Guardar demais. Como você resolve por dentro, os outros "
            "às vezes só descobrem a sua posição quando ela já virou decisão — e se sentem passados "
            "para trás sem que essa fosse a intenção.",
    },
    "S": {
        "eixo":
            "**Sensação (S).** Você confia no concreto: no que dá para ver, medir e conferir. "
            "Repara em detalhes que passam batido e prefere partir do que já funcionou a apostar "
            "numa teoria bonita.",
        "trabalho":
            "**Sensação no trabalho.** Você é bom em execução, em processo e em pegar o erro antes "
            "que ele chegue ao cliente. Pede exemplo e passo a passo, e com razão. O risco é o "
            "excesso de apego ao “sempre foi assim” quando o contexto já mudou.",
        "relacoes":
            "**Sensação nas relações.** Você demonstra cuidado por atos concretos: lembra de datas, "
            "resolve o que precisa ser resolvido, aparece quando tem que aparecer. Palavras soltas "
            "sem gesto correspondente soam vazias para você.",
        "atencao":
            "**Ponto cego da Sensação.** Descartar cedo demais o que ainda não tem prova. Nem toda "
            "ideia sem dados é fantasia; algumas só ainda não tiveram chance. Vale separar “não "
            "funciona” de “ainda não testei”.",
    },
    "N": {
        "eixo":
            "**Intuição (N).** Você lê padrões e possibilidades. Enxerga aonde as coisas podem "
            "chegar antes de conseguir explicar por quê, e se interessa mais pelo desenho geral do "
            "que pelo detalhe da execução.",
        "trabalho":
            "**Intuição no trabalho.** Você é forte em começo de coisa: enxergar o problema por um "
            "ângulo novo, propor caminho, conectar assuntos que pareciam separados. O risco é "
            "abandonar na metade, quando a novidade acaba e sobra o operacional.",
        "relacoes":
            "**Intuição nas relações.** Você percebe o que não foi dito e costuma acertar no "
            "pressentimento sobre pessoas. Também pode preencher lacunas com interpretação própria "
            "e reagir a uma intenção que ninguém teve.",
        "atencao":
            "**Ponto cego da Intuição.** Pular o concreto. Uma boa ideia sem os passos, os prazos e "
            "os números não sai do lugar — e a frustração que vem disso costuma ser atribuída aos "
            "outros, não à falta de aterrissagem.",
    },
    "T": {
        "eixo":
            "**Pensamento (T).** Você decide por critério. Busca o que é coerente, justo e "
            "sustentável no argumento, mesmo quando a conclusão é desconfortável. Franqueza, para "
            "você, é uma forma de respeito.",
        "trabalho":
            "**Pensamento no trabalho.** Você segura conversas difíceis e decisões impopulares sem "
            "adoçar. É quem consegue apontar a falha no plano de que todo mundo gostou. O risco é "
            "tratar o efeito humano da decisão como assunto de outra pessoa.",
        "relacoes":
            "**Pensamento nas relações.** Você ajuda resolvendo: quando alguém traz um problema, "
            "sua reação natural é procurar a saída. Nem sempre é isso que a pessoa foi buscar, e "
            "perguntar “você quer ajuda ou quer desabafar?” resolve boa parte dos mal-entendidos.",
        "atencao":
            "**Ponto cego do Pensamento.** Confundir estar certo com estar bem resolvido. Uma "
            "decisão tecnicamente correta que ninguém aceita não foi implementada — e o custo disso "
            "é real, mesmo não aparecendo na planilha.",
    },
    "F": {
        "eixo":
            "**Sentimento (F).** Você decide por valor e por impacto nas pessoas. Pesa quem será "
            "afetado, o que é coerente com o que você acredita, e como a decisão vai ser recebida. "
            "Harmonia, para você, faz parte do resultado.",
        "trabalho":
            "**Sentimento no trabalho.** Você percebe o clima antes dos outros e segura o time nos "
            "momentos ruins. É quem lembra que por trás do número tem gente. O risco é adiar a "
            "conversa dura até ela virar um problema maior do que era.",
        "relacoes":
            "**Sentimento nas relações.** Você acolhe bem e cria segurança em quem está por perto. "
            "Também absorve o estado emocional do ambiente, e pode sair de um dia difícil carregando "
            "o que era dos outros.",
        "atencao":
            "**Ponto cego do Sentimento.** Ceder para preservar a paz e cobrar depois, por dentro. "
            "O acordo que você não quis fazer mas fez para não criar atrito costuma voltar como "
            "ressentimento — e aí a conversa fica bem mais difícil do que seria no começo.",
    },
    "J": {
        "eixo":
            "**Julgamento (J).** Você se organiza fechando. Gosta de decidir, planejar e riscar da "
            "lista. Assunto em aberto ocupa espaço na sua cabeça até ser resolvido, então você "
            "tende a resolver cedo.",
        "trabalho":
            "**Julgamento no trabalho.** Você entrega no prazo e costuma entregar antes. Estrutura, "
            "cronograma e definição são o seu terreno. O risco é fechar cedo demais, antes de a "
            "informação necessária existir, só para tirar o assunto da mesa.",
        "relacoes":
            "**Julgamento nas relações.** As pessoas sabem o que esperar de você, e isso vale muito. "
            "Combinado é combinado. Quem tem um jeito mais solto de viver pode sentir a sua "
            "organização como cobrança, mesmo quando não é.",
        "atencao":
            "**Ponto cego do Julgamento.** Tratar mudança de plano como falha de caráter. Às vezes o "
            "cenário mudou e o plano é que precisa mudar. Perguntar “o que mudou?” antes de "
            "“por que não cumpriram?” evita muito desgaste.",
    },
    "P": {
        "eixo":
            "**Percepção (P).** Você se organiza mantendo aberto. Gosta de reunir informação, testar "
            "e decidir o mais tarde possível, porque fechar cedo parece desperdiçar opção. "
            "Improviso não te assusta.",
        "trabalho":
            "**Percepção no trabalho.** Você lida bem com imprevisto, cenário mutável e problema "
            "sem manual. Rende no fim, quando a pressão aperta. O risco é acumular pendência e "
            "transformar em rotina o que deveria ser exceção.",
        "relacoes":
            "**Percepção nas relações.** Você é fácil de conviver, aceita o que aparece e não "
            "engessa o outro. Quem depende de previsibilidade, no entanto, pode ler a sua "
            "flexibilidade como descompromisso.",
        "atencao":
            "**Ponto cego da Percepção.** Adiar a decisão até ela ser tomada pelo prazo. Não decidir "
            "também é uma escolha — só que feita sem você, e normalmente pior do que a que você "
            "teria feito com uma semana de antecedência.",
    },
}

# ------------------------------------------------------------------ tipos ----
# Síntese curta por tipo. É o que a pessoa espera ver; o corpo do relatório
# vem dos eixos acima, que é onde está a medição de verdade.
TIPOS = {
    "ISTJ": "Você é a pessoa em quem se confia o que não pode falhar. Combina atenção ao concreto com "
            "senso de dever: o que você assume, sai — e sai conferido. Prefere método a improviso e "
            "resultado comprovado a promessa. O desafio é abrir espaço para o jeito novo antes de ter "
            "certeza de que ele funciona.",
    "ISFJ": "Você cuida sem alarde. Repara no que os outros precisam antes de pedirem e sustenta a "
            "rotina que mantém tudo de pé, normalmente sem receber crédito por isso. Sua lealdade é "
            "longa. O desafio é dizer não e pedir o que você precisa, em vez de esperar que percebam.",
    "INFJ": "Você junta sensibilidade com direção. Enxerga o que move as pessoas e costuma ter uma "
            "ideia clara de onde tudo aquilo deveria chegar. Trabalha melhor com propósito à vista. O "
            "desafio é não se cobrar por um ideal que ninguém além de você combinou de perseguir.",
    "INTJ": "Você pensa em sistema e a longo prazo. Vê o problema inteiro, monta a estratégia e a "
            "executa com independência. Autonomia, para você, não é conforto: é condição. O desafio é "
            "levar as pessoas junto, porque uma boa estratégia sem adesão não acontece.",
    "ISTP": "Você entende as coisas mexendo nelas. Mantém a calma no problema técnico e no aperto, e "
            "resolve com economia de movimento. Discurso longo te cansa. O desafio é comunicar o que "
            "você está fazendo — muita gente só descobre depois de pronto.",
    "ISFP": "Você vive pelo que sente ser certo, com discrição. Tem sensibilidade estética e prática, "
            "e prefere mostrar por gesto a defender por argumento. O desafio é se posicionar quando "
            "algo importante para você está em jogo, em vez de sair de cena.",
    "INFP": "Você é movido por coerência interna. Tem um senso forte do que importa e uma capacidade "
            "rara de enxergar o potencial das pessoas. O desafio é a distância entre o ideal e o "
            "possível: ela cobra caro quando você a transforma em cobrança contra si mesmo.",
    "INTP": "Você quer entender antes de agir. Desmonta o problema, encontra a inconsistência que "
            "ninguém viu e reconstrói por conta própria. O desafio é fechar: em algum momento a "
            "análise precisa virar decisão, mesmo faltando peça.",
    "ESTP": "Você lê a situação rápido e age. É quem resolve na hora, negocia bem e não trava diante "
            "do imprevisto. Energia não falta. O desafio é a consequência de médio prazo — a saída "
            "rápida de hoje às vezes é o problema de daqui a três meses.",
    "ESFP": "Você traz vida para onde chega. Presente, caloroso e prático, resolve pelo contato "
            "direto e faz as pessoas se sentirem à vontade. O desafio é o que não dá retorno imediato: "
            "planejamento e tarefa chata pedem uma disciplina que não vem por empolgação.",
    "ENFP": "Você enxerga possibilidade em tudo e contagia. Conecta pessoas e ideias com facilidade e "
            "abre caminhos que ninguém tinha visto. O desafio é a continuidade: começar é fácil para "
            "você, terminar exige um combinado com você mesmo.",
    "ENTP": "Você pensa questionando. Encontra a brecha do argumento, propõe o ângulo que ninguém "
            "considerou e gosta do desafio intelectual pelo desafio. O desafio é escolher: nem toda "
            "boa ideia merece ser perseguida, e dispersão custa mais do que parece.",
    "ESTJ": "Você organiza e faz acontecer. Define o que precisa ser feito, por quem e até quando, e "
            "cobra o cumprimento. Estrutura, para você, é o que permite escala. O desafio é o caso "
            "particular que não cabe na regra — e que às vezes é o mais importante.",
    "ESFJ": "Você mantém as pessoas juntas. Percebe as necessidades do grupo, cuida do combinado e do "
            "clima, e cria o ambiente onde os outros produzem. O desafio é separar a sua responsabilidade "
            "da dos outros: você não precisa carregar tudo para o time funcionar.",
    "ENFJ": "Você desenvolve gente. Enxerga o potencial de cada um, comunica com clareza e mobiliza em "
            "torno de um objetivo comum. Liderança, para você, é sobre pessoas. O desafio é lembrar de "
            "si: cuidar de todo mundo tem um custo que você costuma pagar calado.",
    "ENTJ": "Você conduz. Define o rumo, organiza os recursos e assume a responsabilidade pelo "
            "resultado, inclusive quando dá errado. Decisão difícil não te paralisa. O desafio é o "
            "ritmo — o seu é mais rápido que o da maioria, e nem todo mundo consegue acompanhar.",
}

VERSION_ID = None  # global: vale para qualquer versão do instrumento


def blocos():
    """Linhas prontas para a tabela report_content."""
    out = []
    for tipo, texto in TIPOS.items():
        out.append({"section": "mbti_sintese", "dimension_key": tipo,
                    "title": f"Seu tipo: {tipo}", "body": texto})
    for polo, secoes in POLOS.items():
        for suf, texto in secoes.items():
            out.append({"section": f"mbti_{suf}", "dimension_key": polo, "title": None, "body": texto})
    return out


if __name__ == "__main__":
    import sys
    from collections import Counter
    bs = blocos()
    print(f"blocos: {len(bs)}", file=sys.stderr)
    print("  por seção:", dict(sorted(Counter(b["section"] for b in bs).items())), file=sys.stderr)
    assert len(TIPOS) == 16, "faltou tipo"
    assert set(POLOS) == set("EISNTFJP"), f"faltou polo: {set('EISNTFJP') - set(POLOS)}"
    for polo, s in POLOS.items():
        assert set(s) == {"eixo", "trabalho", "relacoes", "atencao"}, f"{polo} incompleto"
    curtos = [b for b in bs if len(b["body"]) < 120]
    assert not curtos, f"bloco raso: {curtos[:1]}"
    print("  menor bloco:", min(len(b["body"]) for b in bs), "caracteres", file=sys.stderr)
    print("ok", file=sys.stderr)
