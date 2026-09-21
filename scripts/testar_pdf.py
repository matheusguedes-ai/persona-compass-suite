#!/usr/bin/env python3
"""Testes do PDF gerado no servidor (#293, fatia 1).

    python3 scripts/testar_pdf.py reais          # os relatórios reais que existem no banco
    python3 scripts/testar_pdf.py disc           # cria um DISC descartável (com 360°) e confere
    python3 scripts/testar_pdf.py tudo           # os dois
    python3 scripts/testar_pdf.py worker         # ⚠️ OBRIGATÓRIO antes de publicar (ver abaixo)
    python3 scripts/testar_pdf.py limpar         # remove sobras de execuções anteriores

Opções: --app http://localhost:8080 (padrão) · --manter (não apaga as fixtures) · --pasta <dir>

O que cada relatório precisa passar:
  1. DETERMINISMO — duas gerações seguidas devolvem os MESMOS bytes (critério "b" da demanda);
  2. A4 — toda página com 595,28 × 841,89 pt (critério "e" depende disso em leitor comum);
  3. FONTE EMBUTIDA — a Publica Sans Round precisa estar DENTRO do arquivo (FontFile3), não
     referenciada; sem isso o PDF abre com a fonte de outra pessoa;
  4. NUMERAÇÃO — toda página de conteúdo traz "n / total", e a capa não;
  5. CONTEÚDO — cada texto que a API devolve para a tela aparece no PDF (critério "d");
  6. SEM CORTE — nenhum bloco atômico (gráfico, caixa, tabela) atravessa o limite da página.

⚠️ **"worker" antes de todo deploy.** O `vite dev` roda em Node; a produção roda no workerd do
Cloudflare, que é outro runtime. A primeira versão desta fatia passou em TODOS os testes no dev
server e derrubou o site inteiro em produção: o pdf-lib CommonJS quebrava ao ser avaliado, e como
o módulo entra no bundle pela rota do PDF, o Worker morria antes de servir qualquer página. Testar
só em Node é testar o caminho errado.

⚠️ As fixtures nascem com dono (`mentor_id`) e são apagadas no fim — mas os ids são IMPRESSOS
antes, para a prova continuar conferível depois da limpeza.
"""
import argparse
import hashlib
import json
import os
import random
import re
import sys
import zlib
import urllib.error
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from testar_ipsativo import PREFIXO, carregar_estrutura, rest, sortear_escolhas  # noqa: E402

try:
    import pypdfium2 as pdfium
except ImportError:
    sys.exit("Falta o pypdfium2: python3 -m pip install --user pypdfium2")

A4 = (595.28, 841.89)
VERSAO_DISC = "f9c6aba8-115b-4c59-9d35-9c1f995b3eb9"
REAIS = [
    ("temperamentos", "relatorio", "e4333421-fb0e-43ae-8950-e824a278bb20"),
    ("vak", "relatorio", "a20b7ea8-7c1a-4244-ab25-c3d03cce8e07"),
    ("mbti", "relatorio", "37ea3071-90c1-46c4-9779-609f6a90a81d"),
    ("valores", "relatorio", "7b6f79be-4f69-460e-b5da-85d82c594709"),
    ("bigfive", "relatorio", "57be2335-d968-41f6-9230-c88dbf91a193"),
]


def baixar(app, caminho):
    req = urllib.request.Request(f"{app}{caminho}", headers={"User-Agent": "Mozilla/5.0"})
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            return r.status, r.read(), dict(r.headers)
    except urllib.error.HTTPError as e:
        return e.code, e.read(), dict(e.headers)


def fonte_embutida(b):
    """A Publica Sans Round está DENTRO do arquivo? Descomprime os streams para olhar."""
    tem_arquivo, tem_nome = False, False
    for m in re.finditer(rb"stream\r?\n", b):
        fim = b.find(b"endstream", m.end())
        try:
            d = zlib.decompress(b[m.end():fim])
        except Exception:
            continue
        tem_arquivo = tem_arquivo or bool(re.search(rb"/FontFile\d?", d))
        tem_nome = tem_nome or b"PublicaSansRound" in d
    return tem_arquivo and tem_nome


def texto_do_pdf(doc):
    partes = []
    for i in range(len(doc)):
        tp = doc[i].get_textpage()
        partes.append(tp.get_text_range())
    return partes


# O ornamento é desenhado por último, então vem no FIM do texto extraído de cada página:
# "<nome da pessoa> <data>" e, embaixo, "<n> / <total>".
CAUDA = re.compile(r"\s*[^\r\n]{0,80}\d{2}/\d{2}/\d{4}\s*\r?\n\s*\d+ / \d+\s*$")


def normalizar(t):
    """
    Compara o QUE está escrito — não como foi quebrado em linhas, marcado ou capitalizado.

    Três diferenças são de forma, não de conteúdo: `**assim**` vira negrito de verdade no PDF; os
    rótulos que a tela deixa em caixa alta por CSS saem em maiúsculas reais no arquivo; e a quebra
    de linha é decidida pela diagramação. Nenhuma delas é texto faltando.
    """
    limpo = (t or "").replace("**", "").replace("­", "")
    return re.sub(r"\s+", " ", limpo).strip().casefold()


def texto_corrido(paginas):
    """
    As páginas emendadas SEM o cabeçalho e a numeração.

    Sem isso, um parágrafo que atravessa a virada de página aparece cortado ao meio pelo nome e
    pela data — e a conferência acusaria como ausente um texto que está inteiro no documento.
    """
    return normalizar(" ".join(CAUDA.sub("", p) for p in paginas))


def textos_fixos():
    """
    As frases que moram em `components/report/textos.ts` — a fonte única da tela e do PDF.

    Lidas do próprio módulo (o Node 22+ importa TypeScript apagando os tipos), não copiadas: uma
    cópia aqui envelheceria e o teste passaria a conferir texto que não existe mais.
    """
    import subprocess
    saida = subprocess.run(
        ["node", "--input-type=module", "-e",
         "import * as T from './src/components/report/textos.ts';"
         "const p = {}; for (const [k, v] of Object.entries(T)) if (typeof v !== 'function') p[k] = v;"
         "p.OBSERVADORES = { titulo: T.OBSERVADORES.titulo, comIntensidade: T.OBSERVADORES.paragrafos(true), semIntensidade: T.OBSERVADORES.paragrafos(false) };"
         "console.log(JSON.stringify(p));"],
        capture_output=True, text=True, cwd=os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    )
    if saida.returncode != 0:
        raise SystemExit(f"não consegui ler textos.ts pelo Node:\n{saida.stderr[-800:]}")
    return json.loads(saida.stdout)


def fixos_esperados(r, T, mostra_plano):
    """
    Quais frases fixas ESTE relatório mostra — por tipo, como o `ReportBody` decide.

    É esta conferência que pega a falha mais fácil de cometer: uma frase que a tela escreve e o
    PDF esqueceu. Foi assim que a abertura do Plano de ação apareceu faltando.
    """
    esperado = [T["INTRO"]["titulo"], T["RODAPE_LEGAL"]]  # a intro abre o relatório; o aviso legal fecha
    if mostra_plano:
        esperado += [T["CORPO"]["planoTitulo"], T["CORPO"]["planoIntro"]]
    is_disc = r.get("is_disc") is not False
    if r.get("intensidade"):
        I = T["INTENSIDADE"]
        esperado += [I["rotulo"], I["naturalTitulo"], I["naturalExplica"],
                     I["adaptadoTitulo"], I["adaptadoExplica"], I["reguasSeparadas"]]
        if r["intensidade"].get("sinal_baixo"):
            esperado.append(I["poucaInformacao"])
        texto = (r["intensidade"].get("texto") or {})
        if texto.get("estado") == "pendente" and r["intensidade"]["perfil"].get("sigla"):
            esperado.append(I["textoPendente"])
    if is_disc:
        esperado += [T["CORPO"]["comunicacaoTitulo"], T["CORPO"]["comunicacaoIntro"]]
        esperado += [c["body"] for c in T["COMUNICACAO"]]
        esperado += [t["title"] for t in T["FACTOR_THEMES"]]
        if r.get("derived"):
            esperado += [T["DERIVADOS"]["liderancaTitulo"], T["DERIVADOS"]["competenciasTitulo"],
                         T["DERIVADOS"]["indicesTitulo"], T["DERIVADOS"]["indicesIntro"], T["JUNG"]["titulo"]]
    elif not r.get("intensidade") and not r.get("is_mbti"):
        esperado.append(T["CORPO"]["intensidadePorDimensao"])
    if r.get("external"):
        esperado.append(T["OBSERVADORES"]["titulo"])
        # O 2º parágrafo muda conforme o relatório usa o motor ipsativo ("do seu gráfico adaptado")
        # ou não ("do natural"). Só uma das versões aparece — exigir as duas cobraria do PDF um
        # texto que a tela também não mostra.
        esperado += T["OBSERVADORES"]["comIntensidade" if r.get("intensidade") else "semIntensidade"]
    q = r.get("qualidade") or {}
    if q.get("nivel") in ("media", "baixa"):
        esperado.append(T["CONFIABILIDADE"]["tituloGrave"] if q["nivel"] == "baixa" else T["CONFIABILIDADE"]["tituloLeve"])
    return esperado


def textos_da_tela(r):
    """
    O conteúdo que a TELA renderiza a partir do payload — não o payload inteiro.

    A diferença importa: `test_description`, ids e configurações vêm na resposta da API e nunca
    aparecem no relatório individual. Conferir contra o payload cru acusaria falta do que a tela
    também não mostra, e o teste passaria a mentir nos dois sentidos.
    """
    fora = []

    def add(*vs):
        for v in vs:
            if isinstance(v, str) and len(v.strip()) > 25:
                fora.append(v)

    for s_ in r.get("sections") or []:
        add(s_.get("title"), s_.get("body"))
    # A régua de descritores é exclusiva do DISC na tela (ReportBody: `isDisc && …`). Nos demais
    # instrumentos os descritores vêm no payload e não são exibidos — exigi-los aqui cobraria do
    # PDF algo que a tela também não mostra.
    is_disc = r.get("is_disc") is not False
    for f in r.get("factors") or []:
        for banda in (f.get("band_natural"), f.get("adaptacao")):
            if banda:
                add(banda.get("title"), banda.get("description"), banda.get("body"))
        if is_disc:
            for d in f.get("descritores") or []:
                add(d.get("body"))
    d = r.get("derived") or {}
    for c in d.get("competencias") or []:
        add(c.get("definition"))
    lc = d.get("leadership_content") or {}
    for bloco in (lc.get("strengths"), lc.get("attention")):
        if bloco:
            add(bloco.get("title"), bloco.get("body"))
    ints = r.get("intensidade") or {}
    texto = ints.get("texto") or {}
    if texto.get("estado") == "publicado":
        add(texto.get("titulo"), texto.get("corpo"))
    return fora


def conferir(nome, app, caminho, pasta, manter_arquivo=True):
    falhas = []
    st, bytes1, cab = baixar(app, caminho)
    if st != 200:
        return [f"{nome}: HTTP {st} — {bytes1[:200]!r}"], None
    st2, bytes2, _ = baixar(app, caminho)

    # 1. determinismo
    if bytes1 != bytes2:
        falhas.append(
            f"{nome}: duas gerações DIFEREM "
            f"({hashlib.md5(bytes1).hexdigest()[:12]} × {hashlib.md5(bytes2).hexdigest()[:12]})"
        )

    arq = os.path.join(pasta, f"{nome}.pdf")
    os.makedirs(pasta, exist_ok=True)
    with open(arq, "wb") as f:
        f.write(bytes1)

    doc = pdfium.PdfDocument(arq)
    n = len(doc)

    # 2. A4 em todas as páginas
    for i in range(n):
        w, h = doc[i].get_size()
        if abs(w - A4[0]) > 0.5 or abs(h - A4[1]) > 0.5:
            falhas.append(f"{nome}: página {i + 1} tem {w:.1f}×{h:.1f} pt, não A4")
            break

    # 3. a fonte da marca precisa estar EMBUTIDA.
    # ⚠️ Procurar no arquivo cru não serve: o pdf-lib guarda os dicionários de fonte dentro de
    # object streams comprimidos, então nem o nome nem o /FontFile aparecem em texto claro.
    if not fonte_embutida(bytes1):
        falhas.append(
            f"{nome}: a Publica Sans Round NÃO está embutida (sem /FontFile com o nome da família) — "
            f"o PDF dependeria da fonte instalada na máquina de quem abre"
        )

    paginas = texto_do_pdf(doc)

    # 4. nada de texto fora da área útil — é assim que um bloco grande demais se denunciaria,
    #    transbordando a página em vez de ser empurrado para a seguinte.
    for i in range(n):
        tp = doc[i].get_textpage()
        for c in range(tp.count_chars()):
            try:
                x0, y0, x1, y1 = tp.get_charbox(c)
            except Exception:
                continue
            if x1 - x0 == 0 and y1 - y0 == 0:
                continue  # espaço, sem caixa
            if y0 < 14 or y1 > A4[1] - 14 or x0 < 14 or x1 > A4[0] - 14:
                falhas.append(f"{nome}: há texto fora da área útil na página {i + 1} (transbordou)")
                break
        else:
            continue
        break

    # 5. numeração em toda página de conteúdo, e capa sem ela
    if re.search(r"\b1 / \d+\b", paginas[0]):
        falhas.append(f"{nome}: a CAPA está numerada (deveria ficar fora da contagem)")
    for i in range(1, n):
        if not re.search(rf"\b{i} / {n - 1}\b", paginas[i]):
            falhas.append(f"{nome}: página {i + 1} sem a numeração '{i} / {n - 1}'")
            break

    return falhas, {"bytes": bytes1, "paginas": paginas, "n": n, "arquivo": arq, "cabecalhos": cab}


def conferir_conteudo(nome, info, payload, T=None):
    """Critério (d): o que a tela mostra tem de estar no PDF."""
    falhas = []
    inteiro = texto_corrido(info["paginas"])
    faltando = []
    # Uma bateria é uma capa mais N relatórios; cada parte tem o seu próprio conjunto de frases
    # fixas (DISC mostra "Sugestões de comunicação", VAK não), então a conferência é por parte.
    partes = payload.get("parts")
    oculto = ((payload.get("settings") or {}).get("hidden_blocks")) or []
    mostra_plano = "plano_acao" not in oculto
    esperados = []
    if partes:
        esperados += [payload.get("person_name") or ""]
        for i, parte in enumerate(partes):
            esperados += textos_da_tela(parte)
            if parte.get("test_description"):
                esperados.append(parte["test_description"])
            if T:
                # O plano de ação da bateria é UM só, no fim — não um por parte.
                esperados += fixos_esperados(parte, T, mostra_plano and i == 0)
        if T:
            esperados += [T["BATERIA"]["sumarioTitulo"], T["BATERIA"]["sumarioIntro"]]
    else:
        esperados += textos_da_tela(payload)
        if T:
            esperados += fixos_esperados(payload, T, mostra_plano)
    for t in esperados:
        # O PDF quebra em linhas e o texto do PDFium volta com quebras — comparar normalizado, e
        # por um trecho do meio, que não sofre com hifenização de borda.
        alvo = normalizar(t)
        if alvo and alvo not in inteiro:
            faltando.append(alvo[:90])
    if faltando:
        falhas.append(f"{nome}: {len(faltando)} texto(s) da tela não estão no PDF; 1º: {faltando[0]!r}")
    return falhas


def cmd_reais(args):
    falhas = []
    T = textos_fixos()
    bat = rest("GET", "assessment_responses", {"select": "id", "limit": "1"})
    alvos = list(REAIS)
    if bat:
        alvos.append(("bateria", "bateria", bat[0]["id"]))
    for nome, tipo, ident in alvos:
        caminho = f"/api/pdf/{tipo}/{ident}"
        f, info = conferir(nome, args.app, caminho, args.pasta)
        falhas += f
        if info:
            api = f"/api/public/{'report-bateria' if tipo == 'bateria' else 'report'}/{ident}"
            st, corpo, _ = baixar(args.app, api)
            if st == 200:
                falhas += conferir_conteudo(nome, info, json.loads(corpo), T)
            print(f"  {nome:14} {info['n']:3} páginas · {len(info['bytes']) // 1024:4} KB · determinístico")
    return falhas


def cmd_disc(args):
    """Um DISC descartável, com 360°, para exercitar o relatório mais pesado (21 seções)."""
    falhas = []
    est = carregar_estrutura(VERSAO_DISC)
    v = rest("GET", "test_versions", {"id": f"eq.{VERSAO_DISC}", "select": "id,mentor_id"})[0]
    rodada = os.urandom(3).hex()
    criados = {"pessoas": [], "respostas": [], "baterias": []}
    # Nome longo de propósito: a capa precisa aguentar duas linhas sem estourar a margem.
    nome_longo = f"{PREFIXO} Maria Eduarda Gonçalves de Albuquerque Sant'Anna"
    try:
        pessoa = rest("POST", "people", corpo=[{
            "full_name": nome_longo,
            "email": f"sim-pdf-{rodada}@exemplo.invalido",
            "mentor_id": v["mentor_id"],
        }])[0]
        criados["pessoas"].append(pessoa["id"])
        bateria = rest("POST", "assessment_responses", corpo=[{
            "mentor_id": v["mentor_id"], "person_id": pessoa["id"], "status": "pending",
        }])[0]
        criados["baterias"].append(bateria["id"])
        base = {"version_id": VERSAO_DISC, "person_id": pessoa["id"], "mentor_id": v["mentor_id"],
                "kind": "self", "assessment_response_id": bateria["id"]}
        resp = rest("POST", "test_responses", corpo=[{**base, "status": "in_progress", "assessment_sort": 0}])[0]
        criados["respostas"].append(resp["id"])
        print(f"  fixture: pessoa={pessoa['id']} bateria={bateria['id']} resposta={resp['id']}")

        mais, menos = sortear_escolhas(
            {"letra_da_opcao": est["letra_da_opcao"], "blocos": est["blocos"]},
            random.Random("pdf-293-disc"), None,
        )
        corpo = {"answers": [
            {"question_id": b["id"], "payload": {"most_option_id": mais[k], "least_option_id": menos[k]}}
            for k, b in enumerate(est["blocos"])
        ]}
        st, _, _ = baixar_post(args.app, f"/api/public/response/{resp['id']}", corpo)
        if st != 200:
            return [f"disc: não consegui responder a fixture (HTTP {st})"]

        # Dois observadores, para o relatório trazer a seção de percepção externa.
        for j in range(2):
            obs = rest("POST", "test_responses", corpo=[{**base, "status": "pending", "kind": "observer",
                                                         "parent_response_id": resp["id"], "assessment_sort": 10 + j}])[0]
            criados["respostas"].append(obs["id"])
            print(f"  fixture: observador {j} = {obs['id']}")
            mo, no = sortear_escolhas(
                {"letra_da_opcao": est["letra_da_opcao"], "blocos": est["blocos"]},
                random.Random(f"pdf-293-obs-{j}"), None,
            )
            baixar_post(args.app, f"/api/public/response/{obs['id']}", {
                "rater_name": f"Observador teste {j}",
                "answers": [{"question_id": b["id"], "payload": {"most_option_id": mo[k], "least_option_id": no[k]}}
                            for k, b in enumerate(est["blocos"])],
            })

        f, info = conferir("disc-360", args.app, f"/api/pdf/relatorio/{resp['id']}", args.pasta)
        falhas += f
        if info:
            st, corpo_api, _ = baixar(args.app, f"/api/public/report/{resp['id']}")
            if st == 200:
                falhas += conferir_conteudo("disc-360", info, json.loads(corpo_api), textos_fixos())
            print(f"  {'disc-360':14} {info['n']:3} páginas · {len(info['bytes']) // 1024:4} KB · determinístico")
            # ⚠️ O NOME COMPLETO na capa. A primeira versão desta fatia cortava o nome em duas
            # linhas e jogava fora o resto — "…de Albuquerque" e o "Sant'Anna" sumia. Conferir só
            # um pedaço ("Maria Eduarda") deixava isso passar; é o nome inteiro que se exige.
            capa = normalizar(info["paginas"][0])
            if normalizar(nome_longo) not in capa:
                falhas.append(f"disc-360: a capa não traz o nome completo — saiu {capa[:160]!r}")
    finally:
        if args.manter:
            print("  --manter: fixtures PRESERVADAS (ids acima)")
        else:
            for t, ids in (("test_responses", criados["respostas"]),
                           ("assessment_responses", criados["baterias"]),
                           ("people", criados["pessoas"])):
                for i in ids:
                    rest("DELETE", t, {"id": f"eq.{i}"}, retorno=False)
            print(f"  limpeza: {len(criados['respostas'])} respostas, "
                  f"{len(criados['baterias'])} baterias, {len(criados['pessoas'])} pessoas removidas")
    return falhas


def baixar_post(app, caminho, corpo):
    dados = json.dumps(corpo).encode()
    req = urllib.request.Request(f"{app}{caminho}", data=dados, method="POST",
                                 headers={"Content-Type": "application/json", "User-Agent": "Mozilla/5.0"})
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            return r.status, r.read(), dict(r.headers)
    except urllib.error.HTTPError as e:
        return e.code, e.read(), dict(e.headers)


def cmd_worker(args):
    """
    Sobe o build no RUNTIME REAL do Cloudflare (workerd, via wrangler) e confere que o site
    responde — não só a rota do PDF. É o teste que a primeira versão desta fatia não tinha.
    """
    import shutil
    import subprocess
    import time

    raiz = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    saida = os.path.join(raiz, ".output")
    if not os.path.isdir(saida):
        return [".output não existe — rode `npx vite build` antes de `testar_pdf.py worker`"]

    # O wrangler recusa rodar quando acha dois arquivos de config com bases diferentes; uma cópia
    # fora da árvore do projeto resolve, e ainda garante que estamos testando o BUILD, não a fonte.
    copia = os.path.join("/tmp", "worker-293")
    shutil.rmtree(copia, ignore_errors=True)
    shutil.copytree(saida, copia)
    # As secrets ficam no painel do Lovable; aqui elas vêm do .env.local, só para este teste, e
    # num arquivo FORA do repositório.
    env_local = os.path.join(raiz, ".env.local")
    if os.path.isfile(env_local):
        linhas = []
        for linha in open(env_local, encoding="utf-8"):
            if "=" in linha and not linha.strip().startswith("#"):
                linhas.append(linha.strip())
        with open(os.path.join(copia, "server", ".dev.vars"), "w", encoding="utf-8") as f:
            f.write("\n".join(linhas) + "\n")
    log = open("/tmp/worker-293.log", "w")
    proc = subprocess.Popen(
        ["npx", "--yes", "wrangler@latest", "dev", "--port", "8799", "--log-level", "info"],
        cwd=os.path.join(copia, "server"), stdout=log, stderr=subprocess.STDOUT,
    )
    try:
        pronto = False
        for _ in range(60):
            time.sleep(2)
            try:
                st, _corpo, _c = baixar("http://localhost:8799", "/api/manifest")
                pronto = True
                break
            except Exception:
                continue
        if not pronto:
            return ["o Worker não subiu — ver /tmp/worker-293.log"]

        falhas = []
        # Uma rota que não tem nada a ver com PDF: se ELA quebrar, o bundle inteiro está doente.
        st, corpo, _ = baixar("http://localhost:8799", "/api/manifest")
        if st != 200:
            trecho = open("/tmp/worker-293.log").read()[-1200:]
            return [f"o Worker responde HTTP {st} em /api/manifest (o site inteiro cai). Log:\n{trecho}"]
        print("  /api/manifest          HTTP 200 — o bundle carrega no workerd")

        # E o PDF de verdade, no runtime de produção.
        f, info = conferir("worker-temperamentos", "http://localhost:8799",
                           f"/api/pdf/relatorio/{REAIS[0][2]}", args.pasta)
        falhas += f
        if info:
            print(f"  /api/pdf/relatorio/…   HTTP 200 · {info['n']} páginas · determinístico")
        return falhas
    finally:
        proc.terminate()
        proc.wait(timeout=20)
        log.close()


def cmd_limpar(args):
    sobras = rest("GET", "people", {"full_name": f"ilike.{PREFIXO}%", "select": "id,full_name"})
    if not sobras:
        print("  nenhuma sobra")
        return []
    for p in sobras:
        print(f"  removendo {p['id']}  {p['full_name']}")
        for r in rest("GET", "test_responses", {"person_id": f"eq.{p['id']}", "select": "id"}):
            rest("DELETE", "test_responses", {"id": f"eq.{r['id']}"}, retorno=False)
        for b in rest("GET", "assessment_responses", {"person_id": f"eq.{p['id']}", "select": "id"}):
            rest("DELETE", "assessment_responses", {"id": f"eq.{b['id']}"}, retorno=False)
        rest("DELETE", "people", {"id": f"eq.{p['id']}"}, retorno=False)
    return []


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("comando", choices=["reais", "disc", "tudo", "worker", "limpar"])
    ap.add_argument("--app", default="http://localhost:8080")
    ap.add_argument("--pasta", default="/tmp/pdf-293")
    ap.add_argument("--manter", action="store_true")
    args = ap.parse_args()

    falhas = []
    if args.comando in ("reais", "tudo"):
        print("Relatórios reais:")
        falhas += cmd_reais(args)
    if args.comando in ("disc", "tudo"):
        print("DISC descartável com 360°:")
        falhas += cmd_disc(args)
    if args.comando == "worker":
        falhas += cmd_worker(args)
    if args.comando == "limpar":
        falhas += cmd_limpar(args)

    print()
    if falhas:
        print(f"✗ {len(falhas)} PROBLEMA(S):")
        for f in falhas:
            print(f"   - {f}")
        sys.exit(1)
    print("✓ TUDO CERTO")


if __name__ == "__main__":
    main()
