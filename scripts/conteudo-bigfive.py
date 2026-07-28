"""
Big Five reescrito: 50 itens, 10 por traço, exatamente metade invertidos.

O equilíbrio exato importa: com 5 invertidos em 10, quem concorda com tudo cai
em 50/100 no traço — nem alto nem baixo. Com 4 em 9, sobra viés.

Princípios aplicados:
- SITUAÇÃO em vez de autoimagem. "Sou organizado" mede como a pessoa gosta de
  se ver; "Quando o prazo aperta, a primeira coisa que sacrifico é a organização"
  mede o que ela faz.
- METADE INVERTIDA por traço. Sem isso, quem concorda com tudo sai alto em tudo.
- PARES DE CHECAGEM (`check_group`): duas frases equivalentes, uma invertida,
  espalhadas longe uma da outra. Se a pessoa discorda de si mesma, o relatório avisa.
- Sem jargão e sem termo que denuncie o traço medido.
"""

# (dimensão, texto, invertida?, grupo_de_checagem)
ITENS = [
    # ---------------- ABERTURA (O) — 10 itens, 5 invertidos ----------------
    ("O", "Quando encontro um assunto que não conheço, vou atrás por conta própria.", False, None),
    ("O", "Prefiro repetir o que já deu certo a experimentar um jeito novo.", True, "O_novo"),
    ("O", "Gosto de conversas que fogem do óbvio, mesmo sem chegar a uma conclusão.", False, None),
    ("O", "Filme, livro ou música fora do meu estilo costumam me cansar.", True, None),
    ("O", "Me pego imaginando como as coisas poderiam ser diferentes do que são.", False, None),
    ("O", "Ideias abstratas me interessam pouco: prefiro o que é prático.", True, None),
    ("O", "Mudar a forma de fazer algo que já funciona me parece perda de tempo.", True, "O_novo"),
    ("O", "Tenho curiosidade por como pensam pessoas muito diferentes de mim.", False, None),
    ("O", "Quando viajo, prefiro roteiro conhecido a descobrir no caminho.", True, None),
    ("O", "Costumo notar detalhes de arte, design ou paisagem que passam batido.", False, None),

    # ---------------- CONSCIENCIOSIDADE (C) — 10 itens, 5 invertidos ----------------
    ("C", "Termino o que começo, mesmo quando a empolgação inicial passa.", False, "C_termina"),
    ("C", "Costumo deixar para a última hora e correr no fim.", True, "C_prazo"),
    ("C", "Antes de começar, separo o que precisa ser feito e em que ordem.", False, None),
    ("C", "Minha mesa, minha bolsa ou meus arquivos vivem bagunçados.", True, None),
    ("C", "Quando assumo um prazo, me organizo para entregar antes do limite.", False, "C_prazo"),
    ("C", "Tenho vários projetos parados pela metade.", True, "C_termina"),
    ("C", "Confiro o trabalho antes de entregar, mesmo achando que está certo.", False, None),
    ("C", "Combinados pequenos, do tipo 'te mando depois', costumam me escapar.", True, None),
    ("C", "Sigo o que planejei mesmo quando aparece algo mais interessante.", False, None),
    ("C", "Perco tempo com distrações quando deveria estar produzindo.", True, None),

    # ---------------- EXTROVERSÃO (E) — 10 itens, 5 invertidos ----------------
    ("E", "Depois de uma tarde com muita gente, saio com mais energia do que entrei.", False, "E_energia"),
    ("E", "Num grupo novo, espero alguém puxar assunto comigo.", True, "E_inicia"),
    ("E", "Costumo ser eu quem chama as pessoas para sair ou marcar algo.", False, None),
    ("E", "Prefiro um fim de semana quieto em casa a um cheio de compromissos.", True, None),
    ("E", "Numa reunião, falo cedo em vez de esperar a hora certa.", False, None),
    ("E", "Eventos com muita gente me deixam cansado antes do fim.", True, "E_energia"),
    ("E", "Me sinto à vontade sendo o centro das atenções.", False, None),
    ("E", "Prefiro escrever a ligar quando preciso resolver algo.", True, None),
    ("E", "Puxo conversa com desconhecidos sem esforço.", False, "E_inicia"),
    ("E", "Em grupo grande, falo pouco e observo mais.", True, None),

    # ---------------- AMABILIDADE (A) — 10 itens, 5 invertidos ----------------
    ("A", "Procuro entender o lado do outro antes de defender o meu.", False, "A_escuta"),
    ("A", "Quando discordo, digo na hora, sem medir muito as palavras.", True, None),
    ("A", "Abro mão do que eu queria para não criar atrito.", False, None),
    ("A", "Acho que a maioria das pessoas leva vantagem quando pode.", True, "A_confia"),
    ("A", "Me disponho a ajudar mesmo quando não sobra muito tempo.", False, None),
    ("A", "Numa discussão, meu foco é ganhar o argumento.", True, "A_escuta"),
    ("A", "Costumo dar o benefício da dúvida antes de julgar.", False, "A_confia"),
    ("A", "Tenho pouca paciência com quem é lento para entender.", True, None),
    ("A", "Percebo quando alguém está mal, mesmo sem a pessoa falar.", False, None),
    ("A", "Custo a confiar em quem acabei de conhecer.", True, None),

    # ---------------- NEUROTICISMO (N) — 10 itens, 5 invertidos ----------------
    # Atenção: a dimensão é NEUROTICISMO. Item NÃO invertido = mais neuroticismo.
    ("N", "Fico remoendo uma conversa ruim muito depois de ela terminar.", False, "N_remoi"),
    ("N", "Sob pressão, mantenho a cabeça no lugar.", True, "N_pressao"),
    ("N", "Pequenos contratempos estragam o meu dia.", False, None),
    ("N", "Demoro a me abalar quando as coisas dão errado.", True, None),
    ("N", "Me preocupo com coisas que provavelmente não vão acontecer.", False, None),
    ("N", "Esqueço rápido de um desentendimento e sigo em frente.", True, "N_remoi"),
    ("N", "Quando o clima esquenta, é comum eu perder a paciência.", False, "N_pressao"),
    ("N", "Durmo bem mesmo com assunto pendente.", True, None),
    ("N", "Sinto o corpo tenso (ombro, estômago, mandíbula) em semanas difíceis.", False, None),
    ("N", "Encaro um imprevisto com tranquilidade.", True, None),
]

DIMS = {
    "O": "0be54160-8d33-49c8-8572-55fcd039210d",
    "C": "ee569f59-2bb7-4048-80b2-47db47d35883",
    "E": "eca1f1d2-2afd-442a-ad14-d491d5232244",
    "A": "62e29bac-aab9-4b03-8a57-ecbbdc3665e4",
    "N": "9c3d1400-8198-405b-9c5e-de2e354dd8cb",
}
VERSION = "7c6d0667-3a62-423c-b9ef-f0daad561215"


def intercalar(itens):
    """
    Espalha os traços e afasta os pares de checagem.

    Blocos do mesmo traço em sequência criam efeito de arrasto: a pessoa entra
    num "modo de resposta" e repete. E par de checagem colado é óbvio demais —
    a graça é a pessoa não perceber que já respondeu algo equivalente.
    """
    from collections import defaultdict, deque
    porDim = defaultdict(deque)
    for it in itens:
        porDim[it[0]].append(it)
    ordem = ["O", "C", "E", "A", "N"]
    saida = []
    while any(porDim[d] for d in ordem):
        for d in ordem:
            if porDim[d]:
                saida.append(porDim[d].popleft())
    return saida


if __name__ == "__main__":
    import json
    from collections import Counter
    ordenados = intercalar(ITENS)
    print(f"total: {len(ordenados)} itens")
    print("por dimensão:", dict(Counter(i[0] for i in ordenados)))
    print("invertidos por dimensão:", dict(Counter(i[0] for i in ordenados if i[2])))
    pares = Counter(i[3] for i in ordenados if i[3])
    print("pares de checagem:", dict(pares))
    assert all(v == 2 for v in pares.values()), "todo par precisa ter exatamente 2 itens"
    # distância entre os pares
    pos = {}
    for idx, it in enumerate(ordenados):
        if it[3]:
            pos.setdefault(it[3], []).append(idx)
    print("distância entre pares:", {k: v[1] - v[0] for k, v in pos.items()})
