#!/usr/bin/env python3
"""
Testes e calibração dos ÍNDICES DO PERFIL DISC (#304) — Positividade, Estima, Flexibilidade e Energia.

  python3 scripts/testar_indices.py puro
      Roda a função REAL (src/lib/indices.ts, via Node) contra o oráculo em Python
      (scripts/indices_oraculo.py) — casos feitos à mão, com o resultado conferido na conta, e
      milhares de respostas ao acaso e de pessoas simuladas na estrutura REAL do DISC. Exige o
      MESMO número nos dois, casa por casa. Só lê o banco (a estrutura do teste). Não grava nada.

  python3 scripts/testar_indices.py simular [-n 40000]
      A calibração: distribuição de cada índice em respostas AO ACASO (não pode empilhar num
      extremo) e em PESSOAS SIMULADAS com natural e adaptado conhecidos (o índice tem de andar na
      direção do ajuste verdadeiro). Mostra também as contas antigas, para registro do porquê.

  python3 scripts/testar_indices.py real [--app URL]
      As respostas reais de DISC: os índices pelo oráculo, a partir do `ipsativo` gravado. Com
      --app, confere também o que o RELATÓRIO entrega (/api/public/report/<id>) — o caminho que a
      tela, o PDF e a assistente usam. Imprime só o começo do id e a data, nunca nome.

Requer Node 22.6+ (lê o TypeScript direto). Nunca imprime chave nenhuma.
"""
import argparse, json, math, os, random, shutil, subprocess, sys, urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from indices_oraculo import indices as oraculo_indices, sem_arredondar  # noqa: E402
from ipsativo_oraculo import oraculo, sortear_escolhas  # noqa: E402
from testar_ipsativo import UA, VERSOES, carregar_estrutura, escolhas_do_caso, para_oraculo, rest  # noqa: E402

RAIZ = os.getcwd()
ORDEM = ["D", "I", "S", "C"]

# Casos feitos à mão: (MAIS por letra, MENOS por letra, esperado {índice: valor} ou None = sem valor).
# O "esperado" foi feito na conta, fora do código — é ele que prova a especificação.
CASOS = {
    "dono_25_09": dict(
        desc="a resposta real do dono em 25/09 (só as contagens): natural I, adaptado C",
        mais={"D": 7, "I": 7, "S": 3, "C": 11}, menos={"D": 8, "I": 2, "S": 9, "C": 9},
        # positividade 17/28 · energia 18/28 · aceitação I 19/21 > S 16/25 > D 13/21 > C 8/17
        # estima (7×1 + 3×⅔ + 7×⅓ + 11×0)/28 = 0,405 · flexibilidade: 4 trocas + 1 meia em 6 pares
        espera={"positividade": 0.61, "estima": 0.40, "flexibilidade": 0.75, "energia": 0.64}),
    "congruente": dict(
        desc="mostra os estilos exatamente na ordem em que os aceita",
        mais={"I": 14, "S": 8, "D": 4, "C": 2}, menos={"C": 14, "D": 8, "S": 4, "I": 2},
        # aceitação I 12/14 > S 16/20 > D 16/24 > C 12/26 · MAIS I > S > D > C → nenhuma troca
        # estima (14×1 + 8×⅔ + 4×⅓ + 2×0)/28 = 0,738
        espera={"positividade": 0.79, "estima": 0.74, "flexibilidade": 0.0, "energia": 0.64}),
    "invertido": dict(
        desc="mostra os estilos na ordem INVERSA da aceitação",
        mais={"C": 12, "D": 8, "S": 5, "I": 3}, menos={"C": 9, "D": 7, "S": 6, "I": 6},
        # aceitação I 19/25 > S 17/23 > D 13/20 > C 7/16 · MAIS C > D > S > I → as 6 trocadas
        # estima (3×1 + 5×⅔ + 8×⅓ + 12×0)/28 = 9/28 = 0,321 · positividade 16/28 · energia 15/28
        espera={"positividade": 0.57, "estima": 0.32, "flexibilidade": 1.0, "energia": 0.54}),
    "uniforme": dict(
        desc="7-7-7-7 em MAIS e em MENOS: nada se destaca",
        mais={"D": 7, "I": 7, "S": 7, "C": 7}, menos={"D": 7, "I": 7, "S": 7, "C": 7},
        # todas empatadas nas duas ordens: nota ½ para todas, nenhuma troca
        espera={"positividade": 0.5, "estima": 0.5, "flexibilidade": 0.0, "energia": 0.5}),
    "letra_nunca_marcada": dict(
        desc="I nunca é MAIS nem MENOS (sinal 0): fica fora de Estima e Flexibilidade (#292)",
        mais={"S": 12, "C": 10, "D": 6, "I": 0}, menos={"D": 12, "S": 10, "C": 6, "I": 0},
        # só D, S, C: aceitação C 12/18 > D 10/22 > S 6/16 · MAIS S 12 > C 10 > D 6
        # estima (12×0 + 10×1 + 6×½)/28 = 13/28 = 0,464 · pares: D–S trocado, D–C igual, S–C trocado → 2/3
        espera={"positividade": 0.64, "estima": 0.46, "flexibilidade": 0.67, "energia": 0.57}),
    "sempre_o_mesmo_mais": dict(
        desc="caso patológico: D é o MAIS nos 28 blocos (nunca pôde ser rejeitado)",
        mais={"D": 28, "I": 0, "S": 0, "C": 0}, menos={"I": 10, "S": 9, "C": 9, "D": 0},
        # D sai (disponível 0); I, S, C não têm nenhum MAIS → Estima sem valor; pares: I–S ½, I–C ½, S–C 0
        espera={"positividade": 0.32, "estima": None, "flexibilidade": 0.33, "energia": 0.64}),
}


def rodar_node(resultados):
    node = shutil.which("node")
    if not node:
        raise SystemExit("Node não encontrado (use o do nvm: source ~/.nvm/nvm.sh).")
    r = subprocess.run([node, os.path.join("scripts", "indices_node.mjs")], input=json.dumps(resultados),
                       capture_output=True, text=True, cwd=RAIZ)
    if r.returncode != 0:
        raise SystemExit(f"indices_node.mjs falhou:\n{r.stderr[-1500:]}")
    return json.loads(r.stdout)


def ips_do_caso(est, mais, menos, semente=304):
    m, n = escolhas_do_caso(est, mais, menos, semente)
    return oraculo(est["dimensoes"], para_oraculo(est, m, n))


# ------------------------------------------------------------------ pessoas simuladas (calibração)
def _softmax_escolha(rng, opcoes, pesos):
    topo = max(pesos)
    return rng.choices(opcoes, weights=[math.exp(p - topo) for p in pesos], k=1)[0]


def pessoa_simulada(est, rng, tau, beta):
    """
    Uma pessoa com perfil de verdade: preferência NATURAL sorteada; ADAPTADA = natural + ajuste de
    tamanho `tau`. Em cada bloco, o MAIS puxa pela adaptada e o MENOS (entre as que sobraram) pela
    natural, com decisão `beta` — o modelo clássico: MAIS é o que se mostra, MENOS o que se rejeita.
    """
    nat = {k: rng.gauss(0, 1) for k in ORDEM}
    adp = {k: nat[k] + rng.gauss(0, tau) for k in ORDEM}
    chave = {d["id"]: d["key"] for d in est["dimensoes"]}
    mais, menos = [], []
    for b in est["blocos"]:
        ops = b["opcoes"]
        m = _softmax_escolha(rng, ops, [beta * adp[chave[est["letra_da_opcao"][o]]] for o in ops])
        resto = [o for o in ops if o != m]
        n = _softmax_escolha(rng, resto, [-beta * nat[chave[est["letra_da_opcao"][o]]] for o in resto])
        mais.append(m)
        menos.append(n)
    return mais, menos, nat, adp


def ajuste_verdadeiro(nat, adp):
    """Fração dos pares de estilos com a ordem trocada entre a preferência natural e a adaptada."""
    pares = [(a, b) for i, a in enumerate(ORDEM) for b in ORDEM[i + 1:]]
    return sum(1 for a, b in pares if (nat[a] > nat[b]) != (adp[a] > adp[b])) / len(pares)


# ------------------------------------------------------------------ comando: puro
def cmd_puro(args):
    est = carregar_estrutura(VERSOES["disc"])
    falhas = 0
    print("Casos feitos à mão (esperado conferido na conta):")
    for nome, c in CASOS.items():
        ips = ips_do_caso(est, c["mais"], c["menos"])
        ts = {i["key"]: i["value"] for i in rodar_node([ips])[0]}
        py = {i["key"]: i["value"] for i in oraculo_indices(ips)}
        ok = ts == py == c["espera"]
        falhas += not ok
        print(f"  {'OK ' if ok else 'ERRO'} {nome}: {c['desc']}")
        if not ok:
            print(f"       esperado {c['espera']}\n       TypeScript {ts}\n       oráculo    {py}")

    rng = random.Random(3040)
    est_json = {"letra_da_opcao": est["letra_da_opcao"], "blocos": est["blocos"]}
    lote = []
    for _ in range(args.n):
        m, n = sortear_escolhas(est_json, rng)
        lote.append(oraculo(est["dimensoes"], para_oraculo(est, m, n)))
    for tau in (0.0, 1.0, 3.0):
        for _ in range(args.n // 3):
            m, n, _, _ = pessoa_simulada(est, rng, tau, rng.uniform(0.3, 3.0))
            lote.append(oraculo(est["dimensoes"], para_oraculo(est, m, n)))
    ts = rodar_node(lote)
    divergentes = [i for i, (a, b) in enumerate(zip(ts, [oraculo_indices(r) for r in lote])) if a != b]
    falhas += len(divergentes)
    nulos = sum(1 for r in ts for i in r if i["value"] is None)
    print(f"\n{len(lote)} respostas (ao acaso + pessoas simuladas) na estrutura real do DISC: "
          f"{'OK — TypeScript e oráculo idênticos' if not divergentes else f'{len(divergentes)} DIVERGENTES'}"
          f" · índices sem valor: {nulos}")
    for i in divergentes[:3]:
        print(f"   #{i}: TS {ts[i]}\n       PY {oraculo_indices(lote[i])}")

    # fora do DISC não existe índice
    fora = rodar_node([{"letras": [{"chave": k, "maximo": 24, "mais": 8, "menos": 8, "sinal": 16,
                                    "sinal_suficiente": True} for k in ("V", "A", "K")]}])[0]
    if fora is not None:
        falhas += 1
        print("ERRO: instrumento com letras V/A/K recebeu índices")
    print("\nTUDO CERTO" if falhas == 0 else f"\n{falhas} FALHA(S)")
    return 0 if falhas == 0 else 1


# ------------------------------------------------------------------ comando: simular
def _faixas(vals):
    ok = sorted(v for v in vals if v is not None)
    n = len(ok)
    q = lambda p: ok[min(n - 1, int(p * n))]  # noqa: E731
    fr = lambda a, b: sum(1 for v in ok if a <= v < b) / n * 100  # noqa: E731
    return (f"p5 {q(.05):.2f} · p25 {q(.25):.2f} · mediana {q(.5):.2f} · p75 {q(.75):.2f} · p95 {q(.95):.2f}"
            f" │ abaixo de 0,40 {fr(0, .4):5.1f}% · 0,40–0,70 {fr(.4, .7001):5.1f}% · acima de 0,70 {fr(.7001, 9):5.1f}%"
            f" │ ≤0,10 {fr(0, .1001):4.1f}% · ≥0,90 {fr(.8999, 9):4.1f}%")


def _corr(xs, ys):
    pares = [(x, y) for x, y in zip(xs, ys) if x is not None and y is not None]
    xs, ys = zip(*pares)
    mx, my = sum(xs) / len(xs), sum(ys) / len(ys)
    den = math.sqrt(sum((x - mx) ** 2 for x in xs) * sum((y - my) ** 2 for y in ys))
    return sum((x - mx) * (y - my) for x, y in pares) / den if den else float("nan")


def _antigos(ips):
    """As contas de ANTES da #304, só para registro: pesos que somam 1 sobre percentuais que somam 100."""
    p = {l["chave"]: l["adaptado"]["percentual"] for l in ips["letras"]}
    return {"positividade": (0.6 * p["I"] + 0.25 * p["S"] + 0.15 * p["D"]) / 100,
            "energia": (0.6 * p["D"] + 0.4 * p["I"]) / 100}


def _comparando_graficos(ips):
    """O que NÃO usar: comparar a ordem dos dois gráficos (o natural carrega o MAIS dentro de si)."""
    L = {l["chave"]: l for l in ips["letras"] if l["sinal_suficiente"]}
    ks = list(L)
    s = lambda x: (x > 0) - (x < 0)  # noqa: E731
    pares = [(a, b) for i, a in enumerate(ks) for b in ks[i + 1:]]
    return sum(abs(s(L[a]["natural"]["bruto"] - L[b]["natural"]["bruto"]) - s(L[a]["mais"] - L[b]["mais"])) / 2
               for a, b in pares) / len(pares)


def cmd_simular(args):
    est = carregar_estrutura(VERSOES["disc"])
    est_json = {"letra_da_opcao": est["letra_da_opcao"], "blocos": est["blocos"]}
    rng = random.Random(3041)
    nomes = ("positividade", "estima", "flexibilidade", "energia")
    v = {k: [] for k in nomes}
    antigo = {"positividade": [], "energia": []}
    graf = []
    for _ in range(args.n):
        m, n = sortear_escolhas(est_json, rng)
        ips = oraculo(est["dimensoes"], para_oraculo(est, m, n))
        for k, x in sem_arredondar(ips).items():
            v[k].append(x)
        for k, x in _antigos(ips).items():
            antigo[k].append(x)
        graf.append(_comparando_graficos(ips))
    print(f"AO ACASO — {args.n} respostas na estrutura real do DISC (28 blocos). Ninguém tem perfil aqui:")
    print("o índice não pode empilhar num extremo.\n")
    for k in nomes:
        print(f"  {k:14s} {_faixas(v[k])}")
    print("\n  contas de ANTES da #304, para registro:")
    for k in antigo:
        print(f"  {k + ' (antiga)':14s} {_faixas(antigo[k])}")

    print("\nPESSOAS SIMULADAS — natural sorteado; adaptado = natural + ajuste de tamanho tau; decisão sorteada.")
    print("Com tau maior a pessoa ajusta mais: a Flexibilidade tem de SUBIR e a Estima tem de DESCER.\n")
    for tau in (0.0, 1.0, 2.0, 4.0):
        vv = {k: [] for k in nomes}
        orient, ajuste, graf_t = [], [], []
        for _ in range(args.n // 8):
            m, n, nat, adp = pessoa_simulada(est, rng, tau, rng.uniform(0.5, 2.0))
            ips = oraculo(est["dimensoes"], para_oraculo(est, m, n))
            for k, x in sem_arredondar(ips).items():
                vv[k].append(x)
            orient.append(nat["I"] + nat["S"] - nat["D"] - nat["C"])
            ajuste.append(ajuste_verdadeiro(nat, adp))
            graf_t.append(_comparando_graficos(ips))
        print(f" tau {tau} (ajuste verdadeiro médio {sum(ajuste) / len(ajuste):.2f}):")
        for k in nomes:
            extra = ""
            if k == "positividade":
                extra = f"  ← acompanha a orientação natural verdadeira: correlação {_corr(vv[k], orient):+.2f}"
            elif k in ("estima", "flexibilidade") and tau > 0:
                extra = f"  ← correlação com o ajuste verdadeiro {_corr(vv[k], ajuste):+.2f}"
            print(f"   {k:13s} {_faixas(vv[k])}{extra}")
        print(f"   {'(comparando os gráficos)':13s} mediana {sorted(graf_t)[len(graf_t) // 2]:.2f}"
              f"  ← o que a Flexibilidade daria comparando os dois gráficos: não enxerga o ajuste")
    print(f"\n  (comparando os gráficos, ao acaso: mediana {sorted(graf)[len(graf) // 2]:.2f} — quem responde "
          f"sem perfil sairia mais 'flexível' do que quem de fato se ajusta)")
    return 0


# ------------------------------------------------------------------ comando: real
def cmd_real(args):
    versoes = [v["id"] for v in rest("GET", "test_versions", {"instrument_id": "eq.disc", "select": "id"})]
    respostas = rest("GET", "test_responses", {
        "version_id": "in.(" + ",".join(versoes) + ")", "submitted_at": "not.is.null", "canceled_at": "is.null",
        "select": "id,submitted_at,kind,computed_scores", "order": "submitted_at.desc"})
    falhas = 0
    for r in respostas:
        ips = (r.get("computed_scores") or {}).get("ipsativo")
        if not ips:
            print(f"  {r['id'][:8]} {r['submitted_at'][:10]}: sem ipsativo gravado (o relatório deriva das respostas cruas)")
            continue
        esperado = {i["key"]: i["value"] for i in oraculo_indices(ips)}
        linha = " · ".join(f"{k} {esperado[k]:.2f}" if esperado[k] is not None else f"{k} —" for k in esperado)
        estado = ""
        if args.app:
            req = urllib.request.Request(f"{args.app.rstrip('/')}/api/public/report/{r['id']}", headers=UA)
            with urllib.request.urlopen(req, timeout=60) as resp:
                rel = json.loads(resp.read())
            obtido = {i["key"]: i["value"] for i in ((rel.get("derived") or {}).get("indices") or [])}
            ok = obtido == esperado
            falhas += not ok
            estado = "  relatório OK" if ok else f"  RELATÓRIO DIFERENTE: {obtido}"
        print(f"  {r['id'][:8]} {r['submitted_at'][:10]} ({r['kind']}): {linha}{estado}")
    return 0 if falhas == 0 else 1


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("puro")
    p.add_argument("-n", type=int, default=3000)
    p.set_defaults(f=cmd_puro)
    p = sub.add_parser("simular")
    p.add_argument("-n", type=int, default=40000)
    p.set_defaults(f=cmd_simular)
    p = sub.add_parser("real")
    p.add_argument("--app")
    p.set_defaults(f=cmd_real)
    args = ap.parse_args()
    sys.exit(args.f(args))


if __name__ == "__main__":
    main()
