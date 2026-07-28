"""
Tipos Psicológicos (MBTI) reescrito: 40 perguntas, 10 por eixo.

O que estava errado
-------------------
1. POUCO ITEM. Eram 28 perguntas para 4 eixos: 7 cada. Com 7 itens, uma resposta
   trocada muda a letra do tipo. E o tipo é justamente o que o relatório inteiro
   pendura em cima — "você é ISTJ" a partir de 4 contra 3 é chute com cara de
   diagnóstico.
2. LADO FIXO. A alternativa "extrovertida" vinha quase sempre em primeiro lugar.
   Quem marca a primeira opção sai ESTJ sem ter respondido nada.

O que muda
----------
- 10 ITENS POR EIXO. Com 10, o empate 5 a 5 é possível e passa a ser informação
  honesta ("você fica no meio deste eixo") em vez de ruído arredondado.
- LADO ALTERNADO: em 5 itens de cada eixo o primeiro polo vem primeiro, nos
  outros 5 vem o outro. Verificado por assert.
- SITUAÇÃO em vez de rótulo. Nada de "você é mais lógico ou mais emotivo": a
  pergunta é "um amigo te conta um problema — você ajuda a resolver ou escuta?".
- EIXOS INTERCALADOS, para a pessoa não perceber que estão medindo a mesma
  coisa dez vezes seguidas e começar a responder por coerência aparente.
- 4 PARES DE CHECAGEM, um por eixo.
"""

# (eixo, enunciado, [(polo, texto), (polo, texto)], par_de_checagem)
# A ordem da lista de alternativas É a ordem na tela.
ITENS = [
    # ---------------- E / I ----------------
    ("EI", "Depois de uma semana cheia, o que te recarrega:", [
        ("E", "Sair, ver gente."), ("I", "Ficar em casa, no meu ritmo.")], "energia"),
    ("EI", "Numa festa onde você quase não conhece ninguém:", [
        ("E", "Circulo e vou puxando conversa."), ("I", "Fico perto de quem eu já conheço.")], None),
    ("EI", "Você teve uma ideia boa no trabalho.", [
        ("E", "Falo dela logo, para pensar junto com alguém."), ("I", "Amadureço sozinho antes de apresentar.")], None),
    ("EI", "Um dia inteiro trabalhando sozinho:", [
        ("I", "Rende muito, gosto."), ("E", "Me deixa meio murcho.")], None),
    ("EI", "Ao telefone com alguém de quem você gosta:", [
        ("E", "Podia ficar horas."), ("I", "Resolvo e desligo.")], None),
    ("EI", "Num grupo de mensagens agitado:", [
        ("I", "Leio tudo e quase não escrevo."), ("E", "Participo bastante.")], None),
    ("EI", "Você pensa melhor:", [
        ("E", "Falando com alguém."), ("I", "Sozinho, em silêncio.")], None),
    ("EI", "Um fim de semana bom tem:", [
        ("I", "Poucos compromissos."), ("E", "Gente e movimento.")], None),
    ("EI", "Numa reunião com gente nova:", [
        ("I", "Espero entender a sala antes de falar."), ("E", "Falo cedo.")], None),
    ("EI", "Chegando em casa depois de um dia de muita conversa:", [
        ("I", "Preciso de um tempo em silêncio."), ("E", "Ainda tenho gás para mais.")], "energia"),

    # ---------------- S / N ----------------
    ("SN", "Ao aprender algo novo, você começa por:", [
        ("S", "Exemplos práticos e um passo a passo."), ("N", "A ideia geral e o porquê por trás.")], None),
    ("SN", "Você confia mais:", [
        ("S", "No que já foi testado."), ("N", "No meu pressentimento.")], "confianca"),
    ("SN", "Descrevendo um lugar que visitou:", [
        ("S", "Conto os detalhes: o que tinha, como era."), ("N", "Conto a impressão que me deu.")], None),
    ("SN", "Pensando nos próximos cinco anos:", [
        ("N", "Gosto de imaginar as possibilidades."), ("S", "Quero saber os passos concretos.")], None),
    ("SN", "Diante de um manual de instruções:", [
        ("S", "Leio o que preciso e faço."), ("N", "Pulo trechos e vou pegando a lógica.")], None),
    ("SN", "O que te interessa mais numa conversa:", [
        ("N", "As ideias e as ligações entre elas."), ("S", "Os fatos e o que de fato aconteceu.")], None),
    ("SN", "Você repara mais:", [
        ("S", "No que está diante de você."), ("N", "No que aquilo pode vir a ser.")], None),
    ("SN", "Uma solução nova, que ninguém testou ainda:", [
        ("N", "Me atrai."), ("S", "Me deixa desconfiado.")], None),
    ("SN", "Contando uma história:", [
        ("N", "Vou e volto, conforme a ideia."), ("S", "Sigo a ordem dos fatos.")], None),
    ("SN", "O que te dá mais segurança para decidir:", [
        ("N", "A intuição."), ("S", "A experiência.")], "confianca"),

    # ---------------- T / F ----------------
    ("TF", "Um amigo te conta um problema.", [
        ("T", "Ajudo a achar a solução."), ("F", "Primeiro escuto e acolho.")], "acolher"),
    ("TF", "Uma decisão difícil na equipe. O que pesa mais:", [
        ("F", "O impacto nas pessoas."), ("T", "O que é mais justo pelo critério.")], None),
    ("TF", "Uma crítica dura, mas correta:", [
        ("F", "O jeito de falar me marca mais que o conteúdo."), ("T", "Aceito: o que importa é o conteúdo.")], None),
    ("TF", "Alguém não está entregando e vai precisar sair:", [
        ("T", "Difícil, mas é o que tem de ser feito."), ("F", "Procuro todo caminho possível antes disso.")], None),
    ("TF", "Você se orgulha mais de ser:", [
        ("T", "Justo."), ("F", "Compreensivo.")], None),
    ("TF", "Numa discussão, o que te faz mudar de ideia:", [
        ("T", "Ver que o argumento se sustenta."), ("F", "Ver que a outra pessoa se importa de verdade.")], None),
    ("TF", "Alguém começa a chorar na sua frente.", [
        ("F", "Sinto junto."), ("T", "Já fico pensando em como resolver o que causou.")], None),
    ("TF", "Uma regra da empresa prejudica uma pessoa específica.", [
        ("T", "Regra é regra."), ("F", "Cada caso é um caso.")], None),
    ("TF", "O elogio que mais te toca:", [
        ("F", "“Você é uma pessoa boa.”"), ("T", "“Você é muito competente.”")], None),
    ("TF", "Ao dar um retorno negativo para alguém:", [
        ("F", "Cuido do jeito antes do conteúdo."), ("T", "Vou direto ao ponto.")], "acolher"),

    # ---------------- J / P ----------------
    ("JP", "Uma viagem:", [
        ("J", "Planejo antes."), ("P", "Decido no caminho.")], "planejar"),
    ("JP", "Sua lista de tarefas:", [
        ("P", "Existe mais ou menos."), ("J", "Existe, e eu sigo.")], None),
    ("JP", "Um prazo que ainda está longe:", [
        ("J", "Começo cedo."), ("P", "Começo quando ele chega perto.")], None),
    ("JP", "Mudança de plano em cima da hora:", [
        ("J", "Me incomoda bastante."), ("P", "Tranquilo, me adapto.")], None),
    ("JP", "Você se sente melhor:", [
        ("J", "Com as coisas decididas."), ("P", "Com as opções em aberto.")], None),
    ("JP", "Sua mesa ou sua casa:", [
        ("P", "Tem uma ordem que só eu entendo."), ("J", "Tem um lugar certo para cada coisa.")], None),
    ("JP", "Sábado de manhã:", [
        ("P", "Vejo o que der vontade."), ("J", "Já sei o que vou fazer.")], None),
    ("JP", "Diante de um assunto que já deu para decidir:", [
        ("P", "Prefiro deixar em aberto mais um pouco."), ("J", "Prefiro fechar.")], None),
    ("JP", "Compras do mês:", [
        ("P", "Vendo na hora."), ("J", "Com lista.")], "planejar"),
    ("JP", "Antes de dormir:", [
        ("J", "Reviso o dia seguinte."), ("P", "Deixo para ver amanhã.")], None),
]

DIMS = {
    "E": "c014d6aa-295b-4ef1-98e9-6e6ec4130be8",
    "I": "ade90606-693e-4546-9807-ff8d9a4fce57",
    "S": "e4bec9ac-6016-4d9c-b0c1-47f0f586cf70",
    "N": "7374fdae-3947-42ad-8297-4b5988f901fc",
    "T": "9e6c8582-0d1f-4116-ac28-303f2fdc490b",
    "F": "47db318d-38f6-4f9c-9f0d-cba52950898d",
    "J": "1707edf5-72c8-413e-abb3-cb7cceb91163",
    "P": "1b1096f8-61bf-4dff-a7a4-43c2ee88c004",
}
VERSION = "fda8d1f0-3613-40cf-ac70-cdfb204f03d4"
PRIMEIRO = {"EI": "E", "SN": "S", "TF": "T", "JP": "J"}


def intercalar():
    """
    Espalha os quatro eixos ao longo do teste.

    Dez perguntas seguidas sobre introversão deixam claro o que está sendo
    medido, e a pessoa passa a responder para manter coerência com o que já
    respondeu — não com o que ela é.
    """
    from collections import defaultdict, deque
    porEixo = defaultdict(deque)
    for it in ITENS:
        porEixo[it[0]].append(it)
    ordem = ["EI", "SN", "TF", "JP"]
    saida = []
    while any(porEixo[e] for e in ordem):
        for e in ordem:
            if porEixo[e]:
                saida.append(porEixo[e].popleft())
    return saida


def blocos():
    saida = []
    for i, (_, enunciado, alts, grupo) in enumerate(intercalar(), start=1):
        cfg = {}
        if grupo:
            cfg["check_group"] = grupo
        saida.append({
            "prompt": enunciado,
            "type": "multiple_choice",
            "required": True,
            "config": cfg,
            "opcoes": [{"label": txt, "dim": polo} for polo, txt in alts],
        })
    return saida


if __name__ == "__main__":
    import sys
    from collections import Counter

    print(f"perguntas: {len(ITENS)}", file=sys.stderr)
    porEixo = Counter(i[0] for i in ITENS)
    print(f"  por eixo: {dict(sorted(porEixo.items()))}", file=sys.stderr)
    assert set(porEixo.values()) == {10}, f"eixo desequilibrado: {porEixo}"

    # Em quantos itens de cada eixo o primeiro polo aparece em primeiro lugar.
    primeiro = Counter()
    for eixo, _, alts, _ in ITENS:
        if alts[0][0] == PRIMEIRO[eixo]:
            primeiro[eixo] += 1
    print(f"  polo A em 1º lugar: {dict(sorted(primeiro.items()))}", file=sys.stderr)
    assert all(primeiro[e] == 5 for e in porEixo), f"lado fixo demais: {primeiro}"

    for eixo, enunciado, alts, _ in ITENS:
        assert len(alts) == 2, enunciado
        assert {a[0] for a in alts} == set(eixo), f"polos errados em: {enunciado}"

    pares = Counter(i[3] for i in ITENS if i[3])
    print(f"  pares de checagem: {dict(pares)}", file=sys.stderr)
    assert all(v == 2 for v in pares.values())
    ordenados = intercalar()
    pos = {}
    for i, it in enumerate(ordenados, start=1):
        if it[3]:
            pos.setdefault(it[3], []).append(i)
    print(f"  distância entre pares: {({k: v[1] - v[0] for k, v in pos.items()})}", file=sys.stderr)
    assert all(v[1] - v[0] >= 8 for v in pos.values()), f"par colado demais: {pos}"
    # Os dois itens de um par precisam ter polos OPOSTOS em primeiro lugar. Se
    # os dois começarem pelo mesmo polo, quem marca sempre a primeira alternativa
    # responde igual nos dois e passa pela checagem como se fosse coerente.
    for grupo, (a, b) in pos.items():
        pa, pb = ordenados[a - 1][2][0][0], ordenados[b - 1][2][0][0]
        assert pa != pb, f"par {grupo} começa pelo mesmo polo ({pa}) nos dois itens"
    print("  pares começam por polos opostos: ok", file=sys.stderr)
    print("ok", file=sys.stderr)
