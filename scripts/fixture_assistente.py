"""
Pessoa FICTÍCIA para testar a assistente (#289) — nunca aluno de verdade.

Avaliar a assistente manda o relatório para a API da Anthropic. Nenhum aluno real autorizou isso
ainda, então os testes usam só esta pessoa inventada, criada na conta do dono do produto e apagada no
fim. Os ids são IMPRESSOS antes de qualquer coisa, para a prova continuar conferível depois da limpeza
(constituição: "prova que a limpeza apaga não é prova").

Uso:
  python3 scripts/fixture_assistente.py criar [--login]   # imprime pessoa, resposta (e login)
  python3 scripts/fixture_assistente.py apagar <pessoa_id> [<user_id>]

--login cria também um login descartável (e-mail @exemplo.invalido, sem senha) ligado à pessoa e
libera a assistente só para ele — é o caminho real do aluno, para testar a tela ponta a ponta.
Precisa do servidor local (localhost:8080): a resposta entra pelo mesmo endpoint que o aluno usa.
"""
import json
import os
import random
import sys
import urllib.error
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from testar_ipsativo import carregar_estrutura, rest  # noqa: E402
from ipsativo_oraculo import sortear_escolhas  # noqa: E402
from testar_ipsativo import _env  # noqa: E402

APP = "http://localhost:8080"
VERSAO_DISC = "f9c6aba8-115b-4c59-9d35-9c1f995b3eb9"
NOME = "ZZ Teste Assistente 289 (fictícia — apagar)"


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


def criar(com_login=False):
    est = carregar_estrutura(VERSAO_DISC)
    mentor = rest("GET", "test_versions", {"id": f"eq.{VERSAO_DISC}", "select": "mentor_id"})[0]["mentor_id"]
    rodada = os.urandom(3).hex()
    email = f"teste-assistente-{rodada}@exemplo.invalido"
    pessoa = rest("POST", "people", corpo=[{"full_name": NOME, "email": email, "mentor_id": mentor}])[0]
    print(f"pessoa_id={pessoa['id']}")
    resp = rest("POST", "test_responses", corpo=[{
        "version_id": VERSAO_DISC, "person_id": pessoa["id"], "mentor_id": mentor,
        "kind": "self", "status": "in_progress",
    }])[0]
    print(f"resposta_id={resp['id']}")
    # Peso por letra: D forte, I logo atrás — um perfil combinado de verdade, sem letra "sem sinal".
    dims = {d["key"]: d["id"] for d in rest("GET", "test_dimensions", {"version_id": f"eq.{VERSAO_DISC}", "select": "id,key"})}
    pesos = {dims["D"]: 3.0, dims["I"]: 2.4, dims["S"]: 0.8, dims["C"]: 0.7}
    mais, menos = sortear_escolhas({"letra_da_opcao": est["letra_da_opcao"], "blocos": est["blocos"]},
                                   random.Random("assistente-289"), pesos)
    st = _post(f"/api/public/response/{resp['id']}", {"answers": [
        {"question_id": b["id"], "payload": {"most_option_id": mais[k], "least_option_id": menos[k]}}
        for k, b in enumerate(est["blocos"])]})
    if st != 200:
        sys.exit(f"não consegui enviar a resposta (HTTP {st})")
    cs = rest("GET", "test_responses", {"id": f"eq.{resp['id']}", "select": "computed_scores"})[0]["computed_scores"]
    perfil = ((cs or {}).get("ipsativo") or {}).get("natural", {}).get("perfil", {})
    print(f"perfil natural: {perfil.get('codigo')} ({perfil.get('tipo')})")
    if com_login:
        user = _auth_admin("POST", "users", {"email": email, "email_confirm": True,
                                             "user_metadata": {"full_name": NOME}})
        print(f"user_id={user['id']}")
        print(f"email={email}")
        rest("PATCH", "people", {"id": f"eq.{pessoa['id']}"}, corpo={"user_id": user["id"]})
        rest("POST", "assistente_liberacoes", corpo=[{"conta_id": mentor, "user_id": user["id"]}])
        print("assistente liberada só para este login")


def apagar(pessoa_id, user_id=None):
    # Ordem: o que aponta para a pessoa primeiro. As conversas/consentimento caem junto com o login.
    rest("DELETE", "test_responses", {"person_id": f"eq.{pessoa_id}"}, retorno=False)
    rest("DELETE", "people", {"id": f"eq.{pessoa_id}"}, retorno=False)
    print(f"apagada a pessoa {pessoa_id} e as respostas dela")
    if user_id:
        _auth_admin("DELETE", f"users/{user_id}")
        print(f"apagado o login {user_id} (conversas, consentimento e liberação caem em cascata)")


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    if cmd == "criar":
        criar("--login" in sys.argv)
    elif cmd == "apagar" and len(sys.argv) >= 3:
        apagar(sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else None)
    else:
        sys.exit(__doc__)
