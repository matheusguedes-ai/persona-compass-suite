"""
Aplica o conteúdo de um teste no banco, via API REST.

Por que não pelo editor SQL: o editor do Supabase já cortou script no meio
mostrando "Success", e já mostrou o resultado de uma execução anterior. Duas
vezes isso fez a gente acreditar que uma coisa tinha sido aplicada quando não
tinha. Pela REST cada passo devolve o que gravou, e dá para conferir.

Uso, a partir de um módulo de conteúdo que exponha VERSION, DIMS e blocos():
    python3 scripts/aplicar_conteudo.py conteudo_disc
"""
import json
import os
import sys
import urllib.error
import urllib.request

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(RAIZ, "scripts"))


def ambiente():
    env = {}
    for nome in (".env.local", ".env"):
        caminho = os.path.join(RAIZ, nome)
        if not os.path.exists(caminho):
            continue
        for linha in open(caminho, encoding="utf-8"):
            linha = linha.strip()
            if not linha or linha.startswith("#") or "=" not in linha:
                continue
            k, v = linha.split("=", 1)
            env.setdefault(k.strip(), v.strip().strip('"').strip("'"))
    url = env.get("SUPABASE_URL") or env.get("VITE_SUPABASE_URL")
    key = env.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        sys.exit("Faltou SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY no .env.local")
    return url.rstrip("/"), key


URL, KEY = ambiente()


def chamar(metodo, caminho, corpo=None, retorno=False):
    req = urllib.request.Request(
        f"{URL}/rest/v1/{caminho}",
        method=metodo,
        data=json.dumps(corpo).encode() if corpo is not None else None,
        headers={
            "apikey": KEY,
            "Authorization": f"Bearer {KEY}",
            "Content-Type": "application/json",
            "Prefer": "return=representation" if retorno else "return=minimal",
        },
    )
    try:
        with urllib.request.urlopen(req) as r:
            texto = r.read().decode()
            return json.loads(texto) if texto.strip() else None
    except urllib.error.HTTPError as e:
        sys.exit(f"{metodo} {caminho} falhou ({e.code}): {e.read().decode()[:400]}")


def aplicar(version_id, dims, blocos, rotulo):
    """
    blocos: lista de dicionários
      {prompt, type, required, config, opcoes: [{label, dim, points}]}
    A ordem da lista vira o sort_order, e a ordem de `opcoes` vira a ordem
    na tela — é ali que mora o embaralhamento de posição.
    """
    # Recusa mexer num teste que já tem resposta enviada: apagar as perguntas
    # levaria junto as respostas cruas de quem já respondeu.
    enviadas = chamar(
        "GET", f"test_responses?version_id=eq.{version_id}&submitted_at=not.is.null&select=id", retorno=True
    )
    if enviadas:
        sys.exit(f"{rotulo}: {len(enviadas)} resposta(s) já enviada(s). Não vou apagar as perguntas.")

    chamar("DELETE", f"test_questions?version_id=eq.{version_id}")
    restou = chamar("GET", f"test_questions?version_id=eq.{version_id}&select=id", retorno=True)
    assert not restou, f"{rotulo}: sobraram perguntas antigas"

    novas = chamar("POST", "test_questions", [
        {
            "version_id": version_id,
            "prompt": b["prompt"],
            "type": b.get("type", "forced_choice"),
            "sort_order": i,
            "required": b.get("required", True),
            "config": b.get("config", {}),
        }
        for i, b in enumerate(blocos, start=1)
    ], retorno=True)
    porOrdem = {q["sort_order"]: q["id"] for q in novas}

    opcoes_payload = []
    for i, b in enumerate(blocos, start=1):
        for j, o in enumerate(b.get("opcoes", []), start=1):
            opcoes_payload.append({"question_id": porOrdem[i], "label": o["label"], "sort_order": j})
    if opcoes_payload:
        criadas = chamar("POST", "test_options", opcoes_payload, retorno=True)
        # Casa cada opção criada de volta com a dimensão, por (pergunta, posição).
        porChave = {(o["question_id"], o["sort_order"]): o["id"] for o in criadas}
        notas = []
        for i, b in enumerate(blocos, start=1):
            for j, o in enumerate(b.get("opcoes", []), start=1):
                if not o.get("dim"):
                    continue
                notas.append({
                    "option_id": porChave[(porOrdem[i], j)],
                    "dimension_id": dims[o["dim"]],
                    "points": o.get("points", 1),
                })
        if notas:
            chamar("POST", "option_scores", notas)

    conferido = chamar(
        "GET",
        f"test_questions?version_id=eq.{version_id}&select=id,sort_order,test_options(id,option_scores(points))",
        retorno=True,
    )
    n_opcoes = sum(len(q["test_options"]) for q in conferido)
    n_notas = sum(len(o["option_scores"]) for q in conferido for o in q["test_options"])
    print(f"{rotulo}: {len(conferido)} perguntas, {n_opcoes} opções, {n_notas} pontuações")
    return len(conferido), n_opcoes, n_notas


def sql(version_id, dims, blocos, titulo):
    """
    O mesmo conteúdo em SQL, para ficar registrado em supabase/migrations.

    A aplicação de verdade é pela REST (acima). Este arquivo existe porque a
    convenção do projeto é ter no repositório o SQL de tudo que mudou no banco:
    sem ele, o conteúdo dos testes só existiria no banco de produção.
    """
    def esc(t):
        return "'" + str(t).replace("'", "''") + "'"

    linhas = [f"-- {titulo}", "-- Gerado por scripts/aplicar_conteudo.py a partir do módulo de conteúdo.", "",
              f"delete from public.test_questions where version_id = '{version_id}';", ""]
    for i, b in enumerate(blocos, start=1):
        cfg = json.dumps(b.get("config", {}), ensure_ascii=False)
        linhas += [
            f"with q{i:02d} as (",
            "  insert into public.test_questions (version_id, prompt, type, sort_order, required, config)",
            f"  values ('{version_id}', {esc(b['prompt'])}, '{b.get('type', 'forced_choice')}',"
            f" {i}, {str(b.get('required', True)).lower()}, {esc(cfg)}::jsonb)",
            "  returning id",
            "), o as (",
            "  insert into public.test_options (question_id, label, sort_order)",
            f"  select q{i:02d}.id, v.label, v.ord from q{i:02d}, (values",
            ",\n".join(f"    ({esc(op['label'])}, {j})" for j, op in enumerate(b["opcoes"], start=1)),
            "  ) as v(label, ord) returning id, sort_order",
            ")",
            "insert into public.option_scores (option_id, dimension_id, points)",
            "select o.id, v.dim, v.pts from o join (values",
            ",\n".join(
                f"    ({j}, '{dims[op['dim']]}'::uuid, {op.get('points', 1)})"
                for j, op in enumerate(b["opcoes"], start=1)
            ),
            "  ) as v(ord, dim, pts) on v.ord = o.sort_order;",
            "",
        ]
    return "\n".join(linhas)


if __name__ == "__main__":
    modulo = __import__(sys.argv[1])
    aplicar(modulo.VERSION, modulo.DIMS, modulo.blocos(), sys.argv[1])
