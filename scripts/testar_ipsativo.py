#!/usr/bin/env python3
"""
Testes do motor ipsativo da escolha forçada (#288, Etapa 2a).

  python3 scripts/testar_ipsativo.py puro     [--versao-disc ID]
      Roda o cálculo REAL (src/lib/escolha-forcada.ts, via Node) contra um oráculo em Python
      escrito só a partir da especificação: os casos de teste do produto + milhares de respostas
      aleatórias nas estruturas REAIS de DISC, Temperamentos, VAK e Valores + a prova de que
      embaralhar a entrada não muda a saída. Só lê o banco (GET). Não escreve nada.

  python3 scripts/testar_ipsativo.py vivo --app URL --versao ID [--casos a,b] [--sem-ipsativo]
        [--salvar-legado ARQ | --comparar-legado ARQ]
      Cria pessoa descartável + resposta, envia pelo endpoint PÚBLICO do app, lê o que o motor
      gravou e confere contra a regra. Apaga TUDO no fim, citando os ids antes de apagar.
      A resposta nasce dentro de uma bateria com uma irmã pendente: assim o envio NÃO gera o aviso
      "fulano respondeu" no sino do dono e da equipe (a bateria só notifica quando fecha).

  python3 scripts/testar_ipsativo.py simular
      Monte Carlo de quem responde ao acaso: quanto cai em "combinado", "moderada" e "clara".

Não importa nenhum script de conteúdo (nada de aplicar_conteudo.py). Nunca imprime chave nenhuma.
"""
import argparse, json, os, random, shutil, subprocess, sys, urllib.error, urllib.parse, urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ipsativo_oraculo import (LIMITE_COMBINADO, LIMITE_MODERADA, comparar, distribuir_pares,  # noqa: E402
                              embaralhar_pares, oraculo, sortear_escolhas)

RAIZ = os.getcwd()
UA = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"}
VERSOES = {  # estruturas reais lidas do banco
    "disc": "f9c6aba8-115b-4c59-9d35-9c1f995b3eb9",
    "temperamentos": "58927961-a8de-4a60-8928-860f0c9e7788",
    "vak": "fede7d5f-7344-4646-90bb-d4f5a35ec892",
    "valores": "facb3043-ae0a-4162-81da-1262680939f5",
}
PREFIXO = "Simulação Etapa2a"


def _env():
    env = {}
    for linha in open(os.path.join(RAIZ, ".env.local"), encoding="utf-8"):
        linha = linha.strip()
        if linha and not linha.startswith("#") and "=" in linha:
            k, v = linha.split("=", 1)
            env[k] = v.strip().strip('"').strip("'")
    return env["SUPABASE_URL"].rstrip("/"), env["SUPABASE_SERVICE_ROLE_KEY"]


URL, KEY = _env()


def rest(metodo, tabela, params=None, corpo=None, retorno=True):
    q = ("?" + urllib.parse.urlencode(params, safe="(),.*:%")) if params else ""
    headers = {"apikey": KEY, "Authorization": f"Bearer {KEY}", "Content-Type": "application/json"}
    if retorno:
        headers["Prefer"] = "return=representation"
    req = urllib.request.Request(f"{URL}/rest/v1/{tabela}{q}", method=metodo, headers=headers,
                                 data=None if corpo is None else json.dumps(corpo).encode())
    try:
        with urllib.request.urlopen(req) as r:
            txt = r.read().decode()
            return json.loads(txt) if txt else None
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"{metodo} {tabela} falhou ({e.code}): {e.read().decode()[:300]}")


# --------------------------------------------------------------------------- estrutura de uma versão
def carregar_estrutura(vid):
    dims = rest("GET", "test_dimensions", {"version_id": f"eq.{vid}", "select": "id,key,sort_order", "order": "sort_order"})
    qs = [q for q in rest("GET", "test_questions", {"version_id": f"eq.{vid}", "select": "id,sort_order,type", "order": "sort_order"})
          if q["type"] == "forced_choice"]
    ops = rest("GET", "test_options", {"question_id": "in.(" + ",".join(q["id"] for q in qs) + ")", "select": "id,question_id,sort_order"})
    scs = rest("GET", "option_scores", {"option_id": "in.(" + ",".join(o["id"] for o in ops) + ")", "select": "option_id,dimension_id,points"})
    pts = {}
    for s in scs:
        pts.setdefault(s["option_id"], []).append((s["dimension_id"], float(s["points"])))
    blocos = []
    for q in qs:
        oq = sorted([o for o in ops if o["question_id"] == q["id"]], key=lambda o: (o["sort_order"], o["id"]))
        blocos.append({"id": q["id"], "sort_order": q["sort_order"], "opcoes": [o["id"] for o in oq],
                       "pontos": {o["id"]: pts.get(o["id"], []) for o in oq}})
    maximo = {}
    for b in blocos:
        teto = {}
        for o in b["opcoes"]:
            for d, p_ in b["pontos"][o]:
                teto[d] = max(teto.get(d, 0), p_)
        for d, t in teto.items():
            maximo[d] = maximo.get(d, 0) + t
    return {"dimensoes": dims, "blocos": blocos, "letra_da_opcao": {o: p[0][0] for o, p in pts.items() if p},
            "id_da_chave": {d["key"]: d["id"] for d in dims}, "maximo": maximo}


def para_oraculo(est, mais, menos):
    return [{"id": b["id"], "opcoes": b["pontos"], "mais": mais[i], "menos": menos[i]} for i, b in enumerate(est["blocos"])]


def para_node(est):
    return {"dimensoes": est["dimensoes"],
            "blocos": [{"id": b["id"], "opcoes": [{"id": o, "pontos": [{"dimension_id": d, "points": p} for d, p in b["pontos"][o]]}
                                                  for o in b["opcoes"]]} for b in est["blocos"]]}


def escolhas_do_caso(est, mais_vec, menos_vec, semente):
    """Transforma 'quantos MAIS e MENOS cada letra recebe' em uma opção MAIS e uma MENOS por bloco."""
    pares = embaralhar_pares(distribuir_pares(mais_vec, menos_vec), semente)
    assert len(pares) == len(est["blocos"])
    mais, menos = [], []
    for (m, n), b in zip(pares, est["blocos"]):
        por_chave = {}
        for o in b["opcoes"]:
            d = next(d for d in est["dimensoes"] if d["id"] == est["letra_da_opcao"][o])
            por_chave[d["key"]] = o
        mais.append(por_chave[m])
        menos.append(por_chave[n])
    return mais, menos


# --------------------------------------------------------------------------- casos de teste do produto
# espera: (tipo, faixa, chaves do perfil, distância) para o ADAPTADO (= MAIS) e o NATURAL (= 28 − MENOS)
CASOS = {
    "a_dominante_clara": dict(
        desc="uma letra muito acima das outras",
        mais={"S": 16, "C": 6, "I": 4, "D": 2}, menos={"D": 14, "I": 9, "C": 4, "S": 1},
        espera={"adaptado": ("predominante", "clara", ["S"], 10), "natural": ("predominante", "moderada", ["S"], 3)}),
    "b_quase_empate": dict(
        desc="1ª e 2ª a 2 pontos de distância → perfil combinado",
        mais={"S": 9, "C": 7, "I": 6, "D": 6}, menos={"D": 10, "I": 8, "S": 6, "C": 4},
        espera={"adaptado": ("combinado", "combinado", ["S", "C"], 2), "natural": ("combinado", "combinado", ["C", "S"], 2)}),
    "c_empate_perfeito_em_2": dict(
        desc="empate perfeito em 2 letras (10 × 10)",
        mais={"S": 10, "C": 10, "I": 5, "D": 3}, menos={"D": 12, "I": 9, "C": 7, "S": 0},
        espera={"adaptado": ("combinado", "combinado", ["S", "C"], 0), "natural": ("predominante", "clara", ["S"], 7)}),
    "d_quatro_uniformes": dict(
        desc="as 4 letras iguais (7-7-7-7 em MAIS e em MENOS)",
        mais={"D": 7, "I": 7, "S": 7, "C": 7}, menos={"D": 7, "I": 7, "S": 7, "C": 7},
        espera={"adaptado": ("combinado", "combinado", ["D", "I"], 0), "natural": ("combinado", "combinado", ["D", "I"], 0)}),
    "e_letra_nunca_marcada": dict(
        desc="a letra I nunca é MAIS nem MENOS",
        mais={"S": 12, "C": 10, "D": 6, "I": 0}, menos={"D": 12, "S": 10, "C": 6, "I": 0},
        espera={"adaptado": ("combinado", "combinado", ["S", "C"], 2), "natural": ("predominante", "clara", ["I"], 6)}),
    # casos-limite dos limiares (2 → combinado · 3 e 5 → moderada · 6 → clara)
    "f_distancia_3": dict(
        desc="limite: distância 3 = moderada",
        mais={"S": 10, "C": 7, "I": 6, "D": 5}, menos={"D": 9, "I": 8, "C": 6, "S": 5},
        espera={"adaptado": ("predominante", "moderada", ["S"], 3), "natural": ("combinado", "combinado", ["S", "C"], 1)}),
    "g_distancia_5": dict(
        desc="limite: distância 5 = moderada",
        mais={"S": 12, "C": 7, "I": 5, "D": 4}, menos={"D": 10, "I": 8, "S": 6, "C": 4},
        espera={"adaptado": ("predominante", "moderada", ["S"], 5), "natural": ("combinado", "combinado", ["C", "S"], 2)}),
    "h_distancia_6": dict(
        desc="limite: distância 6 = clara",
        mais={"S": 13, "C": 7, "I": 5, "D": 3}, menos={"D": 13, "I": 8, "C": 5, "S": 2},
        espera={"adaptado": ("predominante", "clara", ["S"], 6), "natural": ("predominante", "moderada", ["S"], 3)}),
}


def resumo_do_perfil(res, conjunto):
    p = res[conjunto]["perfil"]
    return (p["tipo"], p["faixa"], p["chaves"], p["distancia"])


def conferir_invariantes(res):
    """Propriedades que valem para QUALQUER resposta (conferidas sem o oráculo)."""
    falhas = []
    for conj in ("adaptado", "natural"):
        soma = sum(l[conj]["percentual"] for l in res["letras"])
        if abs(soma - 100) > 1e-9:
            falhas.append(f"{conj}: percentuais somam {soma}")
        brutos = [res[conj]["ranking"].index(l["chave"]) for l in res["letras"]]
        if sorted(brutos) != list(range(len(res["letras"]))):
            falhas.append(f"{conj}: ranking não é uma permutação")
        ordenadas = sorted(res["letras"], key=lambda l: l[conj]["posicao"])
        for a, b in zip(ordenadas, ordenadas[1:]):
            if a[conj]["bruto"] < b[conj]["bruto"]:
                falhas.append(f"{conj}: ranking fora de ordem")
                break
    if sum(l["expressao"] for l in res["letras"]) != 0:
        # todo bloco reparte 1 MAIS e 1 MENOS (1 ponto cada): a soma de MAIS − MENOS é zero
        falhas.append("expressão não soma zero")

    def procura_chave_proibida(x):
        if isinstance(x, dict):
            for k, v in x.items():
                if any(t in k.lower() for t in ("gap", "diferenca", "diff", "delta")):
                    return k
                r = procura_chave_proibida(v)
                if r:
                    return r
        elif isinstance(x, list):
            for v in x:
                r = procura_chave_proibida(v)
                if r:
                    return r
        return None
    proibida = procura_chave_proibida(res)
    if proibida:
        falhas.append(f"campo de comparação natural×adaptado não deveria existir: {proibida}")
    return falhas


def rodar_node(estruturas, casos, embaralhar=0):
    node = shutil.which("node")
    if not node:
        sys.exit("Node não encontrado no PATH (dar source no nvm antes: source ~/.nvm/nvm.sh)")
    entrada = json.dumps({"estruturas": {n: para_node(e) for n, e in estruturas.items()}, "casos": casos, "embaralhar": embaralhar})
    r = subprocess.run([node, os.path.join("scripts", "ipsativo_node.mjs")], input=entrada, capture_output=True, text=True, cwd=RAIZ)
    if r.returncode != 0:
        sys.exit("Node falhou:\n" + r.stderr[-1500:])
    return json.loads(r.stdout)


# --------------------------------------------------------------------------- comando: puro
def cmd_puro(args):
    versoes = dict(VERSOES)
    if args.versao_disc:
        versoes["disc"] = args.versao_disc
    estruturas = {n: carregar_estrutura(v) for n, v in versoes.items()}
    print("Estruturas lidas do banco (GET):")
    for n, e in estruturas.items():
        print(f"  {n:14} letras={[d['key'] for d in e['dimensoes']]}  blocos={len(e['blocos'])}  alternativas/bloco={sorted({len(b['opcoes']) for b in e['blocos']})}")

    # ---- 1) os casos de teste do produto (DISC)
    print("\n== CASOS DE TESTE DO PRODUTO (DISC) — cálculo real × oráculo × resultado esperado ==")
    est = estruturas["disc"]
    casos_node, meta = [], []
    for i, (nome, c) in enumerate(CASOS.items()):
        mais, menos = escolhas_do_caso(est, c["mais"], c["menos"], semente=100 + i)
        casos_node.append({"estrutura": "disc", "mais": mais, "menos": menos})
        meta.append((nome, c, mais, menos))
    saidas = rodar_node(estruturas, casos_node, embaralhar=5)
    falhou = 0
    for (nome, c, mais, menos), s in zip(meta, saidas):
        res = s["resultado"]
        difs = comparar(res, oraculo(est["dimensoes"], para_oraculo(est, mais, menos)))
        inv = conferir_invariantes(res)
        esp_ok = all(resumo_do_perfil(res, k) == (v[0], v[1], v[2], v[3]) for k, v in c["espera"].items())
        # as contagens gravadas batem com o que foi pedido?
        cont_ok = all(l["mais"] == c["mais"].get(l["chave"], 0) and l["menos"] == c["menos"].get(l["chave"], 0) for l in res["letras"])
        ok = not difs and not inv and esp_ok and cont_ok and s["deterministico"]
        falhou += 0 if ok else 1
        print(f"\n[{'OK' if ok else 'FALHOU'}] {nome}: {c['desc']}")
        for l in sorted(res["letras"], key=lambda l: l["adaptado"]["posicao"]):
            print(f"      {l['chave']}: MAIS {l['mais']:2} MENOS {l['menos']:2} | adaptado {l['adaptado']['bruto']:2} ({l['adaptado']['percentual']:5.1f}%, {l['adaptado']['posicao']}º)"
                  f" | natural {l['natural']['bruto']:2} ({l['natural']['percentual']:5.1f}%, {l['natural']['posicao']}º) | expressão {l['expressao']:+d}")
        for k in ("adaptado", "natural"):
            p = res[k]["perfil"]
            print(f"      {k:8} ranking {res[k]['ranking']} → {p['tipo']} '{p['codigo']}' · distância {p['distancia']} · {p['faixa']}"
                  f" · grupo da frente {p['grupo_da_frente']}{' (EMPATE MÚLTIPLO)' if p['empate_multiplo'] else ''}")
        if difs: print("      diferenças contra o oráculo:", difs[:6])
        if inv: print("      invariantes:", inv)
        if not esp_ok: print("      esperado:", c["espera"])
        if not cont_ok: print("      contagens diferentes do pedido")
        if not s["deterministico"]: print("      NÃO determinístico (embaralhar a entrada mudou a saída)")

    # ---- 2) fuzz nas estruturas reais
    print("\n== RESPOSTAS ALEATÓRIAS nas estruturas reais (cálculo real × oráculo) ==")
    n_por = args.n
    rng = random.Random(288)
    for nome, e in estruturas.items():
        letras = [d["id"] for d in e["dimensoes"]]
        est_json = {"letra_da_opcao": e["letra_da_opcao"], "blocos": e["blocos"]}
        casos, esperados = [], []
        for k in range(n_por):
            pesos = None
            if k % 2:  # metade das respostas com preferência por algumas letras (perfis de verdade)
                pesos = {d: rng.choice([0.4, 1.0, 1.0, 2.5, 4.0]) for d in letras}
            mais, menos = sortear_escolhas(est_json, rng, pesos)
            casos.append({"estrutura": nome, "mais": mais, "menos": menos})
            esperados.append(oraculo(e["dimensoes"], para_oraculo(e, mais, menos)))
        saidas = rodar_node({nome: e}, casos, embaralhar=2)
        n_dif = n_inv = n_nd = 0
        exemplo = None
        for s, esp in zip(saidas, esperados):
            d = comparar(s["resultado"], esp)
            inv = conferir_invariantes(s["resultado"])
            n_dif += bool(d)
            n_inv += bool(inv)
            n_nd += (not s["deterministico"])
            if (d or inv) and exemplo is None:
                exemplo = (d[:3], inv[:3])
        falhou += (n_dif + n_inv + n_nd) > 0
        print(f"  {nome:14} {n_por} respostas: diferenças={n_dif} invariantes_quebrados={n_inv} não_determinísticos={n_nd}"
              f"{'  ← ' + str(exemplo) if exemplo else ''}")
    print("\nRESULTADO:", "TUDO CERTO" if not falhou else f"{falhou} PROBLEMA(S)")
    return 1 if falhou else 0


# --------------------------------------------------------------------------- comando: simular
def cmd_simular(args):
    print("Quem responde ao ACASO (cada bloco: MAIS e MENOS sorteados). Distância entre 1º e 2º do conjunto:")
    print(f"  combinado = até {LIMITE_COMBINADO} pontos · moderada = {LIMITE_COMBINADO + 1} a {LIMITE_MODERADA} · clara = {LIMITE_MODERADA + 1} ou mais\n")
    rng = random.Random(2809)
    tabela = {}
    for nome, vid in VERSOES.items():
        e = carregar_estrutura(vid)
        est_json = {"letra_da_opcao": e["letra_da_opcao"], "blocos": e["blocos"]}
        maximo = {}
        for b in e["blocos"]:
            for o in b["opcoes"]:
                for d, p in b["pontos"][o]:
                    maximo[d] = maximo.get(d, 0) + p  # cada alternativa vale 1 ponto de UMA letra
        faixas = {"adaptado": [0, 0, 0], "natural": [0, 0, 0]}
        distancias = {"adaptado": {}, "natural": {}}
        for _ in range(args.n):
            mais, menos = sortear_escolhas(est_json, rng)
            m, n = {}, {}
            for o in mais:
                d = e["letra_da_opcao"][o]; m[d] = m.get(d, 0) + 1
            for o in menos:
                d = e["letra_da_opcao"][o]; n[d] = n.get(d, 0) + 1
            for conj, valores in (("adaptado", [m.get(d, 0) for d in maximo]), ("natural", [maximo[d] - n.get(d, 0) for d in maximo])):
                v = sorted(valores, reverse=True)
                dist = v[0] - v[1]
                faixas[conj][0 if dist <= LIMITE_COMBINADO else 1 if dist <= LIMITE_MODERADA else 2] += 1
                distancias[conj][dist] = distancias[conj].get(dist, 0) + 1
        tabela[nome] = (faixas, distancias, len(e["dimensoes"]), len(e["blocos"]))
    for nome, (faixas, distancias, n_letras, n_blocos) in tabela.items():
        print(f"{nome} ({n_letras} letras, {n_blocos} blocos), {args.n} respostas ao acaso:")
        for conj in ("adaptado", "natural"):
            t = sum(faixas[conj])
            print(f"   {conj:8} combinado {faixas[conj][0] / t * 100:5.1f}% · moderada {faixas[conj][1] / t * 100:5.1f}% · clara {faixas[conj][2] / t * 100:5.1f}%")
        acum = 0
        linha = []
        for dist in sorted(distancias["adaptado"]):
            acum += distancias["adaptado"][dist]
            if dist in (0, 1, 2, 3, 4, 5, 6, 8, 10):
                linha.append(f"≤{dist}: {acum / args.n * 100:.0f}%")
        print("   distância do adaptado (acumulado):", " · ".join(linha))
    return 0


# --------------------------------------------------------------------------- comando: vivo
def _post_app(app, caminho, corpo=None):
    req = urllib.request.Request(f"{app}{caminho}", method="POST" if corpo is not None else "GET",
                                 data=None if corpo is None else json.dumps(corpo).encode(),
                                 headers={"Content-Type": "application/json", **UA})
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:300]


def _legado_esperado(est, mais_ids, menos_ids):
    """Fórmula ANTIGA (fica gravada até a 2b, porque o relatório atual lê estes campos)."""
    mais, menos = {}, {}
    for o in mais_ids:
        d = est["letra_da_opcao"][o]; mais[d] = mais.get(d, 0) + 1
    for o in menos_ids:
        d = est["letra_da_opcao"][o]; menos[d] = menos.get(d, 0) + 1
    ids = [d["id"] for d in est["dimensoes"]]
    mx = est["maximo"]
    return {
        "total": {d: mais.get(d, 0) for d in ids if d in mais},
        "natural": {d: mais.get(d, 0) for d in ids if d in mais or d in menos},
        "adaptado": {d: mais.get(d, 0) - menos.get(d, 0) for d in ids if d in mais or d in menos},
        "normalized": {d: {"natural": mais.get(d, 0) / mx[d] * 100, "adaptado": (mais.get(d, 0) - menos.get(d, 0) + mx[d]) / (2 * mx[d]) * 100}
                       for d in ids if d in mx},
    }


def _posicao_repetida_na_tela(est, mais_ids):
    """Fração de blocos em que o MAIS caiu na posição mais repetida — contando a posição NA TELA (sort_order)."""
    cont = {}
    for o, b in zip(mais_ids, est["blocos"]):
        cont[b["opcoes"].index(o)] = cont.get(b["opcoes"].index(o), 0) + 1
    return int(max(cont.values()) / len(mais_ids) * 100 + 0.5) / 100  # arredonda como o motor (Math.round)


def _sem_volatil(rel):
    """Recorte do relatório que não muda de uma resposta para outra com as mesmas escolhas."""
    return {k: rel.get(k) for k in ("is_disc", "is_mbti", "profile", "profile_labels", "perfil_indefinido", "factors", "sections", "derived", "external", "test_title", "instrument_id")}


def _casos_vivos(est, args):
    """[(nome, ids MAIS, ids MENOS, esperado|None)] — os casos do produto (DISC) ou respostas aleatórias."""
    casos = []
    if args.aleatorio:
        est_json = {"letra_da_opcao": est["letra_da_opcao"], "blocos": est["blocos"]}
        letras = [d["id"] for d in est["dimensoes"]]
        for k in range(args.aleatorio):
            rng = random.Random(f"{args.versao}-{k}")  # a mesma resposta em toda execução: dá para comparar motor antigo × novo
            pesos = {d: rng.choice([0.4, 1.0, 1.0, 2.5, 4.0]) for d in letras} if k % 2 else None
            mais, menos = sortear_escolhas(est_json, rng, pesos)
            casos.append((f"r{k:02d}", mais, menos, None))
    else:
        for nome in (args.casos.split(",") if args.casos else list(CASOS)):
            c = CASOS[nome]
            mais, menos = escolhas_do_caso(est, c["mais"], c["menos"], semente=100 + list(CASOS).index(nome))
            casos.append((nome, mais, menos, c["espera"]))
    return casos


LEGADO = ("total", "natural", "adaptado", "normalized", "qualidade")


def cmd_vivo(args):
    est = carregar_estrutura(args.versao)
    v = rest("GET", "test_versions", {"id": f"eq.{args.versao}", "select": "id,mentor_id,instrument_id"})[0]
    deve_ter_ipsativo = v["instrument_id"] in ("disc", "temperamentos", "vak") and not args.sem_ipsativo
    print(f"versão {args.versao} · instrumento '{v['instrument_id']}' · o motor novo "
          f"{'DEVE' if deve_ter_ipsativo else 'NÃO deve'} gravar computed_scores.ipsativo")
    saved = json.load(open(args.comparar_legado, encoding="utf-8")) if args.comparar_legado else None
    coletado = {}
    criados = {"pessoas": [], "respostas": [], "baterias": []}
    ok_geral = True
    empates_diferentes = 0
    posicoes_diferentes = [0]
    try:
        for i, (nome, mais, menos, espera) in enumerate(_casos_vivos(est, args)):
            pessoa = rest("POST", "people", corpo=[{"full_name": f"{PREFIXO} {nome}", "email": f"sim-etapa2a-{i}@exemplo.invalido", "mentor_id": v["mentor_id"]}])[0]
            criados["pessoas"].append(pessoa["id"])
            bateria = rest("POST", "assessment_responses", corpo=[{"mentor_id": v["mentor_id"], "person_id": pessoa["id"], "status": "pending"}])[0]
            criados["baterias"].append(bateria["id"])
            base = {"version_id": args.versao, "person_id": pessoa["id"], "mentor_id": v["mentor_id"], "kind": "self", "assessment_response_id": bateria["id"]}
            resp = rest("POST", "test_responses", corpo=[{**base, "status": "in_progress", "assessment_sort": 0}])[0]
            irma = rest("POST", "test_responses", corpo=[{**base, "status": "pending", "assessment_sort": 1}])[0]
            criados["respostas"] += [resp["id"], irma["id"]]
            if not args.aleatorio or args.detalhe:
                print(f"\n[{nome}] fixture: pessoa={pessoa['id']} bateria={bateria['id']} resposta={resp['id']} irmã-pendente={irma['id']}")

            corpo = {"answers": [{"question_id": b["id"], "payload": {"most_option_id": mais[k], "least_option_id": menos[k]}} for k, b in enumerate(est["blocos"])]}
            http, retorno = _post_app(args.app, f"/api/public/response/{resp['id']}", corpo)
            if http != 200:
                print(f"[{nome}] POST falhou: HTTP {http} {retorno}")
                ok_geral = False
                continue
            gravado = rest("GET", "test_responses", {"id": f"eq.{resp['id']}", "select": "computed_scores,dominant_dimension_id,result_band_id,status,version_id"})[0]
            cs = gravado["computed_scores"] or {}
            problemas = []
            if gravado["status"] != "submitted" or gravado["version_id"] != args.versao:
                problemas.append("status/versão inesperados")

            # --- fórmula antiga continua idêntica (o relatório atual lê estes campos)
            leg = _legado_esperado(est, mais, menos)
            for campo in ("total", "natural", "adaptado", "normalized"):
                d = comparar(cs.get(campo), leg[campo], campo, 1e-7)
                if d:
                    problemas.append(f"legado {campo} ≠ fórmula antiga: {d[:3]}")

            # --- selo de qualidade: "mania de posição" agora é medida na ordem da TELA (antes: ordem física do banco)
            q_ = cs.get("qualidade") or {}
            if "posicao_repetida" in q_ and q_["posicao_repetida"] is not None:
                esperada = _posicao_repetida_na_tela(est, mais)
                if abs(q_["posicao_repetida"] - esperada) > 1e-9:
                    problemas.append(f"qualidade.posicao_repetida {q_['posicao_repetida']} ≠ {esperada} (posição na tela)")

            # --- fórmula nova (só nos instrumentos habilitados) ou ausência dela (Valores etc.)
            ips = cs.get("ipsativo")
            if deve_ter_ipsativo:
                if ips is None:
                    problemas.append("computed_scores.ipsativo ausente")
                else:
                    d = comparar(ips, oraculo(est["dimensoes"], para_oraculo(est, mais, menos)))
                    if d:
                        problemas.append(f"ipsativo difere do oráculo: {d[:4]}")
                    problemas += conferir_invariantes(ips)
                    for k, e_ in (espera or {}).items():
                        if resumo_do_perfil(ips, k) != (e_[0], e_[1], e_[2], e_[3]):
                            problemas.append(f"{k}: perfil {resumo_do_perfil(ips, k)} ≠ esperado {e_}")
                    if (retorno.get("result") or {}).get("ipsativo") != ips:
                        problemas.append("result.ipsativo do POST difere do gravado")
                    if gravado["dominant_dimension_id"] is not None or gravado["result_band_id"] is not None:
                        problemas.append("dominant_dimension_id/result_band_id deveriam ficar vazios (sem leitor)")
            else:
                if ips is not None:
                    problemas.append("ipsativo gravado onde NÃO deveria (trava por instrumento falhou)")
                if gravado["dominant_dimension_id"] is None:
                    problemas.append("dominant_dimension_id deveria continuar sendo gravado neste instrumento")

            # --- o "dominante" que a tela /responder mostra: em empate, vale a ORDEM DA LETRA no instrumento
            #     (antes: a primeira que recebeu MAIS na ordem em que o banco devolvia as perguntas)
            r = retorno.get("result") or {}
            tot = leg["total"]
            if tot:
                topo = max(tot.values())
                esperado_dom = next(d["key"] for d in est["dimensoes"] if tot.get(d["id"]) == topo)
                obtido_dom = (r.get("dominant") or {}).get("key")
                if obtido_dom != esperado_dom:
                    problemas.append(f"result.dominant '{obtido_dom}' ≠ '{esperado_dom}' (desempate pela ordem da letra)")

            # --- o que o POST devolve à tela /responder continua com o formato de sempre
            for campo in ("totals", "normalized", "by_dimension", "dominant", "band", "per_dimension_bands"):
                if campo not in r:
                    problemas.append(f"result.{campo} sumiu do retorno do POST")

            # --- o relatório atual continua montando, e igual ao que o motor antigo produzia
            hrel, rel = _post_app(args.app, f"/api/public/report/{resp['id']}")
            if hrel != 200 or not isinstance(rel, dict):
                problemas.append(f"relatório HTTP {hrel}")
            else:
                coletado[nome] = {"legado": {k: cs.get(k) for k in LEGADO},
                                  "colunas": {"dominant": gravado["dominant_dimension_id"], "faixa": gravado["result_band_id"]},
                                  "totals": cs.get("total"), "relatorio": _sem_volatil(rel)}
                if saved and nome in saved:
                    ant = saved[nome]
                    for campo in LEGADO:
                        novo_, velho_ = coletado[nome]["legado"][campo], ant["legado"][campo]
                        if campo == "qualidade" and novo_ and velho_:
                            # única diferença ESPERADA: o motor antigo media a posição na ordem física do banco
                            novo_, velho_ = dict(novo_), dict(velho_)
                            if novo_.get("posicao_repetida") != velho_.get("posicao_repetida"):
                                posicoes_diferentes[0] += 1
                            novo_.pop("posicao_repetida", None); velho_.pop("posicao_repetida", None)
                        d = comparar(novo_, velho_, campo, 1e-9)
                        if d:
                            problemas.append(f"legado {campo} difere do motor antigo: {d[:3]}")
                    d = comparar(coletado[nome]["relatorio"], ant["relatorio"], "relatorio", 1e-9)
                    if d:
                        problemas.append(f"RELATÓRIO difere do que o motor antigo gerava: {d[:4]}")
                    if not deve_ter_ipsativo:
                        # colunas antigas: só podem mudar num EMPATE (antes decidido pela ordem de leitura do banco)
                        for col in ("dominant", "faixa"):
                            if coletado[nome]["colunas"][col] != ant["colunas"][col]:
                                t = coletado[nome]["totals"] or {}
                                a_, n_ = ant["colunas"]["dominant"], coletado[nome]["colunas"]["dominant"]
                                if col == "dominant" and t.get(a_) == t.get(n_) == max(t.values()):
                                    empates_diferentes += 1
                                elif col == "faixa" and ant["colunas"]["dominant"] != coletado[nome]["colunas"]["dominant"]:
                                    pass  # a faixa acompanha a letra dominante, que mudou por empate
                                else:
                                    problemas.append(f"coluna {col} mudou sem ser empate")

            if not args.aleatorio or args.detalhe or problemas:
                print(f"[{nome}] HTTP {http} · relatório HTTP {hrel} · " + ("TUDO CONFERE" if not problemas else "PROBLEMAS:"))
                if ips and (not args.aleatorio or args.detalhe):
                    for k in ("adaptado", "natural"):
                        p_ = ips[k]["perfil"]
                        print(f"      {k:8} ranking {ips[k]['ranking']} → {p_['tipo']} '{p_['codigo']}' · distância {p_['distancia']} · {p_['faixa']}")
                    print("      expressão:", {l["chave"]: l["expressao"] for l in ips["letras"]})
            for p_ in problemas:
                print("      ✗", p_)
            ok_geral &= not problemas
        if saved:
            print(f"\nComparação com o motor antigo: colunas antigas que mudaram por causa de empate: {empates_diferentes}"
                  f" · respostas em que a mania de posição do selo mudou (ordem da tela × ordem física): {posicoes_diferentes[0]}")
        if args.aleatorio:
            print(f"{args.aleatorio} respostas aleatórias conferidas.")
    finally:
        print("\nLIMPEZA — ids que existiram e serão apagados:")
        print("  respostas:", criados["respostas"])
        print("  baterias :", criados["baterias"])
        print("  pessoas  :", criados["pessoas"])

        def tentar(desc, fn):
            try:
                return fn()
            except BaseException as e:
                print(f"  !! {desc} falhou: {e}")
                return None

        for rid in criados["respostas"]:
            tentar(f"apagar resposta {rid}", lambda rid=rid: rest("DELETE", "test_responses", {"id": f"eq.{rid}"}, retorno=False))
        for bid in criados["baterias"]:
            tentar(f"apagar bateria {bid}", lambda bid=bid: rest("DELETE", "assessment_responses", {"id": f"eq.{bid}"}, retorno=False))
        for pid in criados["pessoas"]:
            tentar(f"apagar pessoa {pid}", lambda pid=pid: rest("DELETE", "people", {"id": f"eq.{pid}"}, retorno=False))
        # a bateria impede o aviso "fulano respondeu"; conferimos e, se algum escapou, apagamos citando o id
        achadas = tentar("procurar notificações", lambda: rest("GET", "notificacoes", {"titulo": f"like.{PREFIXO}*", "select": "id,titulo"})) or []
        print("  notificações de teste encontradas (esperado: nenhuma):", [(n["id"], n["titulo"]) for n in achadas])
        for n in achadas:
            tentar(f"apagar notificação {n['id']}", lambda n=n: rest("DELETE", "notificacoes", {"id": f"eq.{n['id']}"}, retorno=False))

        def contar(tabela, coluna, ids):
            return len(rest("GET", tabela, {coluna: "in.(" + ",".join(ids) + ")", "select": coluna})) if ids else 0
        sobras = {
            "respostas": tentar("conferir respostas", lambda: contar("test_responses", "id", criados["respostas"])),
            "baterias": tentar("conferir baterias", lambda: contar("assessment_responses", "id", criados["baterias"])),
            "pessoas": tentar("conferir pessoas", lambda: contar("people", "id", criados["pessoas"])),
            "answers_orfas": tentar("conferir answers", lambda: contar("test_answers", "response_id", criados["respostas"])),
            "respostas_na_versao": tentar("conferir versão", lambda: len(rest("GET", "test_responses", {"version_id": f"eq.{args.versao}", "select": "id"}))),
        }
        print("SOBRAS após a limpeza (tudo deve ser 0, exceto respostas reais que a versão já tinha):", sobras)
        limpo = all(v_ == 0 for k_, v_ in sobras.items() if k_ != "respostas_na_versao") and (sobras["respostas_na_versao"] or 0) == args.respostas_reais
        ok_geral &= limpo and not achadas

    if args.salvar_legado:
        json.dump(coletado, open(args.salvar_legado, "w", encoding="utf-8"), ensure_ascii=False, indent=1, default=str)
        print("legado salvo em", args.salvar_legado)
    print("\nRESULTADO:", "TUDO CERTO" if ok_geral else "HÁ PROBLEMA")
    return 0 if ok_geral else 1


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("puro"); p.add_argument("--versao-disc"); p.add_argument("-n", type=int, default=1500)
    s = sub.add_parser("simular"); s.add_argument("-n", type=int, default=40000)
    v = sub.add_parser("vivo")
    v.add_argument("--app", required=True); v.add_argument("--versao", required=True); v.add_argument("--casos")
    v.add_argument("--sem-ipsativo", action="store_true"); v.add_argument("--salvar-legado"); v.add_argument("--comparar-legado")
    v.add_argument("--aleatorio", type=int, default=0, help="em vez dos casos do produto, N respostas aleatórias (mesma semente em toda execução)")
    v.add_argument("--detalhe", action="store_true"); v.add_argument("--respostas-reais", type=int, default=0, help="respostas reais que a versão já tem (não são apagadas)")
    a = ap.parse_args()
    sys.exit({"puro": cmd_puro, "simular": cmd_simular, "vivo": cmd_vivo}[a.cmd](a))


if __name__ == "__main__":
    main()
