"""
Temperamentos — versão nova com as 7 alternativas da curadoria de 24/09/2026 (CONTEUDO_Temperamentos.md).

Mudar alternativa MUDA O INSTRUMENTO: a mesma regra do sprint DISC — a versão atual não é editada (quem já
respondeu continua com o que foi calculado na hora); nasce uma CÓPIA com as alternativas novas, que é
publicada, e a antiga é despublicada.

A cópia é feita EXATAMENTE como o editor do app faz ao editar um teste já respondido (`clonarVersaoParaEdicao`
em `src/lib/tests.functions.ts`): versão (não-modelo, em rascunho, `forked_from_id` = a antiga), dimensões,
seções, perguntas (config com a dimensão remapeada), alternativas, pontuações e faixas. Se algo falhar no
meio, a cópia é apagada — nunca fica teste pela metade.

Uso (da raiz do projeto):
  python3 scripts/temperamentos_versao_nova.py conferir               # só lê: acha as 7 alternativas de hoje
  python3 scripts/temperamentos_versao_nova.py criar ARQ.json         # cria a cópia em RASCUNHO + troca as 7
  python3 scripts/temperamentos_versao_nova.py publicar ARQ.json      # publica a nova, despublica a antiga
  python3 scripts/temperamentos_versao_nova.py desfazer ARQ.json      # volta: republica a antiga, despublica a nova
"""
import json
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from testar_ipsativo import rest  # noqa: E402

VERSAO_ATUAL = "58927961-a8de-4a60-8928-860f0c9e7788"  # "Temperamentos — Template Padrão", 24/07/2026

# (bloco, dimensão, texto de hoje, texto novo) — o ponto final segue o padrão de todas as alternativas.
TROCAS = [
    (1, "FLE", "Absorvo e sigo, quase sem mudar de cara.", "Sinto, mas mantenho o equilíbrio."),
    (4, "FLE", "Nem sempre a pessoa percebe que eu me magoei.", "Deixo passar sem que vire assunto."),
    (7, "FLE", "Escuto mais do que falo.", "Escuto primeiro e falo quando tenho o que dizer."),
    (9, "MEL", "Fico com aquilo entalado por muito tempo.", "Levo a sério e demoro a virar a página."),
    (10, "FLE", "Não me incomodo nem um pouco.", "Uso o tempo sem pressa."),
    (11, "FLE", "Deixo quieto, não vale a briga.", "Escolho não entrar nessa."),
    (17, "MEL", "Fico pensando se foi por minha causa.", "Reviso o que eu poderia ter feito diferente."),
]


def _estrutura(vid):
    """Tudo o que define o instrumento, na ordem estável (nada de confiar na ordem do banco)."""
    versao = rest("GET", "test_versions", {"id": f"eq.{vid}", "select": "*"})[0]
    dims = rest("GET", "test_dimensions", {"version_id": f"eq.{vid}", "select": "*", "order": "sort_order.asc,id.asc"})
    secs = rest("GET", "test_sections", {"version_id": f"eq.{vid}", "select": "*", "order": "sort_order.asc,id.asc"})
    qs = rest("GET", "test_questions", {"version_id": f"eq.{vid}", "select": "*", "order": "sort_order.asc,id.asc"})
    ops = rest("GET", "test_options", {"question_id": "in.(" + ",".join(q["id"] for q in qs) + ")", "select": "*",
                                        "order": "question_id.asc,sort_order.asc,id.asc"}) if qs else []
    scs = rest("GET", "option_scores", {"option_id": "in.(" + ",".join(o["id"] for o in ops) + ")", "select": "*"}) if ops else []
    bands = rest("GET", "test_result_bands", {"version_id": f"eq.{vid}", "select": "*", "order": "sort_order.asc,id.asc"})
    return versao, dims, secs, qs, ops, scs, bands


def _alvo_das_trocas(dims, qs, ops, scs, textos):
    """Para cada troca, a alternativa (única) com aquele texto, no bloco e na dimensão certos."""
    chave_dim = {d["id"]: d["key"] for d in dims}
    bloco_da_q = {q["id"]: q["sort_order"] for q in qs}
    dims_da_op = {}
    for s in scs:
        dims_da_op.setdefault(s["option_id"], set()).add(chave_dim[s["dimension_id"]])
    alvos = []
    for bloco, dim, hoje, novo in TROCAS:
        texto = hoje if textos == "hoje" else novo
        achadas = [o for o in ops if o["label"] == texto]
        assert len(achadas) == 1, f"bloco {bloco}: '{texto}' aparece {len(achadas)} vez(es) — esperava 1"
        o = achadas[0]
        assert bloco_da_q[o["question_id"]] == bloco, f"'{texto}' está no bloco {bloco_da_q[o['question_id']]}, não no {bloco}"
        assert dims_da_op.get(o["id"]) == {dim}, f"'{texto}' pontua {dims_da_op.get(o['id'])}, não só {dim}"
        alvos.append((o, bloco, dim, hoje, novo))
    return alvos


def conferir():
    _, dims, _, qs, ops, scs, _ = _estrutura(VERSAO_ATUAL)
    for o, bloco, dim, hoje, novo in _alvo_das_trocas(dims, qs, ops, scs, "hoje"):
        print(f"bloco {bloco:>2} ({dim}): '{hoje}'  →  '{novo}'   [alternativa {o['id']}]")
    print("as 7 alternativas de hoje estão no lugar certo")


def _assinatura(dims, secs, qs, ops, scs, bands):
    """O instrumento sem ids: o que precisa sair IGUAL na cópia (menos as 7 alternativas)."""
    chave_dim = {d["id"]: d["key"] for d in dims}
    titulo_sec = {s["id"]: (s["sort_order"], s["title"]) for s in secs}
    pos_q = {q["id"]: q["sort_order"] for q in qs}
    pontos = {}
    for s in scs:
        pontos.setdefault(s["option_id"], []).append((chave_dim[s["dimension_id"]], float(s["points"])))

    def cfg(c):
        if isinstance(c, dict) and isinstance(c.get("dimension_id"), str):
            c = {**c, "dimension_id": chave_dim.get(c["dimension_id"])}
        return json.dumps(c, sort_keys=True, ensure_ascii=False)

    return {
        "dims": sorted((d["key"], d["label"], d["description"], d["color"], d["sort_order"]) for d in dims),
        "secs": sorted((s["sort_order"], s["title"], s["description"]) for s in secs),
        "qs": sorted((q["sort_order"], q["type"], q["prompt"], q["helper"], q["required"], cfg(q["config"]),
                      titulo_sec.get(q["section_id"])) for q in qs),
        "ops": sorted((pos_q[o["question_id"]], o["sort_order"], o["label"], o["value"],
                       tuple(sorted(pontos.get(o["id"], [])))) for o in ops),
        "bands": sorted((chave_dim.get(b["dimension_id"]), b["mode"], b["min_score"], b["max_score"], b["title"],
                         b["description"], b["sort_order"]) for b in bands),
    }


def criar(arquivo):
    atual = rest("GET", "test_versions", {"id": f"eq.{VERSAO_ATUAL}", "select": "id,is_published"})[0]
    assert atual["is_published"], "a versão atual não está publicada — algo mudou, pare e confira"
    ja = rest("GET", "test_versions", {"forked_from_id": f"eq.{VERSAO_ATUAL}", "select": "id"})
    assert not ja, f"já existe cópia desta versão: {ja} — não crio outra"
    versao, dims, secs, qs, ops, scs, bands = _estrutura(VERSAO_ATUAL)
    alvos = _alvo_das_trocas(dims, qs, ops, scs, "hoje")

    nova = rest("POST", "test_versions", corpo=[{
        "instrument_id": versao["instrument_id"], "mentor_id": versao["mentor_id"], "title": versao["title"],
        "description": versao["description"], "is_template": False, "is_published": False,
        "is_anonymous": versao["is_anonymous"], "has_interpretation": versao["has_interpretation"],
        "forked_from_id": versao["id"],
    }])[0]
    ids = {"versao_antiga": VERSAO_ATUAL, "versao_nova": nova["id"]}
    with open(arquivo, "w") as f:
        json.dump(ids, f, indent=2)
    print("versão nova (rascunho):", nova["id"])
    try:
        # Mapas antigo → novo pela CHAVE natural (não pela ordem em que o banco devolve as linhas).
        mdim = {}
        if dims:
            novas = rest("POST", "test_dimensions", corpo=[{
                "version_id": nova["id"], "key": d["key"], "label": d["label"], "description": d["description"],
                "color": d["color"], "sort_order": d["sort_order"]} for d in dims])
            por_chave = {d["key"]: d["id"] for d in novas}
            mdim = {d["id"]: por_chave[d["key"]] for d in dims}
        msec = {}
        if secs:
            novas = rest("POST", "test_sections", corpo=[{
                "version_id": nova["id"], "title": s["title"], "description": s["description"],
                "sort_order": s["sort_order"]} for s in secs])
            por_pos = {(s["sort_order"], s["title"]): s["id"] for s in novas}
            msec = {s["id"]: por_pos[(s["sort_order"], s["title"])] for s in secs}

        def remap(c):
            if isinstance(c, dict) and isinstance(c.get("dimension_id"), str):
                return {**c, "dimension_id": mdim.get(c["dimension_id"])}
            return c

        novas_q = rest("POST", "test_questions", corpo=[{
            "version_id": nova["id"], "type": q["type"], "prompt": q["prompt"], "helper": q["helper"],
            "required": q["required"], "sort_order": q["sort_order"], "config": remap(q["config"]),
            "section_id": msec.get(q["section_id"]) if q["section_id"] else None} for q in qs])
        assert len({q["sort_order"] for q in qs}) == len(qs), "bloco com ordem repetida — não dá para mapear"
        q_por_pos = {q["sort_order"]: q["id"] for q in novas_q}
        mq = {q["id"]: q_por_pos[q["sort_order"]] for q in qs}
        novas_o = rest("POST", "test_options", corpo=[{
            "question_id": mq[o["question_id"]], "label": o["label"], "value": o["value"],
            "sort_order": o["sort_order"]} for o in ops])
        o_por_chave = {(o["question_id"], o["sort_order"]): o["id"] for o in novas_o}
        assert len(o_por_chave) == len(ops), "alternativa com ordem repetida no mesmo bloco — não dá para mapear"
        mo = {o["id"]: o_por_chave[(mq[o["question_id"]], o["sort_order"])] for o in ops}
        if scs:
            rest("POST", "option_scores", corpo=[{
                "option_id": mo[s["option_id"]], "dimension_id": mdim[s["dimension_id"]],
                "points": s["points"]} for s in scs], retorno=False)
        if bands:
            rest("POST", "test_result_bands", corpo=[{
                "version_id": nova["id"], "dimension_id": mdim.get(b["dimension_id"]) if b["dimension_id"] else None,
                "min_score": b["min_score"], "max_score": b["max_score"], "title": b["title"],
                "description": b["description"], "sort_order": b["sort_order"], "mode": b["mode"]} for b in bands],
                retorno=False)
        # As 7 trocas, na CÓPIA.
        for o, bloco, dim, hoje, novo in alvos:
            feito = rest("PATCH", "test_options", {"id": f"eq.{mo[o['id']]}"}, corpo={"label": novo})
            assert feito and feito[0]["label"] == novo, f"bloco {bloco}: a troca não foi gravada"
            print(f"  bloco {bloco:>2} ({dim}): trocada na cópia [{mo[o['id']]}]")
    except Exception:
        rest("DELETE", "test_versions", {"id": f"eq.{nova['id']}"}, retorno=False)
        print("falhou no meio — a cópia foi apagada inteira")
        raise
    verificar(arquivo)


def verificar(arquivo):
    ids = json.load(open(arquivo))
    antes = _assinatura(*_estrutura(ids["versao_antiga"])[1:])
    depois = _assinatura(*_estrutura(ids["versao_nova"])[1:])
    for parte in ("dims", "secs", "qs", "bands"):
        assert antes[parte] == depois[parte], f"{parte} diferente entre a antiga e a cópia"
    trocadas = {(b, hoje): novo for b, _, hoje, novo in TROCAS}
    esperado = sorted((pos, so, trocadas.get((pos, label), label), val, pts) for pos, so, label, val, pts in antes["ops"])
    assert esperado == depois["ops"], "alternativas/pontuações diferentes além das 7 trocas"
    n_ops = len(antes["ops"])
    print(f"conferido: dimensões {len(antes['dims'])}, seções {len(antes['secs'])}, blocos {len(antes['qs'])}, "
          f"alternativas {n_ops} (mesmas pontuações), faixas {len(antes['bands'])} — IGUAIS, menos as 7 alternativas")


def publicar(arquivo):
    ids = json.load(open(arquivo))
    verificar(arquivo)
    nova = rest("PATCH", "test_versions", {"id": f"eq.{ids['versao_nova']}"}, corpo={"is_published": True})
    assert nova and nova[0]["is_published"], "a nova não ficou publicada"
    # Só depois de a nova estar no ar a antiga sai — nunca fica um instante sem versão publicada.
    antiga = rest("PATCH", "test_versions", {"id": f"eq.{ids['versao_antiga']}"}, corpo={"is_published": False})
    assert antiga and not antiga[0]["is_published"], "a antiga não foi despublicada"
    print(f"publicada {ids['versao_nova']} · despublicada {ids['versao_antiga']}")


def desfazer(arquivo):
    ids = json.load(open(arquivo))
    rest("PATCH", "test_versions", {"id": f"eq.{ids['versao_antiga']}"}, corpo={"is_published": True}, retorno=False)
    rest("PATCH", "test_versions", {"id": f"eq.{ids['versao_nova']}"}, corpo={"is_published": False}, retorno=False)
    print(f"republicada {ids['versao_antiga']} · despublicada {ids['versao_nova']} (a cópia continua existindo)")


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    if cmd == "conferir":
        conferir()
    elif cmd in ("criar", "publicar", "desfazer", "verificar") and len(sys.argv) >= 3:
        {"criar": criar, "publicar": publicar, "desfazer": desfazer, "verificar": verificar}[cmd](sys.argv[2])
    else:
        sys.exit(__doc__)
