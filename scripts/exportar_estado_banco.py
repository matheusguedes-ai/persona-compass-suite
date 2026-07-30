#!/usr/bin/env python3
"""
Baixa do banco o que as migrações NÃO reconstroem, e grava no repositório.

O problema que isto resolve: `supabase/migrations/` não bastava para recriar a
plataforma. Faltavam tabelas criadas direto pelo editor SQL, policies que
nunca viraram arquivo, e — o mais caro — os 502 blocos de texto de relatório,
que entraram pela REST e só existiam no banco em produção. Numa restauração ou
troca de banco, o relatório voltaria mais pobre **sem avisar ninguém**.

Gera dois arquivos, versionados no git:

  supabase/estado/schema.sql      — tabelas, colunas, policies, funções e
                                    índices, como estão no banco AGORA. Serve
                                    de retrato e de diff: `git diff` mostra
                                    quando uma policy mudou fora de migração.
  supabase/estado/conteudo.json   — report_content e test_result_bands, que são
                                    conteúdo e não estrutura.

Isto NÃO substitui as migrações: elas continuam sendo a história. Isto é a
fotografia do resultado, para responder "o repositório sozinho reconstrói a
plataforma?" com sim.

Uso:  python3 scripts/exportar_estado_banco.py
Restaurar conteúdo:  python3 scripts/exportar_estado_banco.py --restaurar
"""
import json
import os
import sys
import urllib.request

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DESTINO = os.path.join(RAIZ, "supabase", "estado")

# Conteúdo — não estrutura. O que se perde numa restauração e ninguém percebe.
TABELAS_DE_CONTEUDO = ["report_content", "test_result_bands"]


def env():
    """Lê .env.local sem depender de biblioteca — é o padrão dos outros scripts."""
    vals = {}
    for nome in (".env.local", ".env"):
        caminho = os.path.join(RAIZ, nome)
        if not os.path.exists(caminho):
            continue
        for linha in open(caminho, encoding="utf-8"):
            linha = linha.strip()
            if not linha or linha.startswith("#") or "=" not in linha:
                continue
            k, v = linha.split("=", 1)
            vals.setdefault(k.strip(), v.strip().strip('"').strip("'"))
    url = vals.get("SUPABASE_URL") or vals.get("VITE_SUPABASE_URL")
    key = vals.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        sys.exit("Faltam SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local")
    return url.rstrip("/"), key


def rest(url, key, caminho, metodo="GET", corpo=None):
    req = urllib.request.Request(
        f"{url}/rest/v1/{caminho}",
        method=metodo,
        data=json.dumps(corpo).encode() if corpo is not None else None,
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal" if metodo != "GET" else "",
        },
    )
    with urllib.request.urlopen(req) as r:
        txt = r.read().decode()
    return json.loads(txt) if txt.strip() else None


def exportar():
    url, key = env()
    os.makedirs(DESTINO, exist_ok=True)

    # --- 1. Estrutura, pela função de catálogo (migração 20260730260000) ---
    try:
        ddl = rest(url, key, "rpc/retrato_do_schema", "POST", {})
        texto = ddl if isinstance(ddl, str) else json.dumps(ddl, ensure_ascii=False)
        cabecalho = (
            "-- RETRATO DO BANCO. Gerado por scripts/exportar_estado_banco.py.\n"
            "-- Nao editar a mao: rode o script de novo.\n"
            "--\n"
            "-- Isto NAO substitui supabase/migrations/ -- elas sao a historia.\n"
            "-- Isto e o resultado, para o `git diff` acusar policy que mudou\n"
            "-- fora de migracao.\n\n"
        )
        with open(os.path.join(DESTINO, "schema.sql"), "w", encoding="utf-8") as f:
            f.write(cabecalho + texto + "\n")
        print(f"schema.sql · {len(texto.splitlines())} linhas")
    except Exception as e:  # noqa: BLE001
        print(f"⚠️  schema.sql não saiu ({e}). A função retrato_do_schema existe no banco?")

    # --- 2. Conteúdo ---
    conteudo = {}
    for tabela in TABELAS_DE_CONTEUDO:
        linhas = rest(url, key, f"{tabela}?select=*") or []
        # Sem os ids: numa restauração eles nascem de novo, e mantê-los faria o
        # diff acusar mudança a cada exportação sem nada ter mudado.
        for l in linhas:
            l.pop("id", None)
            l.pop("created_at", None)
        linhas.sort(key=lambda x: json.dumps(x, sort_keys=True, ensure_ascii=False))
        conteudo[tabela] = linhas
        print(f"{tabela} · {len(linhas)} registros")

    with open(os.path.join(DESTINO, "conteudo.json"), "w", encoding="utf-8") as f:
        json.dump(conteudo, f, ensure_ascii=False, indent=1, sort_keys=True)


def restaurar():
    """Devolve o conteúdo ao banco. Só insere o que falta — não apaga nada."""
    url, key = env()
    with open(os.path.join(DESTINO, "conteudo.json"), encoding="utf-8") as f:
        conteudo = json.load(f)

    for tabela, linhas in conteudo.items():
        atuais = rest(url, key, f"{tabela}?select=*") or []
        if atuais:
            print(f"{tabela} · já tem {len(atuais)} registros, pulando")
            continue
        # Em lotes: 500 linhas de texto num POST só estoura o limite da REST.
        for i in range(0, len(linhas), 100):
            rest(url, key, tabela, "POST", linhas[i : i + 100])
        print(f"{tabela} · {len(linhas)} registros restaurados")


if __name__ == "__main__":
    if "--restaurar" in sys.argv:
        restaurar()
    else:
        exportar()
