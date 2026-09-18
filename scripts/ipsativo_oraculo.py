"""
Oráculo do motor ipsativo (#288, Etapa 2a).

Reimplementa a ESPECIFICAÇÃO do produto em Python, sem olhar o TypeScript, para
conferir o motor de fora: se as duas implementações concordam em milhares de
respostas, a regra foi entendida do mesmo jeito nos dois lados.

A especificação (decisão do dono do produto, 18/09/2026):
  adaptado(letra) = vezes MAIS                 (0 a n_blocos)
  natural(letra)  = maximo − vezes MENOS       (maximo = blocos em que a letra aparece)
  expressao       = MAIS − MENOS               (soma zero)
  cada conjunto: ranking + % da soma do PRÓPRIO conjunto (soma 100)
  perfil: distância(1º, 2º) ≤ 2 → combinado (as duas letras)
          3 a 5 → predominância moderada · 6 ou mais → clara
  empate: sempre pela ordem da letra no instrumento (sort_order, chave, id)

Este módulo é só biblioteca (sem rede, sem banco). Quem o usa é `testar_ipsativo.py`.
"""
import random

LIMITE_COMBINADO = 2
LIMITE_MODERADA = 5
SEM_ORDEM = 10 ** 15


def chave_da_letra(d):
    return (d["sort_order"] if d["sort_order"] is not None else SEM_ORDEM, d["key"], d["id"])


def _perfil(ordenado):
    primeira = ordenado[0]
    segunda = ordenado[1] if len(ordenado) > 1 else None
    distancia = primeira[1] - segunda[1] if segunda else primeira[1]
    combinado = segunda is not None and distancia <= LIMITE_COMBINADO
    faixa = "combinado" if combinado else ("moderada" if distancia <= LIMITE_MODERADA else "clara")
    chaves = [primeira[0]["key"], segunda[0]["key"]] if combinado else [primeira[0]["key"]]
    grupo = [d["key"] for d, b in ordenado if b >= primeira[1] - LIMITE_COMBINADO]
    return {
        "tipo": "combinado" if combinado else "predominante",
        "chaves": chaves,
        "codigo": "".join(chaves) if all(len(k) == 1 for k in chaves) else "+".join(chaves),
        "distancia": distancia,
        "faixa": faixa,
        "grupo_da_frente": grupo,
        "empate_multiplo": len(grupo) > 2,
    }


def _conjunto(pares):
    """pares: lista de (dimensão, bruto). Devolve (conjunto, {dim_id: posição})."""
    ordenado = sorted(pares, key=lambda p: (-p[1], chave_da_letra(p[0])))
    soma = sum(b for _, b in ordenado)
    pos = {}
    for i, (d, b) in enumerate(ordenado):
        pos[d["id"]] = {
            "bruto": b,
            "percentual": (b / soma * 100) if soma > 0 else 0,
            "posicao": i + 1,
            "empate_com_anterior": i > 0 and ordenado[i - 1][1] == b,
        }
    return {"soma_bruta": soma, "ranking": [d["key"] for d, _ in ordenado], "perfil": _perfil(ordenado)}, pos


def oraculo(dimensoes, blocos):
    """
    dimensoes: [{id, key, sort_order}]
    blocos:    [{id, opcoes: {opcao_id: [(dim_id, pontos), ...]}, mais: opcao_id, menos: opcao_id}]
    """
    dims = sorted(dimensoes, key=chave_da_letra)
    ids = {d["id"] for d in dims}
    maximo, mais, menos = {}, {}, {}
    for b in blocos:
        teto = {}
        for pts in b["opcoes"].values():
            for dim_id, p in pts:
                if dim_id in ids:
                    teto[dim_id] = max(teto.get(dim_id, 0), p)
        for dim_id, t in teto.items():
            maximo[dim_id] = maximo.get(dim_id, 0) + max(t, 0)
        for dim_id, p in b["opcoes"][b["mais"]]:
            if dim_id in ids:
                mais[dim_id] = mais.get(dim_id, 0) + p
        for dim_id, p in b["opcoes"][b["menos"]]:
            if dim_id in ids:
                menos[dim_id] = menos.get(dim_id, 0) + p
    letras = [d for d in dims if maximo.get(d["id"], 0) > 0]
    if not letras or not blocos:
        return None
    adaptado, pos_a = _conjunto([(d, mais.get(d["id"], 0)) for d in letras])
    natural, pos_n = _conjunto([(d, maximo[d["id"]] - menos.get(d["id"], 0)) for d in letras])
    return {
        "versao": 1,
        "n_blocos": len(blocos),
        "limiares": {"combinado_ate": LIMITE_COMBINADO, "moderada_ate": LIMITE_MODERADA},
        "letras": [{
            "dimension_id": d["id"], "chave": d["key"], "maximo": maximo[d["id"]],
            "mais": mais.get(d["id"], 0), "menos": menos.get(d["id"], 0),
            "adaptado": pos_a[d["id"]], "natural": pos_n[d["id"]],
            "expressao": mais.get(d["id"], 0) - menos.get(d["id"], 0),
        } for d in letras],
        "adaptado": adaptado,
        "natural": natural,
    }


def comparar(a, b, caminho="", tol=1e-9):
    """Compara duas estruturas JSON com tolerância nos números. Devolve a lista de diferenças."""
    difs = []
    if isinstance(a, dict) and isinstance(b, dict):
        for k in sorted(set(a) | set(b)):
            if k not in a:
                difs.append(f"{caminho}.{k}: só no segundo")
            elif k not in b:
                difs.append(f"{caminho}.{k}: só no primeiro")
            else:
                difs += comparar(a[k], b[k], f"{caminho}.{k}", tol)
    elif isinstance(a, list) and isinstance(b, list):
        if len(a) != len(b):
            difs.append(f"{caminho}: tamanhos {len(a)} × {len(b)}")
        else:
            for i, (x, y) in enumerate(zip(a, b)):
                difs += comparar(x, y, f"{caminho}[{i}]", tol)
    elif isinstance(a, bool) or isinstance(b, bool) or a is None or b is None or isinstance(a, str) or isinstance(b, str):
        if a != b:
            difs.append(f"{caminho}: {a!r} × {b!r}")
    else:
        if abs(float(a) - float(b)) > tol:
            difs.append(f"{caminho}: {a!r} × {b!r}")
    return difs


# --------------------------------------------------------------------------- montagem de respostas

def distribuir_pares(mais_vec, menos_vec):
    """
    Dados quantos MAIS e quantos MENOS cada letra deve receber (mesma soma), acha os pares
    (letra do MAIS, letra do MENOS) de cada bloco, com MAIS ≠ MENOS em todo bloco.
    Fluxo máximo num grafo pequeno; devolve a lista de pares ou levanta erro se for impossível.
    """
    letras = sorted(set(mais_vec) | set(menos_vec))
    if sum(mais_vec.values()) != sum(menos_vec.values()):
        raise ValueError("a soma de MAIS e a de MENOS precisam ser iguais (um de cada por bloco)")
    total = sum(mais_vec.values())
    cap = {}  # (u, v) -> capacidade residual

    def aresta(u, v, c):
        cap[(u, v)] = cap.get((u, v), 0) + c
        cap.setdefault((v, u), 0)

    for m in letras:
        aresta("S", ("M", m), mais_vec.get(m, 0))
        aresta(("N", m), "T", menos_vec.get(m, 0))
        for n in letras:
            if m != n:
                aresta(("M", m), ("N", n), total)
    fluxo = 0
    while True:
        pai = {"S": None}
        fila = ["S"]
        while fila and "T" not in pai:
            u = fila.pop(0)
            for (x, y), c in list(cap.items()):
                if x == u and c > 0 and y not in pai:
                    pai[y] = u
                    fila.append(y)
        if "T" not in pai:
            break
        v = "T"
        while pai[v] is not None:
            u = pai[v]
            cap[(u, v)] -= 1
            cap[(v, u)] += 1
            v = u
        fluxo += 1
    if fluxo != total:
        raise ValueError(f"impossível: só {fluxo} dos {total} blocos podem ter MAIS ≠ MENOS")
    pares = []
    for m in letras:
        for n in letras:
            if m != n:
                usados = cap[(("N", n), ("M", m))]  # fluxo devolvido pela aresta reversa
                pares += [(m, n)] * usados
    return pares


def embaralhar_pares(pares, semente):
    """Ordem dos blocos determinística (para o caso não sair 'todos os S primeiro')."""
    r = random.Random(semente)
    p = list(pares)
    r.shuffle(p)
    return p


def sortear_escolhas(estrutura, rng, pesos=None):
    """
    Uma resposta aleatória: para cada bloco, MAIS entre as alternativas (com pesos por letra, se
    houver) e MENOS entre as restantes. Devolve (lista de ids MAIS, lista de ids MENOS).
    estrutura: {"letra_da_opcao": {opcao_id: dim_id}, "blocos": [{"opcoes": [opcao_id, ...]}]}
    """
    mais, menos = [], []
    for b in estrutura["blocos"]:
        ops = b["opcoes"]
        if pesos:
            w = [pesos.get(estrutura["letra_da_opcao"][o], 1.0) for o in ops]
            m = rng.choices(ops, weights=w, k=1)[0]
        else:
            m = rng.choice(ops)
        resto = [o for o in ops if o != m]
        if pesos:
            w2 = [1.0 / max(pesos.get(estrutura["letra_da_opcao"][o], 1.0), 1e-9) for o in resto]
            n = rng.choices(resto, weights=w2, k=1)[0]
        else:
            n = rng.choice(resto)
        mais.append(m)
        menos.append(n)
    return mais, menos
