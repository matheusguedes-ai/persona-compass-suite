"""
Temperamentos reescrito: 28 blocos sobre REAÇÃO e RITMO.

Dois problemas do conjunto anterior
-----------------------------------
1. Era um DISC repetido com outro nome. "Assumo o comando quando ninguém decide"
   (Colérico) é a mesma frase do bloco D do DISC. Responder os dois testes dava
   dois relatórios dizendo a mesma coisa — e o relatório da bateria ficava
   redundante em vez de mais rico.
2. Ordem fixa das alternativas, como no DISC.

A correção de conteúdo
----------------------
A teoria dos quatro temperamentos não é sobre comportamento no trabalho: é sobre
VELOCIDADE e DURAÇÃO da reação emocional. Colérico reage rápido e a impressão
dura; Sanguíneo reage rápido e passa; Melancólico demora a reagir e a impressão
fica; Fleumático quase não reage. É esse o eixo aqui — mágoa, alegria, humor,
energia, sono, o que fica entalado. O DISC continua cuidando do trabalho; este
teste passa a acrescentar algo em vez de repetir.

- COL Colérico · SAN Sanguíneo · MEL Melancólico · FLE Fleumático
- Alternativas com peso parecido: onde o Colérico "explode", o Fleumático
  "quase não se mexe" — nenhuma das duas é a resposta bonita.
- 5 pares de checagem, e ordem embaralhada por quadrado latino.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from embaralhar import corrigir_pares, indices_dos_pares  # noqa: E402

BLOCOS = [
    ("Você recebe uma notícia ruim.", {
        "COL": "Reajo na hora, e reajo forte.",
        "SAN": "Fico abalado rápido e passo rápido.",
        "MEL": "Fico remoendo por dias.",
        "FLE": "Absorvo e sigo, quase sem mudar de cara.",
    }, None),

    ("Uma alegria inesperada.", {
        "COL": "Comemoro e já penso no passo seguinte.",
        "SAN": "Espalho para todo mundo na hora.",
        "MEL": "Guardo para mim e saboreio devagar.",
        "FLE": "Fico contente por dentro, sem alarde.",
    }, "alegria"),

    ("O tipo de humor que combina com você:", {
        "COL": "Ironia afiada.",
        "SAN": "Rir alto, de qualquer bobagem.",
        "MEL": "Humor fino, com camadas.",
        "FLE": "Comentário seco, na hora certa.",
    }, None),

    ("Quando você se magoa com alguém:", {
        "COL": "Explodo e depois esqueço.",
        "SAN": "Fico chateado e no dia seguinte já passou.",
        "MEL": "Não esqueço, mesmo perdoando.",
        "FLE": "Nem sempre a pessoa percebe que eu me magoei.",
    }, "magoa"),

    ("Sua energia ao longo do dia:", {
        "COL": "Alta e constante, quase sem pausa.",
        "SAN": "Vai e vem conforme o que está acontecendo.",
        "MEL": "Boa em alguns horários, péssima em outros.",
        "FLE": "Sempre a mesma, sem picos.",
    }, "ritmo"),

    ("Começando um projeto novo:", {
        "COL": "Começo já querendo o resultado.",
        "SAN": "Começo empolgado e às vezes largo no meio.",
        "MEL": "Demoro a começar, planejando.",
        "FLE": "Começo sem pressa e sigo firme.",
    }, "comeco"),

    ("Numa mesa cheia de gente:", {
        "COL": "Domino a conversa sem perceber.",
        "SAN": "Falo com todo mundo.",
        "MEL": "Converso a fundo com uma ou duas pessoas.",
        "FLE": "Escuto mais do que falo.",
    }, None),

    ("O que já reclamaram de você:", {
        "COL": "Que sou ríspido.",
        "SAN": "Que sou disperso.",
        "MEL": "Que sou pessimista.",
        "FLE": "Que sou parado demais.",
    }, None),

    ("Diante de uma injustiça:", {
        "COL": "Me revolto e parto para cima.",
        "SAN": "Falo alto na hora e depois esfrio.",
        "MEL": "Fico com aquilo entalado por muito tempo.",
        "FLE": "Acho ruim, mas não me mexo muito.",
    }, None),

    ("Vinte minutos de espera, sem nada para fazer.", {
        "COL": "Fico irritado com o tempo perdido.",
        "SAN": "Puxo assunto com alguém.",
        "MEL": "Fico na minha, pensando.",
        "FLE": "Não me incomodo nem um pouco.",
    }, None),

    ("Alguém te contraria na frente dos outros.", {
        "COL": "Rebato na hora.",
        "SAN": "Levo na brincadeira.",
        "MEL": "Fico calado e magoado.",
        "FLE": "Deixo quieto, não vale a briga.",
    }, None),

    ("O que te tira do sério:", {
        "COL": "Incompetência.",
        "SAN": "Tédio.",
        "MEL": "Superficialidade.",
        "FLE": "Gente agitada demais.",
    }, None),

    ("Como você decide as coisas do dia a dia:", {
        "COL": "Rápido, quase sem pensar.",
        "SAN": "Pelo que me parece mais animado.",
        "MEL": "Pesando tudo, e ainda fico na dúvida.",
        "FLE": "Adiando até precisar mesmo.",
    }, None),

    ("Um momento de crise geral.", {
        "COL": "Assumo e mando.",
        "SAN": "Tento manter o astral.",
        "MEL": "Enxergo o pior cenário antes de todo mundo.",
        "FLE": "Sou o mais calmo da sala.",
    }, "crise"),

    ("Sobre planos e promessas:", {
        "COL": "Prometo pouco e cobro cumprimento.",
        "SAN": "Prometo empolgado e nem sempre cumpro.",
        "MEL": "Prometo só o que tenho certeza.",
        "FLE": "Evito prometer.",
    }, None),

    ("Quando você erra:", {
        "COL": "Reconheço rápido e vou adiante.",
        "SAN": "Rio de mim mesmo.",
        "MEL": "Me cobro muito além do necessário.",
        "FLE": "Não faço drama.",
    }, None),

    ("Combinaram uma coisa com você e desmarcaram em cima da hora.", {
        "COL": "Fico bravo e falo.",
        "SAN": "Já arrumo outra coisa para fazer.",
        "MEL": "Fico pensando se foi por minha causa.",
        "FLE": "Tudo bem, aproveito para descansar.",
    }, None),

    ("O ritmo que combina com você:", {
        "COL": "Acelerado.",
        "SAN": "Variado.",
        "MEL": "O meu, sem interrupção.",
        "FLE": "Tranquilo.",
    }, "ritmo"),

    ("Como você demonstra afeto:", {
        "COL": "Fazendo coisas pela pessoa.",
        "SAN": "Falando e abraçando.",
        "MEL": "Com gestos pensados, escolhidos.",
        "FLE": "Estando por perto, em silêncio.",
    }, None),

    ("O que você faz quando está triste:", {
        "COL": "Me ocupo até passar.",
        "SAN": "Procuro gente.",
        "MEL": "Me recolho e mergulho.",
        "FLE": "Espero passar.",
    }, None),

    ("Aquele projeto que você começou, algumas semanas depois:", {
        "COL": "Continuo puxando, sem soltar.",
        "SAN": "A empolgação do começo já esfriou.",
        "MEL": "Só agora sinto que entendi direito.",
        "FLE": "Sigo no mesmo passo do primeiro dia.",
    }, "comeco"),

    ("Um elogio em público:", {
        "COL": "Recebo bem e sigo em frente.",
        "SAN": "Adoro.",
        "MEL": "Fico sem graça e meio desconfiado.",
        "FLE": "Agradeço e mudo de assunto.",
    }, "alegria"),

    ("Sobre mudar de opinião:", {
        "COL": "Custa, mas quando mudo, mudo inteiro.",
        "SAN": "Mudo com facilidade.",
        "MEL": "Mudo devagar, e só com argumento.",
        "FLE": "Mudo sem fazer alarde.",
    }, None),

    ("Alguém precisa de você numa emergência.", {
        "COL": "Tomo a frente e resolvo.",
        "SAN": "Chego e mobilizo gente para ajudar.",
        "MEL": "Penso em tudo que pode dar errado e me preparo.",
        "FLE": "Fico firme, sem me abalar.",
    }, "crise"),

    ("O que fica com você depois de uma discussão:", {
        "COL": "A vontade de ter razão.",
        "SAN": "A vontade de fazer as pazes.",
        "MEL": "As frases, que ficam voltando.",
        "FLE": "O cansaço.",
    }, "magoa"),

    ("Uma mudança é imposta, sem te consultarem.", {
        "COL": "Contesto.",
        "SAN": "Acho graça e vou junto.",
        "MEL": "Resisto por dentro.",
        "FLE": "Aceito e me adapto.",
    }, None),

    ("A pior semana possível para você seria:", {
        "COL": "Sem poder resolver nada.",
        "SAN": "Sem falar com ninguém.",
        "MEL": "Sem tempo para pensar.",
        "FLE": "Cheia de cobrança e correria.",
    }, None),

    ("Se te descrevessem numa palavra só, você aceitaria:", {
        "COL": "Intenso.",
        "SAN": "Alegre.",
        "MEL": "Profundo.",
        "FLE": "Sereno.",
    }, None),
]

DIMS = {
    "COL": "128461f3-1e0b-4d10-8ea9-33d2d60333dc",
    "SAN": "e824540a-6085-45e5-aa6a-efccdc674dfa",
    "MEL": "9f5c4d6e-782b-4a61-ac3a-0dc754a4c88b",
    "FLE": "51671b6b-34f3-4bd0-bb72-1a9ec5958a4d",
}
VERSION = "58927961-a8de-4a60-8928-860f0c9e7788"
DICA = "Escolha a que MAIS e a que MENOS tem a ver com você."


def ordens():
    """Mesma ideia do DISC: 28 blocos, 4 posições, 7 aparições por posição."""
    from itertools import permutations
    todas = list(permutations(["COL", "SAN", "MEL", "FLE"]))
    espalhadas = [todas[(i * 7) % 24] for i in range(24)]
    assert len(set(espalhadas)) == 24
    quadrado = [
        ("COL", "SAN", "MEL", "FLE"), ("SAN", "MEL", "FLE", "COL"),
        ("MEL", "FLE", "COL", "SAN"), ("FLE", "COL", "SAN", "MEL"),
    ]
    saida = espalhadas[:12] + quadrado[:2] + espalhadas[12:22] + quadrado[2:] + espalhadas[22:]
    return corrigir_pares(saida[: len(BLOCOS)], indices_dos_pares(BLOCOS))


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
    for pos in range(4):
        c = Counter(o[pos] for o in ords)
        assert set(c.values()) == {7}, f"posição {pos + 1} desequilibrada: {c}"
    print("  posições: 7 de cada temperamento em cada uma das 4", file=sys.stderr)
    pares = Counter(b[2] for b in BLOCOS if b[2])
    print(f"  pares de checagem: {dict(pares)}", file=sys.stderr)
    assert all(v == 2 for v in pares.values())
    pos = {}
    for i, b in enumerate(BLOCOS, start=1):
        if b[2]:
            pos.setdefault(b[2], []).append(i)
    print(f"  distância entre pares: {({k: v[1] - v[0] for k, v in pos.items()})}", file=sys.stderr)
    assert all(v[1] - v[0] >= 8 for v in pos.values())
    # A ordem precisa mudar entre os dois blocos do par: se caírem iguais, quem
    # clica sempre na mesma posição escolhe o mesmo dos dois lados e escapa da
    # checagem — foi o que aconteceu no VAK antes desta verificação existir.
    for grupo, (a, b) in pos.items():
        assert ords[a - 1][0] != ords[b - 1][0], f"par {grupo} começa igual nos dois blocos"
    print("  pares com primeira alternativa trocada: ok", file=sys.stderr)
    for enunciado, alts, _ in BLOCOS:
        assert set(alts) == set(DIMS), f"bloco incompleto: {enunciado}"
    print("ok", file=sys.stderr)
