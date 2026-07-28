"""
DISC reescrito: 28 blocos situacionais, com alternativas de peso social parecido.

O problema do conjunto anterior
-------------------------------
1. As alternativas se entregavam. Em todo bloco, a opção D era a que soava
   "de líder" ("Decido rápido e assumo o comando") e a opção S soava passiva.
   Quem quer causar boa impressão escolhe D e I sempre — e o teste vira um
   medidor de vaidade, não de perfil.
2. Pior: nos 24 blocos a ordem era SEMPRE D, I, S, C. Quem clicasse na primeira
   alternativa de cada bloco saía com perfil D puro, e o relatório o descrevia
   como um executivo nato. Isso é um defeito de montagem, não de conteúdo.
3. O enunciado era "Bloco 1 de 24" — nenhum contexto. A pessoa respondia sobre
   quem ela acha que é, não sobre o que ela faz.

O que muda
----------
- SITUAÇÃO no enunciado. "O prazo apertou e a decisão precisa sair hoje" põe a
  pessoa num lugar concreto. Autoimagem responde bonito; situação responde real.
- CUSTO EM TODA ALTERNATIVA. "Eu decido e assumo o risco de estar errado" tem
  ganho e preço, igual a "Eu peço mais dados, mesmo que atrase". Quando as
  quatro custam alguma coisa, escolher deixa de ser vitrine.
- BLOCOS DE FRAQUEZA. Quatro blocos onde as quatro alternativas são defeitos
  ("a crítica que você já ouviu"). É onde aparece o dado mais honesto do teste.
- ORDEM EMBARALHADA por quadrado latino: cada dimensão cai exatamente 7 vezes
  em cada uma das 4 posições. Posição deixa de significar dimensão.
- PARES DE CHECAGEM: 5 duplas que descrevem a mesma coisa com outras palavras,
  afastadas no questionário. Se a pessoa se contradiz nelas, o relatório avisa.
"""

# (enunciado, {dimensão: alternativa}, par_de_checagem)
from embaralhar import corrigir_pares, indices_dos_pares  # noqa: E402

BLOCOS = [
    ("O prazo apertou e a decisão precisa sair hoje.", {
        "D": "Decido e assumo o risco de estar errado.",
        "I": "Defendo a saída que me empolga e trago o grupo junto.",
        "S": "Fico com a opção que causa menos ruptura para a equipe.",
        "C": "Peço mais dados antes de fechar, mesmo que atrase.",
    }, "decisao"),

    ("Alguém entrega um trabalho abaixo do que foi combinado.", {
        "D": "Digo na hora que não serve e peço para refazer.",
        "I": "Puxo uma conversa leve e tento reanimar a pessoa.",
        "S": "Deixo passar dessa vez e ofereço ajuda.",
        "C": "Aponto item por item o que ficou fora do padrão.",
    }, "cobranca"),

    ("Você entra numa sala onde não conhece ninguém.", {
        "D": "Vou direto a quem parece decidir as coisas.",
        "I": "Puxo conversa com quem estiver mais perto.",
        "S": "Espero alguém me incluir e vou me soltando aos poucos.",
        "C": "Observo primeiro para entender como funciona ali.",
    }, None),

    ("O que mais te incomoda no dia a dia de trabalho:", {
        "D": "Reunião longa que não chega a lugar nenhum.",
        "I": "Ambiente calado, sem troca entre as pessoas.",
        "S": "Mudança de rumo em cima da hora.",
        "C": "Gente que decide no achismo.",
    }, None),

    ("Numa negociação difícil, o seu instinto é:", {
        "D": "Marcar posição logo no começo.",
        "I": "Quebrar o gelo e criar clima antes de falar de números.",
        "S": "Ouvir bastante antes de me posicionar.",
        "C": "Chegar com tudo levantado e deixar os dados falarem.",
    }, "conflito"),

    ("O plano muda no meio do caminho.", {
        "D": "Assumo o rumo novo e toco.",
        "I": "Vou junto na empolgação do que vem.",
        "S": "Custo a largar o jeito antigo.",
        "C": "Quero entender o porquê antes de mudar.",
    }, None),

    ("A crítica que você já ouviu sobre si:", {
        "D": "Que passo por cima dos outros quando quero resultado.",
        "I": "Que falo demais e prometo o que nem sempre dá para cumprir.",
        "S": "Que demoro a me posicionar e fujo do embate.",
        "C": "Que trava tudo no detalhe e é difícil me agradar.",
    }, None),

    ("Como você prefere que te cobrem:", {
        "D": "Direto ao ponto, sem rodeio.",
        "I": "Numa conversa, olho no olho.",
        "S": "Com tempo e sem susto.",
        "C": "Com o critério claro do que é certo e do que não é.",
    }, None),

    ("O reconhecimento que mais faz sentido para você:", {
        "D": "Ser reconhecido pelo resultado que entreguei.",
        "I": "Ser lembrado como quem anima o time.",
        "S": "Ser reconhecido por quem sempre pode contar comigo.",
        "C": "Ser reconhecido pela qualidade do que faço.",
    }, "imagem"),

    ("Numa reunião em que ninguém se entende:", {
        "D": "Corto a discussão e proponho o encaminhamento.",
        "I": "Uso o humor e o clima para destravar.",
        "S": "Procuro o ponto em comum entre os lados.",
        "C": "Trago o dado que encerra a discussão.",
    }, None),

    ("Você recebe uma tarefa nova, sem instrução nenhuma.", {
        "D": "Começo do meu jeito e ajusto no caminho.",
        "I": "Chamo alguém para pensar junto.",
        "S": "Pergunto a quem já fez, para não errar.",
        "C": "Procuro um modelo ou um padrão antes de começar.",
    }, "destravar"),

    ("Sobre prazos e combinados:", {
        "D": "Corto escopo para entregar no prazo.",
        "I": "Puxo gente para ajudar e viro a noite se precisar.",
        "S": "Aviso com antecedência e renegocio.",
        "C": "Prefiro atrasar a entregar com falha.",
    }, None),

    ("O tipo de chefe com quem você trabalha melhor:", {
        "D": "Que dá autonomia e cobra resultado.",
        "I": "Que é aberto e conversa fácil.",
        "S": "Que dá segurança e não muda o rumo toda hora.",
        "C": "Que explica o critério das decisões.",
    }, None),

    ("Alguém discorda de você numa reunião cheia.", {
        "D": "Rebato ali mesmo.",
        "I": "Levo na leveza para não esfriar a sala.",
        "S": "Deixo passar e converso depois em particular.",
        "C": "Peço o argumento e comparo com o que eu tenho.",
    }, "conflito"),

    ("Do que você tem mais receio no trabalho:", {
        "D": "De perder o controle da situação.",
        "I": "De ser ignorado ou deixado de fora.",
        "S": "De um conflito aberto com alguém do time.",
        "C": "De entregar alguma coisa com erro.",
    }, None),

    ("Como você toma uma decisão importante:", {
        "D": "Bato o martelo rápido e sigo.",
        "I": "Vou pelo que me entusiasma e converso enquanto decido.",
        "S": "Consulto quem vai ser afetado.",
        "C": "Levanto tudo o que der e comparo.",
    }, "decisao"),

    ("Numa apresentação para muita gente:", {
        "D": "Vou direto ao ponto principal.",
        "I": "Me solto e improviso.",
        "S": "Prefiro que outra pessoa apresente.",
        "C": "Ensaio antes e sigo o roteiro.",
    }, None),

    ("O que costuma te fazer perder a paciência:", {
        "D": "Lentidão para decidir.",
        "I": "Gente fechada, que não se abre.",
        "S": "Pressão e clima tenso.",
        "C": "Trabalho malfeito.",
    }, None),

    ("O time está desanimado.", {
        "D": "Redefino a meta e puxo o time.",
        "I": "Levanto o astral e chamo para cima.",
        "S": "Ouço um a um para entender o que houve.",
        "C": "Mostro onde está o problema e o caminho de saída.",
    }, None),

    ("Você discorda de uma decisão que o grupo já tomou.", {
        "D": "Falo que discordo e proponho outra coisa.",
        "I": "Converso nos bastidores para sentir quem pensa igual.",
        "S": "Sigo junto para não dividir o time.",
        "C": "Registro minha ressalva e cumpro.",
    }, None),

    ("Você prefere ser visto como:", {
        "D": "Alguém firme.",
        "I": "Alguém empolgante.",
        "S": "Alguém confiável.",
        "C": "Alguém correto.",
    }, "imagem"),

    ("No fim de um projeto puxado, o que te deixa satisfeito:", {
        "D": "Ter batido a meta.",
        "I": "Ter sido uma boa experiência para todo mundo.",
        "S": "Ter mantido o time inteiro até o fim.",
        "C": "Ter feito certo.",
    }, None),

    ("Quando você precisa cobrar alguém:", {
        "D": "Cobro direto, assim que percebo.",
        "I": "Faço da conversa algo leve.",
        "S": "Adio até não dar mais.",
        "C": "Mostro o que foi combinado, por escrito.",
    }, "cobranca"),

    ("Uma regra da empresa está atrapalhando o resultado.", {
        "D": "Passo por cima e resolvo.",
        "I": "Falo com quem pode abrir uma exceção.",
        "S": "Sigo a regra para não criar problema.",
        "C": "Sigo a regra e proponho mudá-la.",
    }, None),

    ("Como você lida com risco:", {
        "D": "Aceito o risco quando o ganho é grande.",
        "I": "Vou pelo entusiasmo e aposto.",
        "S": "Prefiro o caminho seguro.",
        "C": "Só avanço com o risco medido.",
    }, None),

    ("Uma mudança grande é anunciada. Sua primeira pergunta:", {
        "D": "O que eu preciso fazer, e até quando?",
        "I": "Quem vai comigo nessa?",
        "S": "O que muda para quem já estava aqui?",
        "C": "Qual foi o critério para decidir isso?",
    }, None),

    ("Você travou num problema.", {
        "D": "Tento outra saída e forço até sair.",
        "I": "Falo com alguém para destravar.",
        "S": "Deixo descansar e volto depois.",
        "C": "Volto ao começo e refaço passo a passo.",
    }, "destravar"),

    ("Se tivesse que abrir mão de uma coisa no trabalho:", {
        "D": "Abriria mão do controle.",
        "I": "Abriria mão do convívio.",
        "S": "Abriria mão da estabilidade.",
        "C": "Abriria mão do capricho.",
    }, None),
]

DIMS = {
    "D": "d9cc9210-0a11-4491-952c-4fdffa8045b2",
    "I": "8171b75f-46f4-403d-9a8a-e9f6bb89172d",
    "S": "3194da7d-4885-4773-a338-999a5cea2c6e",
    "C": "b6b37f04-3bdf-48b5-aee6-be0fcec5bb5d",
}
VERSION = "507bdcc1-c22e-40ae-a507-a45a38a9ebaa"
DICA = "Escolha a que MAIS e a que MENOS tem a ver com você."


def ordens():
    """
    Uma ordem de exibição para cada bloco, com equilíbrio exato de posição.

    São 28 blocos e 4 posições: cada dimensão precisa cair 7 vezes em cada
    posição. As 24 permutações possíveis de DISC já dão 6 vezes cada; um
    quadrado latino de 4 linhas fecha a sétima. O passo 7 no meio é só para
    não sair uma sequência óbvia para quem estiver respondendo.
    """
    from itertools import permutations
    todas = list(permutations("DISC"))
    espalhadas = [todas[(i * 7) % 24] for i in range(24)]
    assert len(set(espalhadas)) == 24, "o passo precisa percorrer as 24"
    quadrado = [("D", "I", "S", "C"), ("I", "S", "C", "D"), ("S", "C", "D", "I"), ("C", "D", "I", "S")]
    # Intercala o quadrado no meio, para o fim do teste não ficar padronizado.
    saida = espalhadas[:12] + quadrado[:2] + espalhadas[12:22] + quadrado[2:] + espalhadas[22:]
    return corrigir_pares(saida[: len(BLOCOS)], indices_dos_pares(BLOCOS))


def blocos():
    """Formato que scripts/aplicar_conteudo.py entende."""
    saida = []
    for (enunciado, alts, grupo), ordem in zip(BLOCOS, ordens()):
        cfg = {"hint": DICA}
        if grupo:
            cfg["check_group"] = grupo
        saida.append({
            "prompt": enunciado,
            "type": "forced_choice",
            "required": True,
            "config": cfg,
            "opcoes": [{"label": alts[d], "dim": d} for d in ordem],
        })
    return saida


if __name__ == "__main__":
    import sys
    from collections import Counter

    ords = ordens()
    print(f"blocos: {len(BLOCOS)}", file=sys.stderr)
    for pos in range(4):
        c = Counter(o[pos] for o in ords)
        print(f"  posição {pos + 1}: {dict(sorted(c.items()))}", file=sys.stderr)
        assert set(c.values()) == {7}, f"posição {pos + 1} desequilibrada: {c}"
    pares = Counter(b[2] for b in BLOCOS if b[2])
    print(f"  pares de checagem: {dict(pares)}", file=sys.stderr)
    assert all(v == 2 for v in pares.values()), "todo par precisa ter exatamente 2 blocos"
    posn = {}
    for i, b in enumerate(BLOCOS):
        if b[2]:
            posn.setdefault(b[2], []).append(i + 1)
    print(f"  distância entre pares: {({k: v[1] - v[0] for k, v in posn.items()})}", file=sys.stderr)
    assert all(v[1] - v[0] >= 8 for v in posn.values()), "par colado demais é óbvio"
    # A ordem precisa mudar entre os dois blocos do par: se caírem iguais, quem
    # clica sempre na mesma posição escolhe o mesmo dos dois lados e escapa da
    # checagem — foi o que aconteceu no VAK antes desta verificação existir.
    for grupo, (a, b) in posn.items():
        assert ords[a - 1][0] != ords[b - 1][0], f"par {grupo} começa igual nos dois blocos"
    print("  pares com primeira alternativa trocada: ok", file=sys.stderr)
    for enunciado, alts, _ in BLOCOS:
        assert set(alts) == {"D", "I", "S", "C"}, f"bloco incompleto: {enunciado}"
