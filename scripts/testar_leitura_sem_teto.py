#!/usr/bin/env python3
"""
#314 — prova de que o relatório sai COMPLETO com mais de 1.000 textos cadastrados.

A API do banco devolve no máximo 1.000 linhas por consulta e corta o resto SEM AVISAR. Em 27/09 o
relatório lia 607 textos — cabe de qualquer jeito, então comparar relatórios abaixo do teto não prova
nada. Este teste passa do teto DE VERDADE, sem encostar no relatório de ninguém:

  - cria um mentor FICTÍCIO (@exemplo.invalido), uma pessoa dele e uma CÓPIA PRÓPRIA do DISC. Texto
    preso a uma versão só é lido pelos relatórios DAQUELA versão — a versão real nunca recebe nada;
  - responde o DISC pelo mesmo endpoint que o aluno usa;
  - pendura na cópia N textos de ENCHIMENTO: seção `zz_teste_314`, status `pendente` (nunca aparecem em
    relatório nenhum) e ordem -1 — na leitura eles vêm ANTES de todos os textos reais e empurram os reais
    para depois da linha 1.000, que é exatamente o que vai acontecer quando o conteúdo novo entrar;
  - compara o relatório da pessoa fictícia antes e depois do enchimento: tem de sair IGUAL.

Os ids são IMPRESSOS e gravados no arquivo a cada passo, antes de qualquer teste (constituição: "prova
que a limpeza apaga não é prova"). `apagar` cita cada um e confere que não sobrou nada.

Uso (da raiz do projeto; o servidor local em :8080 para `criar`):
  python3 scripts/testar_leitura_sem_teto.py criar ARQ.json [--app URL]     # mentor, pessoa, cópia do DISC, resposta
  python3 scripts/testar_leitura_sem_teto.py bateria ARQ.json               # põe a resposta numa bateria
  python3 scripts/testar_leitura_sem_teto.py encher ARQ.json N              # +N textos de enchimento
  python3 scripts/testar_leitura_sem_teto.py relatorio ARQ.json --app URL [--bateria] [--guardar NOME] [--comparar NOME]
  python3 scripts/testar_leitura_sem_teto.py pdf ARQ.json --app URL [--bateria] [--guardar NOME] [--comparar NOME]
  python3 scripts/testar_leitura_sem_teto.py esvaziar ARQ.json              # tira só o enchimento
  python3 scripts/testar_leitura_sem_teto.py turma ARQ.json                 # presença, Academy e pontos > 1.000
  python3 scripts/testar_leitura_sem_teto.py apagar ARQ.json                # apaga tudo, cita os ids, confere zero

A turma é lida pelas funções das telas em `npx tsx scripts/testar_telas_sem_teto.ts teto ARQ.json`.

O roteiro que provou a #314 (27/09): base com 607 textos → enchimento até 1.057 (o código antigo ainda
saía igual: o corte pegou só textos do Big Five/VAK, que o DISC não usa — número igual não prova nada) →
1.407 (antigo: perdeu 2 seções e 50 descritores, sem erro) → 2.107 (antigo: nenhum texto; novo: idêntico
à base, em 3 partes). PDF: compare dentro do MESMO motor — Node e Cloudflare comprimem diferente e o
arquivo varia uns bytes com o texto idêntico.
"""
import argparse
import json
import os
import random
import sys
import urllib.error
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from testar_ipsativo import carregar_estrutura, rest, _env  # noqa: E402
from ipsativo_oraculo import sortear_escolhas  # noqa: E402
from comparar_relatorios import UA, diferencas, normalizar  # noqa: E402

VERSAO_DISC = "f9c6aba8-115b-4c59-9d35-9c1f995b3eb9"  # a versão real do DISC — só é LIDA, nunca recebe texto
DOMINIO = "@exemplo.invalido"
SECAO = "zz_teste_314"
LOTE = 500


# --------------------------------------------------------------------------- utilidades
def _auth_admin(metodo, caminho, corpo=None):
    url, key = _env()
    req = urllib.request.Request(f"{url}/auth/v1/admin/{caminho}", method=metodo,
                                 data=None if corpo is None else json.dumps(corpo).encode(),
                                 headers={"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            txt = r.read().decode()
            return json.loads(txt) if txt else None
    except urllib.error.HTTPError as e:
        if metodo == "GET" and e.code == 404:
            return None
        raise RuntimeError(f"auth {metodo} {caminho} falhou ({e.code}): {e.read().decode()[:300]}")


def _contar(tabela, filtros):
    """Contagem exata pelo banco (cabeçalho content-range), sem trazer as linhas."""
    url, key = _env()
    q = "&".join(f"{k}={v}" for k, v in filtros.items())
    req = urllib.request.Request(f"{url}/rest/v1/{tabela}?select=id&{q}", method="HEAD",
                                 headers={"apikey": key, "Authorization": f"Bearer {key}", "Prefer": "count=exact"})
    with urllib.request.urlopen(req) as r:
        return int(r.headers["content-range"].split("/")[1])


def _textos_que_o_relatorio_le(versao):
    return _contar("report_content", {"or": f"(version_id.is.null,version_id.eq.{versao})"})


def _ler(arquivo):
    return json.load(open(arquivo))


def _gravador(arquivo, ids):
    def guarda(chave, valor, imprimir=True):
        ids[chave] = valor
        if imprimir:
            print(f"{chave}={valor}")
        with open(arquivo, "w") as f:  # a cada passo: se algo falhar no meio, `apagar` sabe o que existe
            json.dump(ids, f, indent=1)
    return guarda


def _app_get(url):
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=180) as r:
            return r.status, r.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()


# --------------------------------------------------------------------------- criar
def _sem(linha, *fora):
    return {k: v for k, v in linha.items() if k not in ("id", "created_at", "updated_at", *fora)}


def criar(args):
    ids = {"rodada": os.urandom(3).hex()}
    guarda = _gravador(args.arquivo, ids)
    r = ids["rodada"]

    m = _auth_admin("POST", "users", {"email": f"teste-mentor-314-{r}{DOMINIO}", "email_confirm": True,
                                      "user_metadata": {"full_name": "ZZ Mentor Fictício 314"}})["id"]
    guarda("mentor_user", m)
    p = rest("POST", "people", corpo=[{"mentor_id": m, "full_name": "ZZ Pessoa Fictícia 314",
                                       "email": f"teste-pessoa-314-{r}{DOMINIO}"}])[0]
    guarda("pessoa", p["id"])

    # Cópia própria do DISC, do mesmo jeito que a plataforma copia (tests.functions.ts,
    # clonarVersaoParaEdicao), com dono = o mentor fictício. Sem `forked_from_id`: nada liga a cópia à real.
    o = rest("GET", "test_versions", {"id": f"eq.{VERSAO_DISC}", "select": "*"})[0]
    v = rest("POST", "test_versions", corpo=[{
        "instrument_id": o["instrument_id"], "mentor_id": m, "title": "ZZ DISC Fictício 314",
        "description": o["description"], "is_template": False, "is_published": True,
        "is_anonymous": o["is_anonymous"], "has_interpretation": o["has_interpretation"],
        "derived_config": o["derived_config"]}])[0]
    V = v["id"]
    guarda("versao", V)

    dims = rest("GET", "test_dimensions", {"version_id": f"eq.{VERSAO_DISC}", "select": "*", "order": "sort_order,id"})
    novas = rest("POST", "test_dimensions", corpo=[{**_sem(d), "version_id": V} for d in dims])
    mapa_dim = {d["id"]: n["id"] for d, n in zip(dims, novas)}
    secs = rest("GET", "test_sections", {"version_id": f"eq.{VERSAO_DISC}", "select": "*", "order": "sort_order,id"})
    mapa_sec = {}
    if secs:
        novas_s = rest("POST", "test_sections", corpo=[{**_sem(s), "version_id": V, "mentor_id": m} for s in secs])
        mapa_sec = {s["id"]: n["id"] for s, n in zip(secs, novas_s)}
    qs = rest("GET", "test_questions", {"version_id": f"eq.{VERSAO_DISC}", "select": "*", "order": "sort_order,id"})

    def config(c):
        if isinstance(c, dict) and isinstance(c.get("dimension_id"), str):
            return {**c, "dimension_id": mapa_dim.get(c["dimension_id"])}
        return c

    novas_q = rest("POST", "test_questions", corpo=[{**_sem(q), "version_id": V, "config": config(q["config"]),
                                                     "section_id": mapa_sec.get(q["section_id"]) if q["section_id"] else None}
                                                    for q in qs])
    mapa_q = {q["id"]: n["id"] for q, n in zip(qs, novas_q)}
    ops = rest("GET", "test_options", {"question_id": "in.(" + ",".join(mapa_q) + ")", "select": "*", "order": "id"})
    novas_o = rest("POST", "test_options", corpo=[{**_sem(x), "question_id": mapa_q[x["question_id"]]} for x in ops])
    mapa_o = {x["id"]: n["id"] for x, n in zip(ops, novas_o)}
    scs = rest("GET", "option_scores", {"option_id": "in.(" + ",".join(mapa_o) + ")", "select": "*", "order": "id"})
    rest("POST", "option_scores", corpo=[{"option_id": mapa_o[s["option_id"]], "dimension_id": mapa_dim[s["dimension_id"]],
                                          "points": s["points"]} for s in scs], retorno=False)
    bds = rest("GET", "test_result_bands", {"version_id": f"eq.{VERSAO_DISC}", "select": "*", "order": "id"})
    if bds:
        rest("POST", "test_result_bands", corpo=[{**_sem(b), "version_id": V,
                                                  "dimension_id": mapa_dim.get(b["dimension_id"]) if b["dimension_id"] else None}
                                                 for b in bds], retorno=False)
    print(f"  cópia: {len(dims)} dimensões, {len(secs)} seções, {len(qs)} perguntas, {len(ops)} alternativas, "
          f"{len(scs)} pontuações, {len(bds)} faixas")

    # Responde pelo endpoint público, puxando o D (o único perfil com as quatro seções da #302 completas —
    # é o relatório que mais usa texto cadastrado).
    resp = rest("POST", "test_responses", corpo=[{"version_id": V, "person_id": p["id"], "mentor_id": m,
                                                  "kind": "self", "status": "in_progress"}])[0]
    guarda("resposta", resp["id"])
    est = carregar_estrutura(V)
    chave_id = est["id_da_chave"]
    mais, menos = sortear_escolhas({"letra_da_opcao": est["letra_da_opcao"], "blocos": est["blocos"]},
                                   random.Random("leitura-sem-teto-314"),
                                   {chave_id[k]: w for k, w in {"D": 3.0, "I": 1.6, "S": 0.7, "C": 0.5}.items()})
    corpo = {"answers": [{"question_id": b["id"], "payload": {"most_option_id": mais[k], "least_option_id": menos[k]}}
                         for k, b in enumerate(est["blocos"])]}
    req = urllib.request.Request(f"{args.app.rstrip('/')}/api/public/response/{resp['id']}", method="POST",
                                 data=json.dumps(corpo).encode(), headers={"Content-Type": "application/json", **UA})
    with urllib.request.urlopen(req, timeout=180) as r_:
        if r_.status != 200:
            sys.exit(f"não consegui enviar a resposta (HTTP {r_.status})")
    cs = rest("GET", "test_responses", {"id": f"eq.{resp['id']}", "select": "computed_scores,submitted_at"})[0]
    perfil = (((cs["computed_scores"] or {}).get("ipsativo") or {}).get("natural") or {}).get("perfil") or {}
    print(f"  enviada em {cs['submitted_at']}; perfil natural: {perfil.get('codigo')} ({perfil.get('tipo')})")
    print(f"  textos que o relatório desta resposta lê agora: {_textos_que_o_relatorio_le(V)}")
    return 0


# --------------------------------------------------------------------------- encher
def encher(args):
    ids = _ler(args.arquivo)
    guarda = _gravador(args.arquivo, ids)
    V = ids["versao"]
    ja = ids.get("enchimento", [])
    for inicio in range(0, args.n, LOTE):
        n = min(LOTE, args.n - inicio)
        linhas = [{"version_id": V, "section": SECAO, "dimension_key": "ZZ", "mode": "natural", "sort_order": -1,
                   "status": "pendente", "title": "Enchimento da #314",
                   "body": f"Texto de enchimento {len(ja) + inicio + k + 1} da #314: existe só para o total passar de "
                           "1.000 neste teste. Pendente, preso a uma cópia fictícia do DISC — nunca aparece."}
                  for k in range(n)]
        criadas = rest("POST", "report_content", params={"select": "id"}, corpo=linhas)
        ja = ja + [c["id"] for c in criadas]
        guarda("enchimento", ja, imprimir=False)
    print(f"enchimento: {len(ja)} textos presos à versão {V} (seção {SECAO}, status pendente); "
          f"primeiro {ja[0]}, último {ja[-1]} — todos os ids em {args.arquivo}")
    print(f"textos que o relatório desta resposta lê agora: {_textos_que_o_relatorio_le(V)}")
    return 0


# --------------------------------------------------------------------------- turma (Classroom, Academy, pontos)
def _iso(d):
    return d.astimezone(__import__("datetime").timezone.utc).isoformat()


def _em_lotes(tabela, linhas):
    ids = []
    for i in range(0, len(linhas), LOTE):
        ids += [x["id"] for x in rest("POST", tabela, params={"select": "id"}, corpo=linhas[i:i + LOTE])]
    return ids


def turma(args):
    """As outras leituras que a #314 trata, cada uma com MAIS DE 1.000 linhas na conta fictícia:
      - presença: 21 alunos × 48 aulas fechadas = 1.008 presenças (o banco só aceita uma por aluno por aula,
        e poucas aulas mantêm curta a lista de ids que vai no endereço da consulta);
      - Academy: 2 alunos com login × 600 aulas vistas = 1.200 marcações numa trilha (com 501 aulas o corte
        seria de 2 linhas e a régua arredondaria 99,6% para 100% — o erro existiria sem aparecer);
      - pontos: 1.001 registros de 1 ponto para o primeiro aluno com login.
    Régua de conclusão em 100%: quem perde UMA linha para o teto deixa de concluir — o corte aparece."""
    import datetime as dt
    import uuid
    ids = _ler(args.arquivo)
    guarda = _gravador(args.arquivo, ids)
    m, r = ids["mentor_user"], ids["rodada"]
    agora = dt.datetime.now(dt.timezone.utc)

    logins = [_auth_admin("POST", "users", {"email": f"teste-aluno{n}-314-{r}{DOMINIO}", "email_confirm": True,
                                            "user_metadata": {"full_name": f"ZZ Aluno {n} 314"}})["id"] for n in (1, 2)]
    guarda("alunos_login", logins)
    pessoas = _em_lotes("people", [{"mentor_id": m, "full_name": f"ZZ Aluno {n:02d} 314", "email": f"teste-aluno{n:02d}-314-{r}{DOMINIO}",
                                    "user_id": logins[n - 1] if n <= 2 else None} for n in range(1, 22)])
    guarda("turma_pessoas", pessoas, imprimir=False)
    print(f"turma_pessoas: {len(pessoas)} cadastros (os 2 primeiros com login)")
    g = rest("POST", "groups", corpo=[{"mentor_id": m, "name": "ZZ Turma 314"}])[0]
    guarda("turma_grupo", g["id"])
    rest("POST", "group_members", corpo=[{"group_id": g["id"], "person_id": p, "added_at": _iso(agora - dt.timedelta(days=60))}
                                         for p in pessoas], retorno=False)

    t = rest("POST", "treinamentos", corpo=[{"mentor_id": m, "titulo": "ZZ Treinamento 314", "publicado": True,
                                             "percentual_minimo": 100, "tolerancia_atraso_min": 15}])[0]
    guarda("treinamento", t["id"])
    rest("POST", "treinamento_grupos", corpo=[{"treinamento_id": t["id"], "group_id": g["id"]}], retorno=False)
    mod = rest("POST", "treinamento_modulos", corpo=[{"treinamento_id": t["id"], "titulo": "Módulo 314", "ordem": 1}])[0]
    guarda("treinamento_modulo", mod["id"])
    aulas = []
    for k in range(48):
        inicio = (agora - dt.timedelta(days=49 - k)).replace(hour=22, minute=0, second=0, microsecond=0)
        aulas.append({"modulo_id": mod["id"], "titulo": f"ZZ AULA {k + 1:02d} 314", "ordem": k + 1, "comeca_em": _iso(inicio),
                      "termina_em": _iso(inicio + dt.timedelta(hours=2)), "fechada_em": _iso(inicio + dt.timedelta(hours=3))})
    aula_ids = _em_lotes("treinamento_aulas", aulas)
    guarda("treinamento_aulas", aula_ids, imprimir=False)
    pres = _em_lotes("treinamento_presencas", [{"aula_id": a, "person_id": p, "group_id": g["id"], "origem": "manual",
                                                "situacao": "presente"} for a in aula_ids for p in pessoas])
    guarda("presencas", pres, imprimir=False)
    print(f"treinamento {t['id']}: {len(aula_ids)} aulas fechadas, {len(pres)} presenças (todos presentes em todas)")

    tr = rest("POST", "learning_tracks", corpo=[{"owner_id": m, "title": "ZZ Trilha 314", "audience": "alunos",
                                                 "is_published": True, "percentual_minimo": 100}])[0]
    guarda("trilha", tr["id"])
    lm = rest("POST", "learning_modules", corpo=[{"track_id": tr["id"], "title": "Módulo 314"}])[0]
    guarda("trilha_modulo", lm["id"])
    licoes = _em_lotes("learning_lessons", [{"track_id": tr["id"], "module_id": lm["id"], "title": f"ZZ Aula {k + 1:03d} 314",
                                             "is_published": True, "sort_order": k + 1} for k in range(600)])
    guarda("trilha_aulas", licoes, imprimir=False)
    prog = _em_lotes("learning_progress", [{"lesson_id": l, "track_id": tr["id"], "user_id": u} for u in logins for l in licoes])
    guarda("marcacoes", prog, imprimir=False)
    print(f"trilha {tr['id']}: {len(licoes)} aulas publicadas, {len(prog)} marcações (os 2 alunos viram todas)")

    pts = _em_lotes("pontos", [{"user_id": logins[0], "mentor_id": m, "acao": "curtir", "pontos": 1,
                                "referencia": str(uuid.uuid4())} for _ in range(1001)])
    guarda("pontos", pts, imprimir=False)
    print(f"pontos: {len(pts)} registros de 1 ponto para {logins[0]} (total certo = {len(pts)})")
    return 0


# --------------------------------------------------------------------------- bateria / esvaziar
def bateria(args):
    """Põe a resposta fictícia numa bateria própria: o relatório de bateria chama o mesmo montador por
    etapa, e a prova precisa passar por ele também."""
    ids = _ler(args.arquivo)
    guarda = _gravador(args.arquivo, ids)
    cs = rest("GET", "test_responses", {"id": f"eq.{ids['resposta']}", "select": "started_at,submitted_at"})[0]
    b = rest("POST", "assessment_responses", corpo=[{"mentor_id": ids["mentor_user"], "person_id": ids["pessoa"],
                                                     "status": "submitted", "started_at": cs["started_at"],
                                                     "submitted_at": cs["submitted_at"]}])[0]
    guarda("bateria", b["id"])
    rest("PATCH", "test_responses", {"id": f"eq.{ids['resposta']}"},
         corpo={"assessment_response_id": b["id"], "assessment_sort": 0}, retorno=False)
    print(f"  resposta {ids['resposta']} ligada à bateria {b['id']}")
    return 0


def esvaziar(args):
    """Tira SÓ o enchimento (volta aos textos reais), citando quantos e conferindo os ids."""
    ids = _ler(args.arquivo)
    guarda = _gravador(args.arquivo, ids)
    V = ids["versao"]
    apagados = rest("DELETE", "report_content", {"version_id": f"eq.{V}", "section": f"eq.{SECAO}", "select": "id"}) or []
    gravados = ids.get("enchimento", [])
    conferem = set(x["id"] for x in apagados) == set(gravados)
    print(f"enchimento apagado: {len(apagados)} textos ({'os mesmos ids gravados' if conferem else 'ATENÇÃO: diferente do gravado'})")
    guarda("enchimento_apagado", ids.get("enchimento_apagado", []) + gravados, imprimir=False)
    guarda("enchimento", [], imprimir=False)
    print(f"textos que o relatório desta resposta lê agora: {_textos_que_o_relatorio_le(V)}")
    return 0


# --------------------------------------------------------------------------- pdf
def pdf(args):
    """Baixa o PDF gerado no servidor (mesma entrada = mesmos bytes, #293) e compara byte a byte."""
    import hashlib
    ids = _ler(args.arquivo)
    pasta = os.path.dirname(os.path.abspath(args.arquivo))
    caminho = f"/api/pdf/bateria/{ids['bateria']}" if args.bateria else f"/api/pdf/relatorio/{ids['resposta']}"
    st, corpo = _app_get(f"{args.app.rstrip('/')}{caminho}")
    print(f"textos que o relatório lê no banco: {_textos_que_o_relatorio_le(ids['versao'])}")
    if st != 200 or not corpo.startswith(b"%PDF"):
        print(f"HTTP {st}: {corpo[:300]!r}")
        return 1
    paginas = corpo.count(b"/Type /Page\n") or corpo.count(b"/Type /Page ") or corpo.count(b"/Type/Page")
    print(f"HTTP 200 — PDF de {len(corpo)} bytes, sha256 {hashlib.sha256(corpo).hexdigest()[:16]}")
    if args.guardar:
        open(os.path.join(pasta, f"{args.guardar}.pdf"), "wb").write(corpo)
        print(f"guardado como {args.guardar}.pdf")
    if args.comparar:
        base = open(os.path.join(pasta, f"{args.comparar}.pdf"), "rb").read()
        if base == corpo:
            print(f"IDÊNTICO byte a byte a {args.comparar}.pdf")
            return 0
        print(f"DIFERENTE de {args.comparar}.pdf ({len(base)} × {len(corpo)} bytes)")
        return 1
    return 0


# --------------------------------------------------------------------------- relatorio
def _resumo(p):
    fatores = p.get("factors") or []
    der = p.get("derived") or {}
    lid = der.get("leadership_content") or {}
    intens = p.get("intensidade") or {}
    return {
        "perfil": p.get("profile"),
        "secoes_do_perfil": len(p.get("sections") or []),
        "descritores": sum(len(f.get("descritores") or []) for f in fatores),
        "faixas_com_texto": sum(1 for f in fatores if f.get("band_natural")),
        "lideranca": sum(1 for k in ("strengths", "attention") if lid.get(k)),
        "texto_do_perfil": (intens.get("texto") or {}).get("estado"),
        "swot": "swot_comunicador" in p,
        "ganhos_perdas": "ganhos_perdas" in p,
        "onde_aparece": "onde_aparece" in p,
        "comunicadores": "comunicadores_semelhantes" in p,
    }


def relatorio(args):
    ids = _ler(args.arquivo)
    pasta = os.path.dirname(os.path.abspath(args.arquivo))
    caminho = f"/api/public/report-bateria/{ids['bateria']}" if args.bateria else f"/api/public/report/{ids['resposta']}"
    st, corpo = _app_get(f"{args.app.rstrip('/')}{caminho}")
    texto = normalizar(corpo)
    print(f"textos que o relatório lê no banco: {_textos_que_o_relatorio_le(ids['versao'])}")
    print(f"HTTP {st}")
    if st != 200:
        print(texto[:300])
        return 1
    dados = json.loads(texto)
    partes = dados.get("parts") if args.bateria else [dados]
    for p in partes or []:
        print("resumo:", json.dumps(_resumo(p), ensure_ascii=False))
    if args.guardar:
        open(os.path.join(pasta, f"{args.guardar}.json"), "w").write(texto)
        print(f"guardado como {args.guardar}")
    if args.comparar:
        base = open(os.path.join(pasta, f"{args.comparar}.json")).read()
        if base == texto:
            print(f"IDÊNTICO byte a byte a {args.comparar}")
            return 0
        d = diferencas(json.loads(base), dados)
        print(f"DIFERENTE de {args.comparar} em {len(d)} campo(s):")
        for x in d[:25]:
            print("  ", x)
        return 1
    return 0


# --------------------------------------------------------------------------- apagar
def apagar(args):
    ids = _ler(args.arquivo)
    V, resp, pessoa, m = ids.get("versao"), ids.get("resposta"), ids.get("pessoa"), ids.get("mentor_user")
    print(f"rodada {ids.get('rodada')}")
    if V:
        enchimento = ids.get("enchimento", [])
        apagados = rest("DELETE", "report_content", {"version_id": f"eq.{V}", "section": f"eq.{SECAO}", "select": "id"}) or []
        conferem = set(x["id"] for x in apagados) == set(enchimento)
        print(f"  report_content: {len(apagados)} textos de enchimento apagados (versão {V}); "
              f"{'os mesmos ids gravados' if conferem else 'ATENÇÃO: diferente do que foi gravado'}")
        outros = rest("DELETE", "report_content", {"version_id": f"eq.{V}", "select": "id"}) or []
        if outros:
            print(f"  report_content: mais {len(outros)} textos da versão fictícia apagados: {[x['id'] for x in outros]}")
    logins = ids.get("alunos_login", [])

    def fora(tabela, filtro, gravados=None, rotulo=""):
        """Apaga pelo filtro e confere contra o que foi gravado (quantos, e os mesmos ids quando couber)."""
        apagados = rest("DELETE", tabela, {**filtro, "select": "id"}) or []
        nota = ""
        if gravados is not None:
            nota = " — os mesmos ids gravados" if set(x["id"] for x in apagados) == set(gravados) else " — ATENÇÃO: diferente do gravado"
        print(f"  {tabela}: {len(apagados)} apagada(s) {rotulo}{nota}")

    if m:
        # As telas "Quem concluiu" EMITEM certificado ao serem abertas — no teste da turma, só na conta fictícia.
        certs = rest("DELETE", "certificados", {"conta_id": f"eq.{m}", "select": "id"}) or []
        if certs:
            print(f"  certificados emitidos no teste (conta fictícia): {len(certs)} apagados — {[c['id'] for c in certs]}")
    if ids.get("pontos") is not None and logins:
        fora("pontos", {"user_id": f"in.({','.join(logins)})", "mentor_id": f"eq.{m}"}, ids["pontos"], "(pontos da turma)")
    if ids.get("trilha"):
        tr = ids["trilha"]
        fora("learning_progress", {"track_id": f"eq.{tr}"}, ids.get("marcacoes"), f"(trilha {tr})")
        fora("learning_lessons", {"track_id": f"eq.{tr}"}, ids.get("trilha_aulas"), f"(trilha {tr})")
        fora("learning_modules", {"track_id": f"eq.{tr}"}, [ids["trilha_modulo"]] if ids.get("trilha_modulo") else None)
        fora("learning_tracks", {"id": f"eq.{tr}"}, [tr])
    if ids.get("treinamento"):
        t = ids["treinamento"]
        aulas = ids.get("treinamento_aulas", [])
        if aulas:
            fora("treinamento_presencas", {"aula_id": f"in.({','.join(aulas)})"}, ids.get("presencas"), f"(treinamento {t})")
            fora("treinamento_aulas", {"modulo_id": f"eq.{ids['treinamento_modulo']}"}, aulas)
        rest("DELETE", "treinamento_grupos", {"treinamento_id": f"eq.{t}"}, retorno=False)
        fora("treinamento_modulos", {"treinamento_id": f"eq.{t}"}, [ids["treinamento_modulo"]] if ids.get("treinamento_modulo") else None)
        fora("treinamentos", {"id": f"eq.{t}"}, [t])
    if ids.get("turma_grupo"):
        rest("DELETE", "group_members", {"group_id": f"eq.{ids['turma_grupo']}"}, retorno=False)
        fora("groups", {"id": f"eq.{ids['turma_grupo']}"}, [ids["turma_grupo"]])
    if ids.get("turma_pessoas"):
        fora("people", {"mentor_id": f"eq.{m}", "id": f"neq.{pessoa}"}, ids["turma_pessoas"], "(cadastros da turma)")
    if m:
        avisos = (rest("DELETE", "notificacoes", {"conta_id": f"eq.{m}", "select": "id"}) or []) + \
                 (rest("DELETE", "notificacoes", {"user_id": f"in.({','.join([m] + logins)})", "select": "id"}) or [])
        if avisos:
            print(f"  notificacoes da conta fictícia apagadas: {[x['id'] for x in avisos]}")
    if resp:
        rest("DELETE", "test_responses", {"id": f"eq.{resp}"}, retorno=False)
        print(f"  test_responses {resp} apagada")
    if ids.get("bateria"):
        fora("assessment_responses", {"id": f"eq.{ids['bateria']}"}, [ids["bateria"]])
    if V:
        rest("DELETE", "test_versions", {"id": f"eq.{V}"}, retorno=False)
        print(f"  test_versions {V} apagada (dimensões, perguntas, alternativas, pontuações e faixas vão junto)")
    if pessoa:
        rest("DELETE", "people", {"id": f"eq.{pessoa}"}, retorno=False)
        print(f"  people {pessoa} apagada")
    for u in logins:
        _auth_admin("DELETE", f"users/{u}")
        print(f"  login fictício de aluno {u} apagado")
    if m:
        _auth_admin("DELETE", f"users/{m}")
        print(f"  login fictício {m} apagado")

    # Conferência: nada pode ter sobrado.
    sobras = {
        "report_content da versão": _contar("report_content", {"version_id": f"eq.{V}"}) if V else 0,
        "report_content na seção de teste": _contar("report_content", {"section": f"eq.{SECAO}"}),
        "test_versions": _contar("test_versions", {"id": f"eq.{V}"}) if V else 0,
        "test_dimensions da versão": _contar("test_dimensions", {"version_id": f"eq.{V}"}) if V else 0,
        "test_questions da versão": _contar("test_questions", {"version_id": f"eq.{V}"}) if V else 0,
        "test_responses": _contar("test_responses", {"id": f"eq.{resp}"}) if resp else 0,
        "people": _contar("people", {"id": f"eq.{pessoa}"}) if pessoa else 0,
        "notificacoes da conta": _contar("notificacoes", {"conta_id": f"eq.{m}"}) if m else 0,
        "people da conta fictícia": _contar("people", {"mentor_id": f"eq.{m}"}) if m else 0,
        "pontos da conta fictícia": _contar("pontos", {"mentor_id": f"eq.{m}"}) if m else 0,
        "treinamentos da conta fictícia": _contar("treinamentos", {"mentor_id": f"eq.{m}"}) if m else 0,
        "presenças do treinamento": _contar("treinamento_presencas", {"aula_id": f"in.({','.join(ids['treinamento_aulas'])})"})
        if ids.get("treinamento_aulas") else 0,
        "trilhas da conta fictícia": _contar("learning_tracks", {"owner_id": f"eq.{m}"}) if m else 0,
        "marcações da trilha": _contar("learning_progress", {"track_id": f"eq.{ids['trilha']}"}) if ids.get("trilha") else 0,
        "grupos da conta fictícia": _contar("groups", {"mentor_id": f"eq.{m}"}) if m else 0,
        "baterias da conta fictícia": _contar("assessment_responses", {"mentor_id": f"eq.{m}"}) if m else 0,
        "certificados da conta fictícia": _contar("certificados", {"conta_id": f"eq.{m}"}) if m else 0,
        "login": 0 if not m or _auth_admin("GET", f"users/{m}") is None else 1,
        "logins de aluno": sum(0 if _auth_admin("GET", f"users/{u}") is None else 1 for u in logins),
    }
    for k, v in sobras.items():
        print(f"  sobrou em {k}: {v}")
    total = sum(sobras.values())
    print("LIMPO: nada sobrou" if total == 0 else f"ATENÇÃO: sobraram {total} linha(s)")
    return 0 if total == 0 else 1


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    c = sub.add_parser("criar"); c.add_argument("arquivo"); c.add_argument("--app", default="http://localhost:8080")
    e = sub.add_parser("encher"); e.add_argument("arquivo"); e.add_argument("n", type=int)
    r = sub.add_parser("relatorio"); r.add_argument("arquivo"); r.add_argument("--app", required=True)
    r.add_argument("--guardar"); r.add_argument("--comparar"); r.add_argument("--bateria", action="store_true")
    p = sub.add_parser("pdf"); p.add_argument("arquivo"); p.add_argument("--app", required=True)
    p.add_argument("--guardar"); p.add_argument("--comparar"); p.add_argument("--bateria", action="store_true")
    b = sub.add_parser("bateria"); b.add_argument("arquivo")
    t = sub.add_parser("turma"); t.add_argument("arquivo")
    v = sub.add_parser("esvaziar"); v.add_argument("arquivo")
    a = sub.add_parser("apagar"); a.add_argument("arquivo")
    args = ap.parse_args()
    sys.exit({"criar": criar, "encher": encher, "relatorio": relatorio, "pdf": pdf, "bateria": bateria,
              "turma": turma, "esvaziar": esvaziar, "apagar": apagar}[args.cmd](args))


if __name__ == "__main__":
    main()
