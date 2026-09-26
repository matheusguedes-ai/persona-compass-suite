"""
Conta FICTÍCIA de mentor para testar a assistente do painel (#307) — nunca aluno de verdade.

Testar a assistente do mentor manda os dados da conta para a API da Anthropic. Os testes antes de publicar
usam SÓ esta conta inventada: um mentor dono de conta, quatro alunos, uma turma, respostas de DISC, um
treinamento com presença, uma trilha, uma campanha, pontos, uma mentoria — e, de propósito, UMA CONVERSA
de aluno com a assistente dele, com uma marca secreta. Ela serve para provar que a assistente do mentor
NUNCA alcança conversa de aluno: a marca não pode aparecer no contexto nem em resposta nenhuma.

Os ids são IMPRESSOS e gravados num arquivo antes de qualquer teste, para a prova continuar conferível
depois da limpeza (constituição: "prova que a limpeza apaga não é prova").

Uso:
  python3 scripts/fixture_assistente_mentor.py criar [arquivo.json]   # cria e grava os ids
  python3 scripts/fixture_assistente_mentor.py apagar arquivo.json     # apaga tudo, citando cada id

Precisa do servidor local (localhost:8080, ou APP_URL): as respostas de DISC entram pelo mesmo endpoint
que o aluno usa.
"""
import datetime as dt
import json
import os
import random
import sys
import urllib.error
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from testar_ipsativo import carregar_estrutura, rest, _env  # noqa: E402
from ipsativo_oraculo import sortear_escolhas  # noqa: E402

APP = os.environ.get("APP_URL", "http://localhost:8080")
VERSAO_DISC = "f9c6aba8-115b-4c59-9d35-9c1f995b3eb9"
DOMINIO = "@exemplo.invalido"


def _post(caminho, corpo):
    req = urllib.request.Request(f"{APP}{caminho}", method="POST", data=json.dumps(corpo).encode(),
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.status


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
        raise RuntimeError(f"auth {metodo} {caminho} falhou ({e.code}): {e.read().decode()[:300]}")


def _iso(d):
    return d.astimezone(dt.timezone.utc).isoformat()


def _login(email, nome):
    return _auth_admin("POST", "users", {"email": email, "email_confirm": True, "user_metadata": {"full_name": nome}})["id"]


def _responder_disc(est, dims, resposta_id, pesos, semente):
    mais, menos = sortear_escolhas({"letra_da_opcao": est["letra_da_opcao"], "blocos": est["blocos"]},
                                   random.Random(semente), {dims[k]: v for k, v in pesos.items()})
    st = _post(f"/api/public/response/{resposta_id}", {"answers": [
        {"question_id": b["id"], "payload": {"most_option_id": mais[k], "least_option_id": menos[k]}}
        for k, b in enumerate(est["blocos"])]})
    if st != 200:
        sys.exit(f"não consegui enviar a resposta {resposta_id} (HTTP {st})")


def criar(arquivo):
    rodada = os.urandom(3).hex()
    ids = {"rodada": rodada, "segredo": f"SEGREDO-307-{rodada}"}

    def guarda(chave, valor):
        ids[chave] = valor
        print(f"{chave}={valor}")
        with open(arquivo, "w") as f:  # grava a cada passo: se algo falhar no meio, a limpeza sabe o que existe
            json.dump(ids, f, indent=2)

    agora = dt.datetime.now(dt.timezone.utc)

    # Logins: o mentor (dono da conta fictícia), um colaborador dele e um aluno com login.
    guarda("mentor_user", _login(f"teste-mentor-307-{rodada}{DOMINIO}", "ZZ Mentor Fictício 307"))
    guarda("colab_user", _login(f"teste-colab-307-{rodada}{DOMINIO}", "ZZ Colaboradora Fictícia 307"))
    guarda("aluno_user", _login(f"teste-aluno-307-{rodada}{DOMINIO}", "ZZ Aluna Analítica 307"))
    m = ids["mentor_user"]
    rest("POST", "profiles", corpo=[{"user_id": m, "full_name": "ZZ Mentor Fictício 307"}], retorno=False)
    guarda("profile", m)
    tm = rest("POST", "team_members", corpo=[{
        "owner_id": m, "user_id": ids["colab_user"], "kind": "colaborador", "name": "ZZ Colaboradora Fictícia 307",
        "email": f"teste-colab-307-{rodada}{DOMINIO}", "status": "ativo", "permissions": ["pessoas"],
        "accepted_at": _iso(agora)}])[0]
    guarda("team_member", tm["id"])

    # Quatro alunos na conta fictícia.
    def pessoa(chave, nome, login=None):
        p = rest("POST", "people", corpo=[{"mentor_id": m, "full_name": nome, "user_id": login,
                                           "email": f"teste-{chave}-307-{rodada}{DOMINIO}"}])[0]
        guarda(f"pessoa_{chave}", p["id"])
        return p["id"]

    a = pessoa("analitica", "ZZ Aluna Analítica 307", ids["aluno_user"])
    b = pessoa("comunicador", "ZZ Aluno Comunicador 307")
    c = pessoa("semteste", "ZZ Aluna Sem Teste 307")
    d = pessoa("pendente", "ZZ Aluno Pendente 307")

    g = rest("POST", "groups", corpo=[{"mentor_id": m, "name": "ZZ Turma Fictícia 307"}])[0]
    guarda("grupo", g["id"])
    # Entraram há 30 dias: as aulas da semana passada contam para todos.
    rest("POST", "group_members", corpo=[{"group_id": g["id"], "person_id": p, "added_at": _iso(agora - dt.timedelta(days=30))}
                                         for p in (a, b, c, d)], retorno=False)
    rest("POST", "group_instruments", corpo=[{"group_id": g["id"], "instrument_id": "disc"}], retorno=False)

    campanha = rest("POST", "invite_links", corpo=[{
        "mentor_id": m, "title": "ZZ Campanha Fictícia 307", "version_ids": [VERSAO_DISC], "group_id": g["id"],
        "is_active": True, "expires_at": _iso(agora + dt.timedelta(days=30))}])[0]
    guarda("campanha", campanha["id"])

    # DISC: a analítica puxa o C, o comunicador puxa o I; o pendente recebeu e não respondeu.
    est = carregar_estrutura(VERSAO_DISC)
    dims = {x["key"]: x["id"] for x in rest("GET", "test_dimensions", {"version_id": f"eq.{VERSAO_DISC}", "select": "id,key"})}
    for chave, pid, pesos in (("analitica", a, {"C": 3.0, "S": 1.6, "D": 0.7, "I": 0.5}),
                              ("comunicador", b, {"I": 3.0, "D": 1.8, "S": 0.7, "C": 0.5})):
        r = rest("POST", "test_responses", corpo=[{"version_id": VERSAO_DISC, "person_id": pid, "mentor_id": m,
                                                   "kind": "self", "status": "in_progress", "invite_link_id": campanha["id"]}])[0]
        guarda(f"resposta_{chave}", r["id"])
        _responder_disc(est, dims, r["id"], pesos, f"mentor-307-{chave}")
        cs = rest("GET", "test_responses", {"id": f"eq.{r['id']}", "select": "computed_scores"})[0]["computed_scores"]
        perfil = ((cs or {}).get("ipsativo") or {}).get("natural", {}).get("perfil", {})
        print(f"  perfil natural de {chave}: {perfil.get('codigo')} ({perfil.get('tipo')})")
    r = rest("POST", "test_responses", corpo=[{"version_id": VERSAO_DISC, "person_id": d, "mentor_id": m, "kind": "self",
                                               "status": "pending", "invite_link_id": campanha["id"],
                                               "expires_at": _iso(agora + dt.timedelta(days=10))}])[0]
    guarda("resposta_pendente", r["id"])

    # Classroom: duas aulas que já aconteceram (lista fechada), uma futura e uma gravada.
    t = rest("POST", "treinamentos", corpo=[{"mentor_id": m, "titulo": "ZZ Treinamento Fictício 307", "publicado": True,
                                             "percentual_minimo": 75, "tolerancia_atraso_min": 15}])[0]
    guarda("treinamento", t["id"])
    rest("POST", "treinamento_grupos", corpo=[{"treinamento_id": t["id"], "group_id": g["id"]}], retorno=False)
    mod = rest("POST", "treinamento_modulos", corpo=[{"treinamento_id": t["id"], "titulo": "Módulo Fictício", "ordem": 1}])[0]
    guarda("modulo", mod["id"])

    def aula(chave, titulo, ordem, dias=None, fechada=False):
        corpo = {"modulo_id": mod["id"], "titulo": titulo, "ordem": ordem}
        if dias is not None:
            inicio = (agora + dt.timedelta(days=dias)).replace(hour=22, minute=0, second=0, microsecond=0)
            corpo.update({"comeca_em": _iso(inicio), "termina_em": _iso(inicio + dt.timedelta(hours=2))})
            if fechada:
                corpo["fechada_em"] = _iso(inicio + dt.timedelta(hours=3))
        x = rest("POST", "treinamento_aulas", corpo=[corpo])[0]
        guarda(f"aula_{chave}", x["id"])
        return x["id"]

    a1 = aula("1", "ZZ AULA 1 — Escuta ativa", 1, dias=-7, fechada=True)
    a2 = aula("2", "ZZ AULA 2 — Feedback", 2, dias=-3, fechada=True)
    aula("3", "ZZ AULA 3 — Negociação", 3, dias=5)
    gravada = aula("gravada", "ZZ Aula gravada — Boas-vindas", 4)
    pres = rest("POST", "treinamento_presencas", corpo=[
        {"aula_id": a1, "person_id": a, "group_id": g["id"], "origem": "manual", "situacao": "presente"},
        {"aula_id": a1, "person_id": b, "group_id": g["id"], "origem": "manual", "situacao": "justificado"},
        {"aula_id": a2, "person_id": a, "group_id": g["id"], "origem": "manual", "situacao": "presente"},
        {"aula_id": a2, "person_id": b, "group_id": g["id"], "origem": "manual", "situacao": "presente"},
    ])
    guarda("presencas", [p_["id"] for p_ in pres])
    conc = rest("POST", "treinamento_aula_conclusoes", corpo=[{"aula_id": gravada, "person_id": a, "conta_id": m}])[0]
    guarda("conclusao_gravada", conc["id"])
    av = rest("POST", "treinamento_avaliacoes", corpo=[{"aula_id": a1, "person_id": a, "conta_id": m, "estrelas": 5,
                                                        "comentario": "Gostei muito da dinâmica em dupla."}])[0]
    guarda("avaliacao_aula", av["id"])

    # Academy: uma trilha com duas palestras; a analítica marcou uma como vista.
    tr = rest("POST", "learning_tracks", corpo=[{"owner_id": m, "title": "ZZ Trilha Fictícia 307", "audience": "alunos",
                                                 "is_published": True, "percentual_minimo": 100}])[0]
    guarda("trilha", tr["id"])
    lm = rest("POST", "learning_modules", corpo=[{"track_id": tr["id"], "title": "Palestras fictícias"}])[0]
    guarda("modulo_trilha", lm["id"])
    l1 = rest("POST", "learning_lessons", corpo=[{"track_id": tr["id"], "module_id": lm["id"], "title": "ZZ PALESTRA — Falar em público", "is_published": True, "sort_order": 1}])[0]
    l2 = rest("POST", "learning_lessons", corpo=[{"track_id": tr["id"], "module_id": lm["id"], "title": "ZZ PALESTRA — Decidir sob pressão", "is_published": True, "sort_order": 2}])[0]
    guarda("aulas_trilha", [l1["id"], l2["id"]])
    lp = rest("POST", "learning_progress", corpo=[{"lesson_id": l1["id"], "track_id": tr["id"], "user_id": ids["aluno_user"]}])[0]
    guarda("progresso", lp["id"])

    # Pontos (as presenças) e uma mentoria do comunicador.
    pts = rest("POST", "pontos", corpo=[{"user_id": ids["aluno_user"], "mentor_id": m, "acao": "presenca", "pontos": 20, "referencia": x}
                                        for x in (a1, a2)])
    guarda("pontos", [p_["id"] for p_ in pts])
    mt = rest("POST", "mentorias", corpo=[{"mentor_id": m, "person_id": b, "titulo": "ZZ Mentoria Fictícia 307",
                                           "status": "ativa", "sessoes_contratadas": 4}])[0]
    guarda("mentoria", mt["id"])
    ss = rest("POST", "mentoria_sessoes", corpo=[
        {"mentoria_id": mt["id"], "mentor_id": m, "quando": _iso(agora - dt.timedelta(days=2)), "modalidade": "online", "status": "concluida",
         "avaliacao_estrelas": 4, "avaliacao_comentario": "Ajudou a organizar a semana."},
        {"mentoria_id": mt["id"], "mentor_id": m, "quando": _iso(agora + dt.timedelta(days=6)), "modalidade": "online", "status": "agendada",
         "avaliacao_estrelas": None, "avaliacao_comentario": None},
    ])
    guarda("sessoes", [s["id"] for s in ss])

    # A CONVERSA DO ALUNO com a assistente DELE — o que a assistente do mentor nunca pode alcançar.
    termo = rest("GET", "assistente_termos", {"status": "eq.publicado", "select": "id,versao,texto,rotulo_aceite",
                                              "order": "versao.desc", "limit": "1"})[0]
    lib = rest("POST", "assistente_liberacoes", corpo=[{"conta_id": m, "user_id": ids["aluno_user"]}])[0]
    guarda("liberacao_aluno", lib["id"])
    cons = rest("POST", "assistente_consentimentos", corpo=[{
        "user_id": ids["aluno_user"], "conta_id": m, "termo_id": termo["id"], "termo_versao": termo["versao"],
        "texto_aceito": termo["texto"], "rotulo_aceito": termo["rotulo_aceite"]}])[0]
    guarda("consentimento_aluno", cons["id"])
    conv = rest("POST", "assistente_conversas", corpo=[{"user_id": ids["aluno_user"], "conta_id": m,
                                                        "titulo": f"{ids['segredo']} conversa particular"}])[0]
    guarda("conversa_aluno", conv["id"])
    msg = rest("POST", "assistente_mensagens", corpo=[{
        "conversa_id": conv["id"], "user_id": ids["aluno_user"], "conta_id": m, "papel": "aluno",
        "conteudo": f"{ids['segredo']}: estou pensando em largar o curso por causa do meu chefe."}])[0]
    guarda("mensagem_aluno", msg["id"])
    print(f"\nids gravados em {arquivo}")


def apagar(arquivo):
    ids = json.load(open(arquivo))
    m = ids.get("mentor_user")

    def fora(tabela, filtro, rotulo):
        linhas = rest("GET", tabela, {**filtro, "select": "id"})
        for linha in linhas:
            rest("DELETE", tabela, {"id": f"eq.{linha['id']}"}, retorno=False)
            print(f"apagado {rotulo} {linha['id']}")

    pessoas = [ids[k] for k in ids if k.startswith("pessoa_")]
    if m:
        # Avisos do sino (responder pelo endpoint público avisa o dono e a equipe) e custo das perguntas.
        for u in (m, ids.get("colab_user")):
            if u:
                fora("notificacoes", {"user_id": f"eq.{u}"}, "aviso do sino")
        for u in (m, ids.get("aluno_user")):
            if u:
                fora("assistente_uso", {"user_id": f"eq.{u}"}, "registro de custo")
        fora("assistente_mentor_conversas", {"user_id": f"eq.{m}"}, "conversa do mentor (mensagens caem junto)")
    if ids.get("conversa_aluno"):
        fora("assistente_conversas", {"id": f"eq.{ids['conversa_aluno']}"}, "conversa do aluno (mensagem cai junto)")
    for k, tabela in (("consentimento_aluno", "assistente_consentimentos"), ("liberacao_aluno", "assistente_liberacoes")):
        if ids.get(k):
            fora(tabela, {"id": f"eq.{ids[k]}"}, k)
    if ids.get("mentoria"):
        fora("mentoria_sessoes", {"mentoria_id": f"eq.{ids['mentoria']}"}, "sessão de mentoria")
        fora("mentorias", {"id": f"eq.{ids['mentoria']}"}, "mentoria")
    if m:
        fora("pontos", {"mentor_id": f"eq.{m}"}, "ponto")
    if ids.get("trilha"):
        fora("learning_progress", {"track_id": f"eq.{ids['trilha']}"}, "aula vista")
        fora("learning_lessons", {"track_id": f"eq.{ids['trilha']}"}, "aula da trilha")
        fora("learning_modules", {"track_id": f"eq.{ids['trilha']}"}, "módulo da trilha")
        fora("learning_tracks", {"id": f"eq.{ids['trilha']}"}, "trilha")
    aulas = [ids[k] for k in ids if k.startswith("aula_") and k != "aulas_trilha"]
    if aulas:
        lista = "in.(" + ",".join(aulas) + ")"
        fora("treinamento_avaliacoes", {"aula_id": lista}, "avaliação de aula")
        fora("treinamento_aula_conclusoes", {"aula_id": lista}, "aula gravada assistida")
        fora("treinamento_presencas", {"aula_id": lista}, "presença")
        fora("treinamento_aulas", {"id": lista}, "aula")
    if ids.get("treinamento"):
        rest("DELETE", "treinamento_grupos", {"treinamento_id": f"eq.{ids['treinamento']}"}, retorno=False)
        fora("treinamento_modulos", {"treinamento_id": f"eq.{ids['treinamento']}"}, "módulo")
        fora("certificados", {"treinamento_id": f"eq.{ids['treinamento']}"}, "certificado")
        fora("treinamentos", {"id": f"eq.{ids['treinamento']}"}, "treinamento")
    if pessoas:
        lista = "in.(" + ",".join(pessoas) + ")"
        fora("test_responses", {"person_id": lista}, "resposta de teste")
    if ids.get("campanha"):
        fora("invite_links", {"id": f"eq.{ids['campanha']}"}, "campanha")
    if ids.get("grupo"):
        rest("DELETE", "group_instruments", {"group_id": f"eq.{ids['grupo']}"}, retorno=False)
        rest("DELETE", "group_members", {"group_id": f"eq.{ids['grupo']}"}, retorno=False)
        fora("groups", {"id": f"eq.{ids['grupo']}"}, "grupo")
    if pessoas:
        fora("people", {"id": "in.(" + ",".join(pessoas) + ")"}, "pessoa")
    if ids.get("team_member"):
        fora("team_members", {"id": f"eq.{ids['team_member']}"}, "membro da equipe")
    if m:
        rest("DELETE", "profiles", {"user_id": f"eq.{m}"}, retorno=False)
        print(f"apagado o perfil {m}")
    for k in ("aluno_user", "colab_user", "mentor_user"):
        if ids.get(k):
            _auth_admin("DELETE", f"users/{ids[k]}")
            print(f"apagado o login {k} {ids[k]}")


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    if cmd == "criar":
        criar(sys.argv[2] if len(sys.argv) > 2 else "fixture_assistente_mentor.json")
    elif cmd == "apagar" and len(sys.argv) >= 3:
        apagar(sys.argv[2])
    else:
        sys.exit(__doc__)
