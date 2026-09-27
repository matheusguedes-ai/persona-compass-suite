"""
Conta FICTÍCIA para testar a Biblioteca (#313) — nunca aluno de verdade.

Por que uma conta à parte, e não pastas de teste na conta do dono: enquanto a regra antiga estiver no ar,
material sem destino aparece para TODO aluno da conta. Um material de teste na conta real apareceria para
os alunos de verdade. Numa conta inventada, ninguém de fora enxerga nada (as duas regras, a velha e a
nova, recortam pela conta).

Monta: uma dona (login), dois grupos — um para receber o menu pela tela, outro que fica sem —, quatro
alunos com login e esta árvore (os materiais são links para exemplo.invalido: nada é baixado):

  ZZ Pasta Geral 313 ─ ZZ Subpasta 313
  ZZ Pasta Reservada 313
  materiais: um em cada pasta, um "bloqueável" na Geral, e dois soltos no início

As REGRAS (menu, bloqueios, liberação direta) NÃO nascem aqui: o teste as faz pela tela, que é o caminho
do dono. `provar` entra como cada aluno (link mágico → sessão, nunca impressa) e confere, item a item,
que o que o banco devolve para ele bate com o que "Quem vê isto" diz para a dona.

Os ids são IMPRESSOS e gravados no arquivo antes de qualquer teste, para a prova continuar conferível
depois da limpeza (constituição: "prova que a limpeza apaga não é prova").

Uso:
  python3 scripts/fixture_biblioteca.py criar arq.json
  python3 scripts/fixture_biblioteca.py link arq.json <papel> [endereço]   # link mágico de UM papel
  python3 scripts/fixture_biblioteca.py provar arq.json
  python3 scripts/fixture_biblioteca.py apagar arq.json
"""
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from testar_ipsativo import RAIZ, rest, _env  # noqa: E402

DOMINIO = "@exemplo.invalido"
PAPEIS = ("dona", "aluna_a", "aluno_b", "aluna_c", "aluno_d")
NAVEGADOR = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36"


def _chave_publica():
    for linha in open(os.path.join(RAIZ, ".env.local"), encoding="utf-8"):
        if linha.startswith("SUPABASE_PUBLISHABLE_KEY="):
            return linha.split("=", 1)[1].strip().strip('"').strip("'")
    raise SystemExit("SUPABASE_PUBLISHABLE_KEY não está no .env.local")


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


def _email(ids, papel):
    return f"teste-{papel.replace('_', '-')}-313-{ids['rodada']}{DOMINIO}"


def _link_magico(email, destino=None):
    corpo = {"type": "magiclink", "email": email}
    if destino:
        corpo["redirect_to"] = destino
    r = _auth_admin("POST", "generate_link", corpo)
    return r.get("action_link") or r["properties"]["action_link"]


class _SemSeguir(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a, **k):
        return None


def _sessao(email):
    """Token de sessão do login fictício: segue o link mágico SEM seguir o redirecionamento, e lê o
    token do endereço de volta. Nunca é impresso."""
    if not email.endswith(DOMINIO):
        raise SystemExit(f"recusado: {email} não é login fictício")
    abridor = urllib.request.build_opener(_SemSeguir)
    req = urllib.request.Request(_link_magico(email), headers={"User-Agent": NAVEGADOR})
    try:
        abridor.open(req, timeout=60)
        raise RuntimeError("o link mágico não redirecionou")
    except urllib.error.HTTPError as e:
        destino = e.headers.get("Location") or ""
    frag = urllib.parse.parse_qs(urllib.parse.urlparse(destino).fragment)
    if "access_token" not in frag:
        raise RuntimeError("o link mágico não devolveu sessão")
    return frag["access_token"][0]


def _como(token, metodo, caminho, corpo=None, params=None):
    url, _ = _env()
    q = ("?" + urllib.parse.urlencode(params, safe="(),.*:")) if params else ""
    req = urllib.request.Request(f"{url}/rest/v1/{caminho}{q}", method=metodo,
                                 data=None if corpo is None else json.dumps(corpo).encode(),
                                 headers={"apikey": _chave_publica(), "Authorization": f"Bearer {token}",
                                          "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            txt = r.read().decode()
            return r.status, (json.loads(txt) if txt else None)
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:300]


# --------------------------------------------------------------------------------------------- criar
def criar(arquivo):
    rodada = os.urandom(3).hex()
    ids = {"rodada": rodada}

    def guarda(chave, valor):
        ids[chave] = valor
        print(f"{chave}={valor}")
        with open(arquivo, "w") as f:  # grava a cada passo: se algo falhar no meio, a limpeza sabe o que existe
            json.dump(ids, f, indent=2)

    nomes = {"dona": "ZZ Dona Fictícia 313", "aluna_a": "ZZ Aluna A 313", "aluno_b": "ZZ Aluno B 313",
             "aluna_c": "ZZ Aluna C 313", "aluno_d": "ZZ Aluno D 313"}
    for papel in PAPEIS:
        u = _auth_admin("POST", "users", {"email": _email(ids, papel), "email_confirm": True,
                                          "user_metadata": {"full_name": nomes[papel]}})["id"]
        guarda(f"login_{papel}", u)
    dona = ids["login_dona"]
    rest("POST", "profiles", corpo=[{"user_id": dona, "full_name": nomes["dona"]}], retorno=False)
    guarda("perfil", dona)

    for papel in PAPEIS[1:]:
        p = rest("POST", "people", corpo=[{"mentor_id": dona, "full_name": nomes[papel], "user_id": ids[f"login_{papel}"],
                                           "email": _email(ids, papel)}])[0]
        guarda(f"pessoa_{papel}", p["id"])

    g1 = rest("POST", "groups", corpo=[{"mentor_id": dona, "name": "ZZ T4 Fictícia 313"}])[0]
    guarda("grupo_t4", g1["id"])
    g2 = rest("POST", "groups", corpo=[{"mentor_id": dona, "name": "ZZ Turma Sem Menu 313"}])[0]
    guarda("grupo_sem_menu", g2["id"])
    rest("POST", "group_members", corpo=[
        {"group_id": g1["id"], "person_id": ids["pessoa_aluna_a"]},
        {"group_id": g1["id"], "person_id": ids["pessoa_aluno_b"]},
        {"group_id": g2["id"], "person_id": ids["pessoa_aluno_d"]},
    ], retorno=False)

    def pasta(chave, titulo, mae=None, ordem=0):
        p = rest("POST", "biblioteca_pastas", corpo=[{"mentor_id": dona, "titulo": titulo, "pasta_mae_id": mae,
                                                      "ordem": ordem}])[0]
        guarda(f"pasta_{chave}", p["id"])
        return p["id"]

    geral = pasta("geral", "ZZ Pasta Geral 313", ordem=0)
    sub = pasta("sub", "ZZ Subpasta 313", mae=geral)
    reservada = pasta("reservada", "ZZ Pasta Reservada 313", ordem=1)

    def material(chave, titulo, onde, categoria=None):
        m = rest("POST", "biblioteca_materiais", corpo=[{
            "mentor_id": dona, "titulo": titulo, "url": f"https://exemplo.invalido/313/{chave}", "kind": "link",
            "categoria": categoria, "pasta_id": onde, "arquivo_proprio": False}])[0]
        guarda(f"material_{chave}", m["id"])

    material("geral", "ZZ Material Geral 313", geral, "Liderança")
    material("bloqueavel", "ZZ Material Bloqueável 313", geral, "Liderança")
    material("sub", "ZZ Material da Subpasta 313", sub)
    material("reservado", "ZZ Material Reservado 313", reservada)
    material("solto", "ZZ Material Solto 313", None, "Vendas")
    material("so_da_c", "ZZ Material Só da C 313", None)
    print(f"\nids em {arquivo}")


# ---------------------------------------------------------------------------------------------- link
def link(arquivo, papel, destino=None):
    ids = json.load(open(arquivo))
    if papel not in PAPEIS:
        raise SystemExit(f"papel desconhecido: {papel}")
    # Impresso só o link de uso único do login FICTÍCIO — é o que o navegador de teste abre.
    print(_link_magico(_email(ids, papel), destino))


# -------------------------------------------------------------------------------------------- provar
def provar(arquivo):
    ids = json.load(open(arquivo))
    dona = ids["login_dona"]
    pastas = {k[len("pasta_"):]: v for k, v in ids.items() if k.startswith("pasta_")}
    # Pastas e materiais criados pela TELA também entram: tudo o que é da conta fictícia.
    for p in rest("GET", "biblioteca_pastas", {"mentor_id": f"eq.{dona}", "select": "id,titulo"}):
        if p["id"] not in pastas.values():
            pastas[f"tela:{p['titulo']}"] = p["id"]
    materiais = {k[len("material_"):]: v for k, v in ids.items() if k.startswith("material_")}
    for m in rest("GET", "biblioteca_materiais", {"mentor_id": f"eq.{dona}", "select": "id,titulo"}):
        if m["id"] not in materiais.values():
            materiais[f"tela:{m['titulo']}"] = m["id"]
    alunos = [p for p in PAPEIS if p != "dona"]
    pessoa_do = {ids[f"pessoa_{p}"]: p for p in alunos}

    tok_dona = _sessao(_email(ids, "dona"))
    # O que "Quem vê isto" diz, por item: {item: {papel: resultado}}
    quem = {}
    for tipo, itens in (("pasta", pastas), ("material", materiais)):
        for nome, iid in itens.items():
            st, linhas = _como(tok_dona, "POST", "rpc/bib_quem_ve",
                               {"_pasta_id": iid if tipo == "pasta" else None,
                                "_material_id": iid if tipo == "material" else None})
            assert st == 200, f"bib_quem_ve {nome}: {st} {linhas}"
            quem[(tipo, nome)] = {pessoa_do[l["person_id"]]: (l["resultado"], l["como"]) for l in linhas
                                  if l["person_id"] in pessoa_do}

    divergencias = 0
    tabela = []
    for papel in alunos:
        tok = _sessao(_email(ids, papel))
        st, vis = _como(tok, "POST", "rpc/bib_visiveis", {})
        assert st == 200, f"bib_visiveis {papel}: {st} {vis}"
        visiveis = {(v["tipo"], v["id"]) for v in vis}
        # Nada de outra conta pode aparecer para ele.
        fora = visiveis - {("pasta", i) for i in pastas.values()} - {("material", i) for i in materiais.values()}
        if fora:
            divergencias += 1
            print(f"✗ {papel} vê {len(fora)} item(ns) de OUTRA conta")
        for tipo, itens in (("pasta", pastas), ("material", materiais)):
            for nome, iid in itens.items():
                st, porta = _como(tok, "POST", f"rpc/bib_pode_ver_{tipo}", {f"_{tipo}_id": iid})
                assert st == 200, f"bib_pode_ver_{tipo} {papel} {nome}: {st} {porta}"
                diz = quem[(tipo, nome)].get(papel, ("—", "—"))
                ve_lista, ve_porta, ve_diz = (tipo, iid) in visiveis, porta is True, diz[0] == "ve"
                ok = ve_lista == ve_porta == ve_diz
                divergencias += 0 if ok else 1
                tabela.append((papel, tipo, nome, ve_lista, ve_porta, diz, ok))
        # RLS das tabelas (regra antiga até a etapa 2 do #313).
        st, linhas = _como(tok, "GET", "biblioteca_materiais", params={"select": "id"})
        rls = {l["id"] for l in linhas} if st == 200 else set()
        vis_m = {i for (t, i) in visiveis if t == "material"}
        print(f"{papel}: tela {len(vis_m)} material(is) · leitura direta da tabela {len(rls)}"
              + ("" if rls == vis_m else "  ← diferente (esperado só antes da etapa 2)"))
        st, lib = _como(tok, "POST", "rpc/bib_materiais_liberados", {"_person_id": None})
        lib = set(lib) if st == 200 else set()
        print(f"{papel}: função antiga (a da assistente) {len(lib & set(materiais.values()))} material(is) desta conta"
              + ("" if lib & set(materiais.values()) == vis_m else "  ← diferente (esperado só antes da etapa 2)"))

    print()
    print(f"{'aluno':9} {'item':34} {'lista':6} {'porta':6} {'quem vê isto':26} ok")
    for papel, tipo, nome, a, b, diz, ok in tabela:
        print(f"{papel:9} {tipo[:3] + ' ' + nome[:30]:34} {'vê' if a else '—':6} {'vê' if b else '—':6} "
              f"{diz[0] + ' (' + str(diz[1]) + ')':26} {'✓' if ok else '✗'}")
    print(f"\n{'NENHUMA divergência' if not divergencias else str(divergencias) + ' DIVERGÊNCIA(S)'} entre a lista do aluno, "
          "a porta do link direto e o 'Quem vê isto' da dona.")
    return divergencias


# -------------------------------------------------------------------------------------------- apagar
def apagar(arquivo):
    ids = json.load(open(arquivo))
    dona = ids.get("login_dona")

    def fora(tabela, filtro, rotulo):
        linhas = rest("GET", tabela, {**filtro, "select": "id"})
        for linha in linhas:
            rest("DELETE", tabela, {"id": f"eq.{linha['id']}"}, retorno=False)
            print(f"apagado {rotulo} {linha['id']}")

    if dona:
        fora("biblioteca_menu_grupos", {"mentor_id": f"eq.{dona}"}, "menu da biblioteca para grupo")
        fora("biblioteca_material_bloqueios", {"mentor_id": f"eq.{dona}"}, "bloqueio de material")
        fora("biblioteca_pasta_bloqueios", {"mentor_id": f"eq.{dona}"}, "bloqueio de pasta")
        mats = [m["id"] for m in rest("GET", "biblioteca_materiais", {"mentor_id": f"eq.{dona}", "select": "id"})]
        pas = [p["id"] for p in rest("GET", "biblioteca_pastas", {"mentor_id": f"eq.{dona}", "select": "id"})]
        if mats:
            fora("biblioteca_material_destinos", {"material_id": "in.(" + ",".join(mats) + ")"}, "liberação de material")
        if pas:
            fora("biblioteca_pasta_destinos", {"pasta_id": "in.(" + ",".join(pas) + ")"}, "liberação de pasta")
        fora("biblioteca_materiais", {"mentor_id": f"eq.{dona}"}, "material")
        # Filhas antes das mães (a chave da mãe é ON DELETE SET NULL, mas a ordem deixa o relato limpo).
        for _ in range(4):
            for p in rest("GET", "biblioteca_pastas", {"mentor_id": f"eq.{dona}", "select": "id,pasta_mae_id"}):
                if not rest("GET", "biblioteca_pastas", {"pasta_mae_id": f"eq.{p['id']}", "select": "id"}):
                    rest("DELETE", "biblioteca_pastas", {"id": f"eq.{p['id']}"}, retorno=False)
                    print(f"apagada pasta {p['id']}")
        for u in [ids.get(f"login_{p}") for p in PAPEIS]:
            if u:
                fora("notificacoes", {"user_id": f"eq.{u}"}, "aviso do sino")
    for k in ("grupo_t4", "grupo_sem_menu"):
        if ids.get(k):
            rest("DELETE", "group_members", {"group_id": f"eq.{ids[k]}"}, retorno=False)
            fora("groups", {"id": f"eq.{ids[k]}"}, "grupo")
    pessoas = [ids[k] for k in ids if k.startswith("pessoa_")]
    if pessoas:
        fora("people", {"id": "in.(" + ",".join(pessoas) + ")"}, "pessoa")
    if dona:
        rest("DELETE", "profiles", {"user_id": f"eq.{dona}"}, retorno=False)
        print(f"apagado o perfil {dona}")
    for p in PAPEIS:
        if ids.get(f"login_{p}"):
            _auth_admin("DELETE", f"users/{ids[f'login_{p}']}")
            print(f"apagado o login {p} {ids[f'login_{p}']}")
    if dona:
        sobra = {t: rest("GET", t, {"mentor_id": f"eq.{dona}", "select": "id"})
                 for t in ("biblioteca_pastas", "biblioteca_materiais", "groups", "people")}
        assert not any(sobra.values()), f"sobrou: {sobra}"
        print("conta fictícia sem resto.")


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    if cmd == "criar" and len(sys.argv) >= 3:
        criar(sys.argv[2])
    elif cmd == "link" and len(sys.argv) >= 4:
        link(sys.argv[2], sys.argv[3], sys.argv[4] if len(sys.argv) > 4 else None)
    elif cmd == "provar" and len(sys.argv) >= 3:
        sys.exit(1 if provar(sys.argv[2]) else 0)
    elif cmd == "apagar" and len(sys.argv) >= 3:
        apagar(sys.argv[2])
    else:
        sys.exit(__doc__)
