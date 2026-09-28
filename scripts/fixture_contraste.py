"""
Conta FICTÍCIA para conferir o contraste das telas do ALUNO nos dois temas (#285B) — nunca aluno de verdade.

O teste de paleta (`python3 scripts/testar_pdf.py contraste`) mede as cores; esta conta existe para abrir as
telas de verdade, com o aluno logado, e medir o que a pessoa vê — texto sobre o fundo real atrás dele. Cada
área do menu do aluno ganha o mínimo para os seus blocos coloridos aparecerem: resultado de DISC (relatório
com Matriz SWOT e Ganhos e Perdas), um teste por responder, turma com colega, agenda com link, Classroom e
trilha concluídos (caixa "Certificado disponível"), Biblioteca, mentoria com link e comunidade com curtida.

A marca da conta fictícia é a MESMA da conta do dono (ciano #00b0f0 + preto #000000): era ela que apagava
links no escuro. Os ids são IMPRESSOS e gravados no arquivo antes de qualquer tela ser aberta, para a prova
continuar conferível depois da limpeza.

Uso:
  python3 scripts/fixture_contraste.py criar [arquivo.json]   # cria e grava os ids
  python3 scripts/fixture_contraste.py link arquivo.json       # código de uso único para entrar como o aluno
  python3 scripts/fixture_contraste.py apagar arquivo.json     # apaga tudo, citando cada id

Precisa do servidor local (localhost:8080, ou APP_URL): a resposta de DISC entra pelo mesmo endpoint que o
aluno usa.
"""
import datetime as dt
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fixture_assistente_mentor import DOMINIO, VERSAO_DISC, _auth_admin, _iso, _login, _responder_disc  # noqa: E402
from testar_ipsativo import carregar_estrutura, rest  # noqa: E402

MARCA_DO_DONO = {"brand_color": "#00b0f0", "brand_accent_color": "#000000"}


def criar(arquivo):
    rodada = os.urandom(3).hex()
    ids = {"rodada": rodada}

    def guarda(chave, valor):
        ids[chave] = valor
        print(f"{chave}={valor}")
        with open(arquivo, "w") as f:  # a cada passo: se algo falhar no meio, a limpeza sabe o que existe
            json.dump(ids, f, indent=2)

    agora = dt.datetime.now(dt.timezone.utc)
    guarda("mentor_user", _login(f"teste-mentor-285b-{rodada}{DOMINIO}", "ZZ Mentor Fictício 285B"))
    guarda("aluno_user", _login(f"teste-aluno-285b-{rodada}{DOMINIO}", "ZZ Aluna Fictícia 285B"))
    m, u = ids["mentor_user"], ids["aluno_user"]
    rest("POST", "profiles", corpo=[{"user_id": m, "full_name": "ZZ Mentor Fictício 285B",
                                     "company_name": "ZZ Conta Fictícia 285B", **MARCA_DO_DONO}], retorno=False)
    guarda("profile", m)

    aluna = rest("POST", "people", corpo=[{"mentor_id": m, "full_name": "ZZ Aluna Fictícia 285B", "user_id": u,
                                           "email": f"teste-aluno-285b-{rodada}{DOMINIO}", "perfil_visivel": True}])[0]
    guarda("pessoa_aluna", aluna["id"])
    colega = rest("POST", "people", corpo=[{"mentor_id": m, "full_name": "ZZ Colega Fictício 285B",
                                            "email": f"teste-colega-285b-{rodada}{DOMINIO}", "perfil_visivel": True}])[0]
    guarda("pessoa_colega", colega["id"])
    a = aluna["id"]

    g = rest("POST", "groups", corpo=[{"mentor_id": m, "name": "ZZ Turma Fictícia 285B"}])[0]
    guarda("grupo", g["id"])
    rest("POST", "group_members", corpo=[{"group_id": g["id"], "person_id": p, "added_at": _iso(agora - dt.timedelta(days=30))}
                                         for p in (a, colega["id"])], retorno=False)
    rest("POST", "group_instruments", corpo=[{"group_id": g["id"], "instrument_id": "disc"}], retorno=False)

    # DISC respondido (relatório completo) e um segundo envio aberto (a tela de responder).
    est = carregar_estrutura(VERSAO_DISC)
    dims = {x["key"]: x["id"] for x in rest("GET", "test_dimensions", {"version_id": f"eq.{VERSAO_DISC}", "select": "id,key"})}
    r = rest("POST", "test_responses", corpo=[{"version_id": VERSAO_DISC, "person_id": a, "mentor_id": m,
                                               "kind": "self", "status": "in_progress"}])[0]
    guarda("resposta_respondida", r["id"])
    _responder_disc(est, dims, r["id"], {"C": 3.0, "S": 1.6, "D": 0.7, "I": 0.5}, "contraste-285b")
    aberta = rest("POST", "test_responses", corpo=[{"version_id": VERSAO_DISC, "person_id": a, "mentor_id": m, "kind": "self",
                                                    "status": "pending", "expires_at": _iso(agora + dt.timedelta(days=10))}])[0]
    guarda("resposta_aberta", aberta["id"])

    # Agenda: um evento com link (o "Abrir link" era pintado com a cor secundária).
    ev = rest("POST", "eventos", corpo=[{"conta_id": m, "criado_por": m, "titulo": "ZZ Encontro Fictício 285B",
                                         "descricao": "Evento fictício para conferir o contraste.",
                                         "quando": _iso(agora + dt.timedelta(days=2)),
                                         "termina_em": _iso(agora + dt.timedelta(days=2, hours=1)),
                                         "link_url": "https://exemplo.invalido/sala"}])[0]
    guarda("evento", ev["id"])
    rest("POST", "evento_destinos", corpo=[{"evento_id": ev["id"], "group_id": g["id"], "person_id": None}], retorno=False)

    # Classroom: duas aulas que já aconteceram, a aluna presente nas duas → certificado disponível.
    t = rest("POST", "treinamentos", corpo=[{"mentor_id": m, "titulo": "ZZ Treinamento Fictício 285B", "publicado": True,
                                             "percentual_minimo": 75, "tolerancia_atraso_min": 15}])[0]
    guarda("treinamento", t["id"])
    rest("POST", "treinamento_grupos", corpo=[{"treinamento_id": t["id"], "group_id": g["id"]}], retorno=False)
    mod = rest("POST", "treinamento_modulos", corpo=[{"treinamento_id": t["id"], "titulo": "Módulo Fictício", "ordem": 1}])[0]
    guarda("modulo", mod["id"])
    aulas = []
    for n, dias in ((1, -7), (2, -3)):
        inicio = (agora + dt.timedelta(days=dias)).replace(hour=22, minute=0, second=0, microsecond=0)
        x = rest("POST", "treinamento_aulas", corpo=[{"modulo_id": mod["id"], "titulo": f"ZZ AULA {n} — Fictícia", "ordem": n,
                                                      "comeca_em": _iso(inicio), "termina_em": _iso(inicio + dt.timedelta(hours=2)),
                                                      "fechada_em": _iso(inicio + dt.timedelta(hours=3))}])[0]
        aulas.append(x["id"])
    guarda("aulas", aulas)
    pres = rest("POST", "treinamento_presencas", corpo=[{"aula_id": x, "person_id": a, "group_id": g["id"], "origem": "manual",
                                                         "situacao": "presente"} for x in aulas])
    guarda("presencas", [p["id"] for p in pres])

    # Academy: trilha de duas palestras, as duas vistas → certificado disponível.
    tr = rest("POST", "learning_tracks", corpo=[{"owner_id": m, "title": "ZZ Trilha Fictícia 285B", "audience": "alunos",
                                                 "is_published": True, "percentual_minimo": 100}])[0]
    guarda("trilha", tr["id"])
    lm = rest("POST", "learning_modules", corpo=[{"track_id": tr["id"], "title": "Palestras fictícias"}])[0]
    licoes = rest("POST", "learning_lessons", corpo=[{"track_id": tr["id"], "module_id": lm["id"], "title": f"ZZ PALESTRA {n}",
                                                      "is_published": True, "sort_order": n} for n in (1, 2)])
    guarda("licoes", [x["id"] for x in licoes])
    rest("POST", "learning_progress", corpo=[{"lesson_id": x["id"], "track_id": tr["id"], "user_id": u} for x in licoes], retorno=False)

    # Biblioteca: menu liberado para a turma, uma pasta e um material por link.
    rest("POST", "biblioteca_menu_grupos", corpo=[{"mentor_id": m, "group_id": g["id"]}], retorno=False)
    pasta = rest("POST", "biblioteca_pastas", corpo=[{"mentor_id": m, "titulo": "ZZ Pasta Fictícia 285B"}])[0]
    guarda("pasta", pasta["id"])
    mat = rest("POST", "biblioteca_materiais", corpo=[{"mentor_id": m, "titulo": "ZZ Material Fictício 285B", "kind": "link",
                                                       "url": "https://exemplo.invalido/material", "pasta_id": pasta["id"]}])[0]
    guarda("material", mat["id"])

    # Mentoria: uma sessão futura online COM link (também era pintado com a cor secundária) e uma avaliada.
    mt = rest("POST", "mentorias", corpo=[{"mentor_id": m, "person_id": a, "titulo": "ZZ Mentoria Fictícia 285B",
                                           "status": "ativa", "sessoes_contratadas": 4}])[0]
    guarda("mentoria", mt["id"])
    ss = rest("POST", "mentoria_sessoes", corpo=[
        {"mentoria_id": mt["id"], "mentor_id": m, "quando": _iso(agora + dt.timedelta(days=6)), "modalidade": "online",
         "status": "agendada", "link_url": "https://exemplo.invalido/mentoria",
         "avaliacao_estrelas": None, "avaliacao_comentario": None},
        {"mentoria_id": mt["id"], "mentor_id": m, "quando": _iso(agora - dt.timedelta(days=2)), "modalidade": "online",
         "status": "concluida", "link_url": None,
         "avaliacao_estrelas": 4, "avaliacao_comentario": "Ajudou a organizar a semana."},
    ])
    guarda("sessoes", [s["id"] for s in ss])

    # Pontos (ranking) e comunidade: um post do mentor com enquete, um comentário e a curtida da aluna.
    pts = rest("POST", "pontos", corpo=[{"user_id": u, "mentor_id": m, "acao": "presenca", "pontos": 20, "referencia": x} for x in aulas])
    guarda("pontos", [p["id"] for p in pts])
    post = rest("POST", "community_posts", corpo=[{"author_id": m, "author_name": "ZZ Mentor Fictício 285B", "conta_id": m,
                                                   "body": "Post fictício para conferir o contraste (#285B)."}])[0]
    guarda("post", post["id"])
    rest("POST", "community_post_groups", corpo=[{"post_id": post["id"], "group_id": g["id"]}], retorno=False)
    ops = rest("POST", "community_poll_options", corpo=[{"post_id": post["id"], "texto": t_, "ordem": i, "conta_id": m}
                                                        for i, t_ in enumerate(("Opção A", "Opção B"), start=1)])
    guarda("opcoes_enquete", [o["id"] for o in ops])
    c = rest("POST", "community_comments", corpo=[{"post_id": post["id"], "author_id": m, "author_name": "ZZ Mentor Fictício 285B",
                                                   "body": "Comentário fictício."}])[0]
    guarda("comentario", c["id"])
    rest("POST", "community_reactions", corpo=[{"post_id": post["id"], "user_id": u}], retorno=False)
    print(f"\nids gravados em {arquivo}")


def link(arquivo):
    """Código de uso único do login da aluna fictícia (morre ao ser usado). Nunca imprime token de sessão."""
    ids = json.load(open(arquivo))
    email = f"teste-aluno-285b-{ids['rodada']}{DOMINIO}"
    r = _auth_admin("POST", "generate_link", {"type": "magiclink", "email": email})
    print(r["hashed_token"])


def apagar(arquivo):
    ids = json.load(open(arquivo))
    m, u = ids.get("mentor_user"), ids.get("aluno_user")

    def fora(tabela, filtro, rotulo, chave="id"):
        for linha in rest("GET", tabela, {**filtro, "select": chave}):
            rest("DELETE", tabela, {chave: f"eq.{linha[chave]}"}, retorno=False)
            print(f"apagado {rotulo} {linha[chave]}")

    pessoas = [ids[k] for k in ("pessoa_aluna", "pessoa_colega") if ids.get(k)]
    if m:
        fora("notificacoes", {"user_id": f"eq.{m}"}, "aviso do sino do mentor fictício")
    if u:
        fora("notificacoes", {"user_id": f"eq.{u}"}, "aviso do sino da aluna fictícia")
    if ids.get("post"):
        p = ids["post"]
        rest("DELETE", "community_reactions", {"post_id": f"eq.{p}"}, retorno=False)
        fora("community_poll_votes", {"post_id": f"eq.{p}"}, "voto na enquete")
        fora("community_comments", {"post_id": f"eq.{p}"}, "comentário")
        fora("community_poll_options", {"post_id": f"eq.{p}"}, "opção da enquete")
        rest("DELETE", "community_post_groups", {"post_id": f"eq.{p}"}, retorno=False)
        fora("community_posts", {"id": f"eq.{p}"}, "post (curtida e destino caem junto)")
    if m:
        fora("community_posts", {"conta_id": f"eq.{m}"}, "post criado pela tela")
        fora("pontos", {"mentor_id": f"eq.{m}"}, "ponto")
    if ids.get("mentoria"):
        fora("mentoria_sessoes", {"mentoria_id": f"eq.{ids['mentoria']}"}, "sessão de mentoria")
        fora("mentorias", {"id": f"eq.{ids['mentoria']}"}, "mentoria")
    if ids.get("material"):
        fora("biblioteca_materiais", {"id": f"eq.{ids['material']}"}, "material")
    if ids.get("pasta"):
        fora("biblioteca_pastas", {"id": f"eq.{ids['pasta']}"}, "pasta")
    if m:
        fora("biblioteca_menu_grupos", {"mentor_id": f"eq.{m}"}, "menu da Biblioteca")
    if ids.get("trilha"):
        fora("certificados", {"trilha_id": f"eq.{ids['trilha']}"}, "certificado da trilha")
        fora("learning_progress", {"track_id": f"eq.{ids['trilha']}"}, "palestra vista")
        fora("learning_lessons", {"track_id": f"eq.{ids['trilha']}"}, "palestra")
        fora("learning_modules", {"track_id": f"eq.{ids['trilha']}"}, "módulo da trilha")
        fora("learning_tracks", {"id": f"eq.{ids['trilha']}"}, "trilha")
    if ids.get("aulas"):
        lista = "in.(" + ",".join(ids["aulas"]) + ")"
        fora("treinamento_presencas", {"aula_id": lista}, "presença")
        fora("treinamento_aula_conclusoes", {"aula_id": lista}, "aula assistida")
        fora("treinamento_avaliacoes", {"aula_id": lista}, "avaliação de aula")
        fora("treinamento_aulas", {"id": lista}, "aula")
    if ids.get("treinamento"):
        rest("DELETE", "treinamento_grupos", {"treinamento_id": f"eq.{ids['treinamento']}"}, retorno=False)
        fora("treinamento_modulos", {"treinamento_id": f"eq.{ids['treinamento']}"}, "módulo")
        fora("certificados", {"treinamento_id": f"eq.{ids['treinamento']}"}, "certificado do treinamento")
        fora("treinamentos", {"id": f"eq.{ids['treinamento']}"}, "treinamento")
    if ids.get("evento"):
        fora("evento_destinos", {"evento_id": f"eq.{ids['evento']}"}, "destino do evento")
        fora("eventos", {"id": f"eq.{ids['evento']}"}, "evento")
    if pessoas:
        lista = "in.(" + ",".join(pessoas) + ")"
        fora("test_responses", {"person_id": lista}, "resposta de teste")
    if ids.get("grupo"):
        rest("DELETE", "group_instruments", {"group_id": f"eq.{ids['grupo']}"}, retorno=False)
        rest("DELETE", "group_members", {"group_id": f"eq.{ids['grupo']}"}, retorno=False)
        fora("groups", {"id": f"eq.{ids['grupo']}"}, "grupo")
    if pessoas:
        fora("people", {"id": "in.(" + ",".join(pessoas) + ")"}, "pessoa")
    if m:
        rest("DELETE", "profiles", {"user_id": f"eq.{m}"}, retorno=False)
        print(f"apagado o perfil (com a marca) {m}")
    for k in ("aluno_user", "mentor_user"):
        if ids.get(k):
            _auth_admin("DELETE", f"users/{ids[k]}")
            print(f"apagado o login {k} {ids[k]}")


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    if cmd == "criar":
        criar(sys.argv[2] if len(sys.argv) > 2 else "fixture_contraste.json")
    elif cmd == "link" and len(sys.argv) >= 3:
        link(sys.argv[2])
    elif cmd == "apagar" and len(sys.argv) >= 3:
        apagar(sys.argv[2])
    else:
        sys.exit(__doc__)
