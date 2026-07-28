"""
VAK reescrito: 24 blocos sobre o que a pessoa FAZ, não sobre como aprende melhor.

O problema do conjunto anterior
-------------------------------
As alternativas diziam a resposta: "Entendo melhor quando vejo um esquema",
"Aprendo mais ouvindo alguém explicar", "Preciso testar na prática". Qualquer
pessoa que já ouviu falar de estilos de aprendizagem escolhe o que acha que é —
o teste confirmava a crença, não media a preferência.

O que muda
----------
- COMPORTAMENTO OBSERVÁVEL no lugar da autoavaliação. "Uma semana depois de
  conhecer alguém, você lembra do rosto / do nome e do jeito de falar / do
  aperto de mão" mede o mesmo sem entregar o jogo.
- SITUAÇÕES FORA DA ESCOLA: dormir, comprar roupa, contar história, lembrar de
  uma viagem. Preferência sensorial não acontece só em sala de aula, e sair do
  contexto escolar tira o piloto automático da resposta.
- 4 pares de checagem e ordem equilibrada: cada canal aparece 8 vezes em cada
  uma das 3 posições.
"""

BLOCOS = [
    ("Você precisa montar um móvel novo.", {
        "V": "Sigo o desenho do manual.",
        "A": "Peço para alguém ir me dizendo o passo a passo.",
        "K": "Vou montando e descobrindo no encaixe.",
    }, None),

    ("Alguém te explica um caminho na rua.", {
        "V": "Preciso ver num mapa depois.",
        "A": "Repito as instruções em voz alta para gravar.",
        "K": "Só pego mesmo depois de fazer o trajeto uma vez.",
    }, None),

    ("Numa palestra longa, o que te mantém acordado:", {
        "V": "Um slide bem feito.",
        "A": "A voz e o jeito de falar de quem apresenta.",
        "K": "Ter alguma coisa para fazer com as mãos.",
    }, None),

    ("Uma semana depois de conhecer uma pessoa, você lembra:", {
        "V": "Do rosto, mas não do nome.",
        "A": "Do nome e do jeito de falar.",
        "K": "Do aperto de mão e da sensação que ela passou.",
    }, "memoria"),

    ("Estudando para uma prova:", {
        "V": "Faço resumo com cor, grifo, esquema.",
        "A": "Leio em voz alta ou explico para alguém.",
        "K": "Ando pela sala enquanto repasso.",
    }, "aprender"),

    ("O que mais te incomoda num ambiente:", {
        "V": "Bagunça visual, coisa fora do lugar.",
        "A": "Barulho de fundo.",
        "K": "Cadeira ruim, temperatura errada.",
    }, "ambiente"),

    ("Comprando uma roupa:", {
        "V": "Vejo se combina e como cai.",
        "A": "Pergunto a opinião de quem está comigo.",
        "K": "Preciso vestir e sentir no corpo.",
    }, None),

    ("Você está explicando uma ideia difícil para alguém.", {
        "V": "Desenho num papel.",
        "A": "Falo até a pessoa entender.",
        "K": "Dou um exemplo prático para ela fazer junto.",
    }, "explicar"),

    ("Uma música de que você gosta muito. O que vem primeiro:", {
        "V": "O clipe, a capa, a cena.",
        "A": "A letra e a melodia.",
        "K": "A vontade de mexer o corpo.",
    }, None),

    ("Quando você está pensando em algo importante:", {
        "V": "Imagino a cena.",
        "A": "Converso comigo mesmo por dentro.",
        "K": "Preciso me mexer, andar.",
    }, None),

    ("Numa reunião on-line:", {
        "V": "Preciso ver a tela compartilhada.",
        "A": "Acompanho bem só ouvindo.",
        "K": "Faço outra coisa com as mãos para me concentrar.",
    }, None),

    ("O que te faz lembrar de uma viagem antiga:", {
        "V": "As fotos.",
        "A": "Uma música daquela época.",
        "K": "Um cheiro ou uma temperatura.",
    }, "memoria"),

    ("Aprendendo um programa novo no computador:", {
        "V": "Assisto a um vídeo mostrando a tela.",
        "A": "Ouço alguém me explicando.",
        "K": "Vou clicando até descobrir.",
    }, "aprender"),

    ("Você se distrai mais fácil com:", {
        "V": "Movimento no canto do olho.",
        "A": "Uma conversa ao fundo.",
        "K": "Desconforto físico.",
    }, None),

    ("Preparando uma apresentação sua, o que você mais cuida:", {
        "V": "Do visual dos slides.",
        "A": "Do que vou falar.",
        "K": "De como vou circular e usar o espaço.",
    }, None),

    ("Anotando o que ficou combinado numa reunião:", {
        "V": "Escrevo em tópicos, com setas e destaques.",
        "A": "Gravo, ou confio no que ouvi.",
        "K": "Escrevo à mão, mesmo sem reler depois.",
    }, None),

    ("Quando você não consegue dormir:", {
        "V": "Fico com imagens passando na cabeça.",
        "A": "Fico com uma conversa se repetindo.",
        "K": "Fico me mexendo, sem achar posição.",
    }, None),

    ("O que mais pesa na sua primeira impressão de um lugar:", {
        "V": "A aparência.",
        "A": "O som do ambiente.",
        "K": "O conforto e o clima.",
    }, "ambiente"),

    ("Uma notícia importante. Você prefere:", {
        "V": "Ler por escrito.",
        "A": "Ouvir de alguém.",
        "K": "Estar presente na hora.",
    }, None),

    ("Decorando um número de telefone:", {
        "V": "Vejo os números na cabeça.",
        "A": "Repito em voz alta.",
        "K": "Digito até a mão decorar.",
    }, None),

    ("Alguém está te explicando e você não entendeu.", {
        "V": "Peço para mostrar.",
        "A": "Peço para explicar de novo, com outras palavras.",
        "K": "Peço para me deixar tentar.",
    }, "explicar"),

    ("O que te ajuda a relaxar:", {
        "V": "Um lugar bonito para olhar.",
        "A": "Música, ou silêncio.",
        "K": "Movimento, banho, comida.",
    }, None),

    ("Numa conversa importante, o que te diz mais sobre a pessoa:", {
        "V": "A expressão do rosto.",
        "A": "O tom de voz.",
        "K": "A postura e a energia do corpo.",
    }, None),

    ("Quando você conta uma história:", {
        "V": "Descrevo como era.",
        "A": "Imito as vozes.",
        "K": "Uso as mãos e o corpo.",
    }, None),
]

DIMS = {
    "V": "ddc3cc9a-0be3-47e0-b67a-c0630eb8b365",
    "A": "44fec620-9c6a-4d45-9566-9e9128b4400f",
    "K": "b7fe98fe-6c7f-4276-9228-f4dc63c3c5ff",
}
VERSION = "fede7d5f-7344-4646-90bb-d4f5a35ec892"
DICA = "Escolha a que MAIS e a que MENOS tem a ver com você."


def ordens():
    """
    24 blocos, 3 canais, 3 posições: 8 aparições de cada canal em cada posição.
    As 6 permutações de VAK, usadas 4 vezes cada, dão exatamente isso.

    Só que há uma segunda exigência, e ela é a que faz o par de checagem
    funcionar: os dois blocos de um par precisam ter ordens DIFERENTES EM TODAS
    AS POSIÇÕES. Se caírem na mesma ordem, quem clica sempre no primeiro item
    escolhe o mesmo canal nos dois e passa pela checagem como se fosse coerente
    — foi o que aconteceu na primeira versão deste embaralhamento.

    As 6 permutações se dividem em dois grupos de rotação; dentro de um grupo,
    duas permutações distintas diferem em todas as posições. Então cada par
    recebe duas permutações distintas do mesmo grupo.
    """
    ROTACAO_A = [("V", "A", "K"), ("A", "K", "V"), ("K", "V", "A")]
    ROTACAO_B = [("V", "K", "A"), ("K", "A", "V"), ("A", "V", "K")]

    pares = {}
    for i, b in enumerate(BLOCOS):
        if b[2]:
            pares.setdefault(b[2], []).append(i)

    saida = [None] * len(BLOCOS)
    usos = {p: 0 for p in ROTACAO_A + ROTACAO_B}
    grupos = [ROTACAO_A, ROTACAO_B]
    for n, (_, idxs) in enumerate(sorted(pares.items())):
        g = grupos[n % 2]
        saida[idxs[0]] = g[n % 3]
        saida[idxs[1]] = g[(n + 1) % 3]
        usos[saida[idxs[0]]] += 1
        usos[saida[idxs[1]]] += 1

    # Os blocos restantes completam 4 usos de cada permutação.
    sobrando = [p for p in ROTACAO_A + ROTACAO_B for _ in range(4 - usos[p])]
    for i in range(len(BLOCOS)):
        if saida[i] is None:
            saida[i] = sobrando.pop(0)
    assert not sobrando
    return saida


def blocos():
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
    for pos in range(3):
        c = Counter(o[pos] for o in ords)
        print(f"  posição {pos + 1}: {dict(sorted(c.items()))}", file=sys.stderr)
        assert set(c.values()) == {8}, f"posição {pos + 1} desequilibrada: {c}"
    pares = Counter(b[2] for b in BLOCOS if b[2])
    print(f"  pares de checagem: {dict(pares)}", file=sys.stderr)
    assert all(v == 2 for v in pares.values())
    pos = {}
    for i, b in enumerate(BLOCOS, start=1):
        if b[2]:
            pos.setdefault(b[2], []).append(i)
    print(f"  distância entre pares: {({k: v[1] - v[0] for k, v in pos.items()})}", file=sys.stderr)
    assert all(v[1] - v[0] >= 8 for v in pos.values())
    # O par só serve se as duas ordens forem diferentes em todas as posições.
    for grupo, (a, b) in pos.items():
        oa, ob = ords[a - 1], ords[b - 1]
        assert all(x != y for x, y in zip(oa, ob)), f"par {grupo} com ordem repetida: {oa} / {ob}"
    print("  pares com ordem trocada em todas as posições: ok", file=sys.stderr)
    for enunciado, alts, _ in BLOCOS:
        assert set(alts) == set(DIMS), f"bloco incompleto: {enunciado}"
    print("ok", file=sys.stderr)
