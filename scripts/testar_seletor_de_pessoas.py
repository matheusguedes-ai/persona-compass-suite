"""
Prova de que o seletor de pessoas (`listarPessoasParaEscolher`, #314) lê a conta INTEIRA acima de 1.000.

O seletor é o mesmo em quatro telas — novo evento da Agenda, "Criar mentoria", "Quem acessa" da Academy e
"Liberar ou bloquear" da Biblioteca. Numa consulta só, a API entregava as 1.000 primeiras pessoas e cortava
o resto sem avisar.

Monta uma conta FICTÍCIA (nunca a real) com 1.050 pessoas — 350 delas com o MESMO nome, de propósito: é
nome repetido que faz páginas repetirem ou pularem gente quando a ordem não termina numa coluna única.

Uso:
  python3 scripts/testar_seletor_de_pessoas.py criar arq.json    # dona + 1.050 pessoas; grava os ids
  python3 scripts/testar_seletor_de_pessoas.py link arq.json     # link mágico da dona (para o app local)
  python3 scripts/testar_seletor_de_pessoas.py provar arq.json   # consulta única × páginas pequenas
  python3 scripts/testar_seletor_de_pessoas.py apagar arq.json   # apaga tudo, citando os ids

Os ids são gravados no arquivo ANTES de qualquer teste (constituição: "prova que a limpeza apaga não é prova").
"""
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from testar_ipsativo import rest, _env  # noqa: E402
from fixture_biblioteca import _auth_admin, _chave_publica, _link_magico, _sessao  # noqa: E402

DOMINIO = "@exemplo.invalido"
TOTAL = 1050
REPETIDOS = 350


def _email_dona(ids):
    return f"teste-seletor-314-{ids['rodada']}{DOMINIO}"


def criar(arquivo):
    ids = {"rodada": os.urandom(3).hex()}

    def grava():
        with open(arquivo, "w") as f:
            json.dump(ids, f, indent=2)

    ids["login_dona"] = _auth_admin("POST", "users", {"email": _email_dona(ids), "email_confirm": True,
                                                      "user_metadata": {"full_name": "ZZ Dona do Seletor 314"}})["id"]
    grava()
    print("login_dona =", ids["login_dona"])
    rest("POST", "profiles", corpo=[{"user_id": ids["login_dona"], "full_name": "ZZ Dona do Seletor 314"}], retorno=False)
    linhas = []
    for n in range(TOTAL):
        nome = "ZZ Pessoa Repetida 314" if n < REPETIDOS else f"ZZ Pessoa 314-{n:04d}"
        linhas.append({"mentor_id": ids["login_dona"], "full_name": nome,
                       "email": f"teste-seletor-314-{ids['rodada']}-{n:04d}{DOMINIO}"})
    ids["pessoas"] = []
    for i in range(0, len(linhas), 350):
        criadas = rest("POST", "people", corpo=linhas[i:i + 350])
        ids["pessoas"] += [p["id"] for p in criadas]
        grava()
    print(f"{len(ids['pessoas'])} pessoas criadas na conta fictícia (primeira {ids['pessoas'][0]}, "
          f"última {ids['pessoas'][-1]}) — todos os ids em {arquivo}")


def link(arquivo):
    ids = json.load(open(arquivo))
    print(_link_magico(_email_dona(ids)))


def _get(token, params, extra=None):
    url, _ = _env()
    q = urllib.parse.urlencode(params, safe="(),.*:")
    req = urllib.request.Request(f"{url}/rest/v1/people?{q}", headers={
        "apikey": _chave_publica(), "Authorization": f"Bearer {token}", "Prefer": "count=exact", **(extra or {})})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.headers.get("Content-Range"), json.loads(r.read().decode())


def provar(arquivo):
    ids = json.load(open(arquivo))
    esperado = set(ids["pessoas"])
    tok = _sessao(_email_dona(ids))
    # 1. O jeito ANTIGO: uma consulta só, ordenada por nome.
    cr, linhas = _get(tok, {"select": "id,full_name,email", "order": "full_name"})
    print(f"consulta única (código antigo): veio {len(linhas)} de {cr.split('/')[1]} — faltaram "
          f"{len(esperado - {l['id'] for l in linhas})} pessoas, sem erro nenhum")
    # 2. O jeito NOVO, com páginas pequenas de propósito: ordem por nome E id.
    falhas = 0
    for lote in (7, 100, 1000):
        vistos, repetidos, de = [], 0, 0
        while True:
            cr, pag = _get(tok, {"select": "id,full_name,email", "order": "full_name.asc,id.asc",
                                 "offset": de, "limit": lote})
            if not pag:
                break
            vistos += [p["id"] for p in pag]
            de += len(pag)
            if de >= int(cr.split("/")[1]):
                break
        repetidos = len(vistos) - len(set(vistos))
        faltando = len(esperado - set(vistos))
        ok = repetidos == 0 and faltando == 0 and len(vistos) == len(esperado)
        falhas += 0 if ok else 1
        print(f"páginas de {lote:>4}: juntei {len(vistos)} · repetidas {repetidos} · faltando {faltando} "
              f"{'✓' if ok else '✗'}")
    print("\nTUDO CERTO" if not falhas else f"\n{falhas} FALHA(S)")
    return falhas


def apagar(arquivo):
    ids = json.load(open(arquivo))
    dona = ids.get("login_dona")
    pessoas = ids.get("pessoas", [])
    if pessoas:
        print(f"apagando {len(pessoas)} pessoas da conta fictícia {dona}: primeira {pessoas[0]}, última "
              f"{pessoas[-1]} (lista completa em {arquivo})")
        for i in range(0, len(pessoas), 150):
            rest("DELETE", "people", {"id": "in.(" + ",".join(pessoas[i:i + 150]) + ")"}, retorno=False)
    if dona:
        rest("DELETE", "people", {"mentor_id": f"eq.{dona}"}, retorno=False)  # nada deve sobrar; garante
        rest("DELETE", "profiles", {"user_id": f"eq.{dona}"}, retorno=False)
        print(f"apagado o perfil {dona}")
        _auth_admin("DELETE", f"users/{dona}")
        print(f"apagado o login {dona}")
        sobra = rest("GET", "people", {"mentor_id": f"eq.{dona}", "select": "id", "limit": "1"})
        assert not sobra, f"sobrou pessoa: {sobra}"
        print("conta fictícia sem resto.")


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    if cmd in ("criar", "link", "provar", "apagar") and len(sys.argv) >= 3:
        r = {"criar": criar, "link": link, "provar": provar, "apagar": apagar}[cmd](sys.argv[2])
        sys.exit(1 if cmd == "provar" and r else 0)
    sys.exit(__doc__)
