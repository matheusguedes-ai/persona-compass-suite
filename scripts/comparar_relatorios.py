#!/usr/bin/env python3
"""
Compara relatórios ANTES × DEPOIS de uma mudança no montador (report.server.ts), campo a campo.

  python3 scripts/comparar_relatorios.py capturar --app URL --saida DIR
      Guarda em DIR o relatório (e o da bateria) de TODA resposta enviada que existe no banco.
      Só lê: consulta o banco por REST (GET) e chama as rotas públicas de relatório (GET).

  python3 scripts/comparar_relatorios.py comparar --app URL --base DIR
      Pede de novo os mesmos relatórios e compara com o que foi guardado: mesmo status HTTP, mesmo
      JSON (igualdade exata, campo a campo) e, de brinde, se o texto é idêntico byte a byte.

O único trecho normalizado é o token da URL assinada do logo (`brand.logo_url`), que muda a cada
pedido por desenho (o bucket é privado). Todo o resto tem de ser IGUAL.

Não cria nem altera nada no banco. Nunca imprime nomes de pessoas nem chaves.
Em produção precisa de User-Agent de navegador (o Cloudflare recusa o do Python).
"""
import argparse, hashlib, json, os, re, sys, urllib.error, urllib.parse, urllib.request

RAIZ = os.getcwd()
UA = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"}


def _env():
    env = {}
    for linha in open(os.path.join(RAIZ, ".env.local"), encoding="utf-8"):
        linha = linha.strip()
        if linha and not linha.startswith("#") and "=" in linha:
            k, v = linha.split("=", 1)
            env[k] = v.strip().strip('"').strip("'")
    return env["SUPABASE_URL"].rstrip("/"), env["SUPABASE_SERVICE_ROLE_KEY"]


URL, KEY = _env()


def rest_get(tabela, params):
    q = urllib.parse.urlencode(params, safe="(),.*:")
    req = urllib.request.Request(f"{URL}/rest/v1/{tabela}?{q}", headers={"apikey": KEY, "Authorization": f"Bearer {KEY}"})
    with urllib.request.urlopen(req) as r:
        return json.load(r)


def app_get(url):
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers=UA)) as r:
            return r.status, r.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()


def normalizar(corpo_bytes):
    """Tira só o token da URL assinada do logo."""
    texto = corpo_bytes.decode("utf-8")
    return re.sub(r"(/storage/v1/object/sign/[^\"?]+)\?token=[^\"&]+", r"\1?token=X", texto)


def diferencas(a, b, caminho="$"):
    difs = []
    if isinstance(a, dict) and isinstance(b, dict):
        for k in sorted(set(a) | set(b)):
            if k not in a:
                difs.append(f"{caminho}.{k}: só depois")
            elif k not in b:
                difs.append(f"{caminho}.{k}: só antes")
            else:
                difs += diferencas(a[k], b[k], f"{caminho}.{k}")
    elif isinstance(a, list) and isinstance(b, list):
        if len(a) != len(b):
            difs.append(f"{caminho}: {len(a)} itens antes × {len(b)} depois")
        for i, (x, y) in enumerate(zip(a, b)):
            difs += diferencas(x, y, f"{caminho}[{i}]")
    elif a != b or type(a) is not type(b):
        sa, sb = repr(a), repr(b)
        difs.append(f"{caminho}: {sa[:70]} antes × {sb[:70]} depois")
    return difs


def caminho_da_rota(entrada):
    return f"/api/public/report-bateria/{entrada['id']}" if entrada["instrumento"] == "BATERIA" else f"/api/public/report/{entrada['id']}"


def cmd_capturar(args):
    os.makedirs(args.saida, exist_ok=True)
    respostas = rest_get("test_responses", {"submitted_at": "not.is.null", "select": "id,assessment_response_id,test_versions(instrument_id)", "order": "submitted_at"})
    indice, baterias = [], set()
    for r in respostas:
        inst = r["test_versions"]["instrument_id"]
        entrada = {"instrumento": inst, "id": r["id"], "bateria": r["assessment_response_id"]}
        st, corpo = app_get(args.app.rstrip("/") + caminho_da_rota(entrada))
        open(os.path.join(args.saida, f"{inst}-{r['id']}.json"), "wb").write(corpo)
        indice.append({**entrada, "http": st})
        if r["assessment_response_id"]:
            baterias.add(r["assessment_response_id"])
    for b in sorted(baterias):
        entrada = {"instrumento": "BATERIA", "id": b, "bateria": None}
        st, corpo = app_get(args.app.rstrip("/") + caminho_da_rota(entrada))
        open(os.path.join(args.saida, f"bateria-{b}.json"), "wb").write(corpo)
        indice.append({**entrada, "http": st})
    json.dump(indice, open(os.path.join(args.saida, "_indice.json"), "w"), indent=1)
    print(f"{len(indice)} relatórios guardados em {args.saida}")
    return 0


def cmd_comparar(args):
    indice = json.load(open(os.path.join(args.base, "_indice.json")))
    ruim = 0
    print(f"{'instrumento':14} {'id':38} http   resultado")
    for e in indice:
        antes = open(os.path.join(args.base, f"{e['instrumento'].lower() if e['instrumento'] == 'BATERIA' else e['instrumento']}-{e['id']}.json"), "rb").read()
        st, depois = app_get(args.app.rstrip("/") + caminho_da_rota(e))
        na, nd = normalizar(antes), normalizar(depois)
        if st != e["http"]:
            res = f"STATUS DIFERENTE ({e['http']} antes × {st} depois)"
            ruim += 1
        elif na == nd:
            res = f"IDÊNTICO byte a byte ({hashlib.sha256(na.encode()).hexdigest()[:10]}, {len(na)} bytes)"
        else:
            try:
                d = diferencas(json.loads(na), json.loads(nd))
            except Exception as ex:  # corpo não é JSON
                d = [f"corpo não comparável: {ex}"]
            if not d:
                res = "igual campo a campo (só a ordem/formatação do texto difere)"
            else:
                res = f"DIFERENTE em {len(d)} campo(s): " + " | ".join(d[:6])
                ruim += 1
        print(f"{e['instrumento']:14} {e['id']:38} {st:<6} {res}")
    print("\nRESULTADO:", "TUDO IDÊNTICO" if not ruim else f"{ruim} DIFERENÇA(S)")
    return 1 if ruim else 0


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    c = sub.add_parser("capturar"); c.add_argument("--app", required=True); c.add_argument("--saida", required=True)
    m = sub.add_parser("comparar"); m.add_argument("--app", required=True); m.add_argument("--base", required=True)
    a = ap.parse_args()
    sys.exit({"capturar": cmd_capturar, "comparar": cmd_comparar}[a.cmd](a))


if __name__ == "__main__":
    main()
