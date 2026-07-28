"""
Correção final do embaralhamento: garantir que o par de checagem sirva para algo.

Um par de checagem são dois blocos que descrevem a mesma coisa com outras
palavras. Se os dois caírem com a mesma ordem de alternativas, quem clica sempre
na primeira escolhe a MESMA dimensão nos dois — e passa pela checagem como se
tivesse respondido com atenção. O par vira enfeite.

Trocar a permutação entre dois blocos não mexe no equilíbrio de posições: o
conjunto de permutações usadas continua o mesmo, só muda quem ficou com qual.
Por isso dá para corrigir depois, sem refazer a distribuição.
"""


def corrigir_pares(ordens, pares):
    """
    ordens: uma sequência de dimensões por bloco (a ordem na tela).
    pares:  {grupo: [indice_a, indice_b]}, índices base 0.

    Só funciona quando todos os blocos têm o mesmo conjunto de dimensões
    (DISC, Temperamentos). Onde cada bloco tem um subconjunto diferente —
    Valores — a restrição precisa entrar na própria montagem.
    """
    ordens = [list(o) for o in ordens]
    reservados = {i for par in pares.values() for i in par}
    for grupo, (a, b) in sorted(pares.items()):
        if ordens[a][0] != ordens[b][0]:
            continue
        for c in range(len(ordens)):
            if c in reservados or ordens[c][0] == ordens[a][0]:
                continue
            ordens[b], ordens[c] = ordens[c], ordens[b]
            reservados.add(c)
            break
        else:
            raise AssertionError(f"não achei bloco para trocar com o par {grupo}")
    return [tuple(o) for o in ordens]


def indices_dos_pares(blocos, campo=2):
    """{grupo: [i, j]} a partir da lista de blocos, com índice base 0."""
    pares = {}
    for i, b in enumerate(blocos):
        if b[campo]:
            pares.setdefault(b[campo], []).append(i)
    return pares
