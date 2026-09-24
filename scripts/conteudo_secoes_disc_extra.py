"""
Conteúdo das quatro seções extras do DISC (#302): Matriz SWOT do Comunicador, Ganhos e Perdas,
Onde Isso Aparece, Comunicadores com Traços Semelhantes.

Vivem em `report_content`, na coluna `content_json` (não `body` — o conteúdo é ESTRUTURADO, não
texto corrido). Uma linha por (section, dimension_key=sigla), `mode='natural'`, `version_id=NULL`
(global). Mesmo padrão de `conteudo_perfil_texto.py`: as 16 siglas do DISC (4 letras + 12
combinações ordenadas) sempre existem no banco; sigla sem conteúdo aprovado fica com
`content_json=None`/`status='pendente'` — e a seção correspondente simplesmente NÃO APARECE no
relatório (não é "aviso no lugar", como o texto do perfil; ver `src/lib/disc-secoes-extra.ts`).

NADA INVENTADO: só entra o que está em CONTEUDO abaixo, aprovado pelo dono do produto por
sigla — hoje só D (perfil de exemplo pedido pela #302, item 7). As outras 15 ficam pendentes até
ele escrever ou aprovar.

Uso
---
    python3 scripts/conteudo_secoes_disc_extra.py             # só confere (asserts)
    python3 scripts/conteudo_secoes_disc_extra.py aplicar     # grava o que falta, via REST
    python3 scripts/conteudo_secoes_disc_extra.py aplicar --sobrescrever
"""
import itertools
import json
import os
import sys
import urllib.error
import urllib.request

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LETRAS_DISC = ["D", "I", "S", "C"]

SECAO_SWOT = "disc_swot_comunicador"
SECAO_GANHOS_PERDAS = "disc_ganhos_perdas"
SECAO_ONDE_APARECE = "disc_onde_aparece"
SECAO_COMUNICADORES = "disc_comunicadores_semelhantes"

# Conteúdo aprovado por Matheus Guedes em 24/09/2026 (CONTEUDO_perfil_D_DISC.md) — cadastrado
# exatamente como está no arquivo. O PDF de referência (peças visuais) usa outra pessoa de
# exemplo e tem pequenas variações de palavra — quem manda no TEXTO é o .md, não o PDF.
CONTEUDO = {
    SECAO_SWOT: {
        "D": {
            "forcas": [
                "Clareza de objetivo",
                "Coragem para o difícil",
                "Decisão sob pressão",
                "Concisão natural",
            ],
            "fragilidades": [
                "Tom que endurece sozinho",
                "Escuta curta",
                "Conclusão sem contexto",
                "Impaciência visível no corpo",
            ],
            "oportunidades": [
                "Porta-voz e negociação",
                "Ambientes de crise",
                "Vídeo curto",
                "Posições de decisão",
            ],
            "ameacas": [
                "Ser lido como autoritário",
                "Time que esconde problema",
                "Informação que não chega",
                "Relação que vira operacional",
            ],
        },
    },
    SECAO_GANHOS_PERDAS: {
        "D": {
            "mantendo": {
                "ganha": "Velocidade real. Decisões que saem. Respeito imediato. Menos desgaste no curto prazo.",
                "perde": (
                    "Informação que para de chegar — as pessoas selecionam o que te contam. Ideias que "
                    "morrem antes de serem ditas. A solidão de quem decide sozinho."
                ),
            },
            "mudando": {
                "ganha": (
                    "As mesmas decisões, agora com adesão em vez de obediência. Acesso ao que estava sendo "
                    "filtrado. Autoridade que não precisa ser reimposta."
                ),
                "perde": (
                    "Tempo: os trinta segundos de contexto, as três perguntas antes de afirmar. E o "
                    "desconforto de ouvir uma objeção até o fim."
                ),
            },
            "frase_que_te_segura": (
                '"Se eu for mais devagar, perco a força." — Não é o que acontece. O que enfraquece uma '
                "posição não é o ritmo: é ela não ter sido compreendida."
            ),
        },
    },
    SECAO_ONDE_APARECE: {
        "D": {
            "situacoes": [
                {
                    "situacao": "Liderando",
                    "automatico": (
                        "Você decide rápido e comunica pronto. Quem não participou da construção não "
                        "defende a decisão depois."
                    ),
                    "tecnica": "Diga o problema antes da solução. 30 segundos de contexto compram meses de engajamento.",
                },
                {
                    "situacao": "Vendendo",
                    "automatico": (
                        "Você conduz bem, mas apresenta antes de investigar. Argumento sobre objeção mal "
                        "entendida vira empurrão."
                    ),
                    "tecnica": "Três perguntas antes da primeira afirmação.",
                },
                {
                    "situacao": "Falando em público",
                    "automatico": "Entrega firme e direta. Sem variação de ritmo, a plateia perde o relevo do que importa.",
                    "tecnica": "Pausa depois da frase que mais importa.",
                },
                {
                    "situacao": "Fazendo networking",
                    "automatico": (
                        "Você vai direto ao interesse e economiza o tempo de todos, mas pode soar "
                        "transacional."
                    ),
                    "tecnica": "Dedique os dois primeiros minutos a entender o outro, sem nenhum objetivo.",
                },
                {
                    "situacao": "Gravando vídeo",
                    "automatico": "Você prende nos primeiros segundos. A câmera amplifica tom e pode soar impaciente.",
                    "tecnica": "Grave olhando para uma pessoa específica, não para a audiência.",
                },
                {
                    "situacao": "Em família",
                    "automatico": (
                        "O modo resolutivo não desliga em casa. Você responde com solução quando pediram "
                        "acolhimento."
                    ),
                    "tecnica": "Pergunte — você quer que eu ajude a resolver ou quer só falar?",
                },
                {
                    "situacao": "Entre pares",
                    "automatico": "Você discorda na hora, o que é honesto, mas cria fama de atropelador.",
                    "tecnica": "Reconheça o ponto do outro antes de apresentar o seu.",
                },
            ],
        },
    },
    SECAO_COMUNICADORES: {
        "D": {
            "pessoas": [
                {"nome": "Steve Jobs", "descricao": "apresentava com objetividade cortante e tolerância baixa a rodeio."},
                {"nome": "Jorge Paulo Lemann", "descricao": "comunicação econômica e centrada em resultado."},
                {"nome": "Margaret Thatcher", "descricao": "firmeza de posição sob pressão."},
                {
                    "nome": "Miranda Priestly (ficção, O Diabo Veste Prada)",
                    "descricao": "decide em uma frase, não repete e não explica.",
                },
            ],
        },
    },
}


def siglas_disc():
    """As 16 siglas do DISC: 4 letras soltas + as 12 permutações ordenadas de pares."""
    return [k for k in LETRAS_DISC] + ["".join(p) for p in itertools.permutations(LETRAS_DISC, 2)]


def conferir():
    todas = set(siglas_disc())
    assert len(todas) == 16, f"esperava 16 siglas do DISC, achei {len(todas)}"
    for secao, por_sigla in CONTEUDO.items():
        desconhecidas = set(por_sigla) - todas
        assert not desconhecidas, f"{secao}: sigla que o motor nunca produz: {desconhecidas}"
        for sigla, c in por_sigla.items():
            if secao == SECAO_SWOT:
                for quadrante in ("forcas", "fragilidades", "oportunidades", "ameacas"):
                    itens = c[quadrante]
                    assert isinstance(itens, list) and len(itens) == 4, \
                        f"{secao}/{sigla}/{quadrante}: precisa de exatamente 4 itens, tem {len(itens)}"
                    assert all(isinstance(i, str) and i.strip() for i in itens), \
                        f"{secao}/{sigla}/{quadrante}: item vazio"
            elif secao == SECAO_GANHOS_PERDAS:
                for coluna in ("mantendo", "mudando"):
                    assert c[coluna]["ganha"].strip() and c[coluna]["perde"].strip(), \
                        f"{secao}/{sigla}/{coluna}: ganha/perde vazio"
                assert c["frase_que_te_segura"].strip(), f"{secao}/{sigla}: frase_que_te_segura vazia"
            elif secao == SECAO_ONDE_APARECE:
                sits = c["situacoes"]
                assert 6 <= len(sits) <= 7, f"{secao}/{sigla}: {len(sits)} situações, a demanda pede 6 a 7"
                for s in sits:
                    assert s["situacao"].strip() and s["automatico"].strip() and s["tecnica"].strip(), \
                        f"{secao}/{sigla}: situação com campo vazio ({s.get('situacao')})"
            elif secao == SECAO_COMUNICADORES:
                pessoas = c["pessoas"]
                assert len(pessoas) >= 1, f"{secao}/{sigla}: precisa de ao menos 1 pessoa"
                for p in pessoas:
                    assert p["nome"].strip() and p["descricao"].strip(), f"{secao}/{sigla}: pessoa com campo vazio"


def blocos():
    out = []
    for secao in (SECAO_SWOT, SECAO_GANHOS_PERDAS, SECAO_ONDE_APARECE, SECAO_COMUNICADORES):
        por_sigla = CONTEUDO.get(secao, {})
        for i, sigla in enumerate(siglas_disc(), start=1):
            conteudo = por_sigla.get(sigla)
            out.append({
                "section": secao,
                "dimension_key": sigla,
                "mode": "natural",
                "title": None,
                "body": "",
                "content_json": conteudo,
                "status": "publicado" if conteudo else "pendente",
                "version_id": None,
                "band_min": None,
                "band_max": None,
                "sort_order": i,
            })
    return out


# --------------------------------------------------------------------------- banco (REST)
def _ambiente():
    env = {}
    for nome in (".env.local", ".env"):
        caminho = os.path.join(RAIZ, nome)
        if not os.path.exists(caminho):
            continue
        for linha in open(caminho, encoding="utf-8"):
            linha = linha.strip()
            if linha and not linha.startswith("#") and "=" in linha:
                k, v = linha.split("=", 1)
                env.setdefault(k.strip(), v.strip().strip('"').strip("'"))
    url, key = env.get("SUPABASE_URL") or env.get("VITE_SUPABASE_URL"), env.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        sys.exit("Faltou SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY no .env.local")
    return url.rstrip("/"), key


def _chamar(url, key, metodo, caminho, corpo=None):
    req = urllib.request.Request(
        f"{url}/rest/v1/{caminho}", method=metodo,
        data=None if corpo is None else json.dumps(corpo).encode(),
        headers={"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json",
                 "Prefer": "return=representation"},
    )
    try:
        with urllib.request.urlopen(req) as r:
            texto = r.read().decode()
            return json.loads(texto) if texto.strip() else None
    except urllib.error.HTTPError as e:
        sys.exit(f"{metodo} {caminho} falhou ({e.code}): {e.read().decode()[:300]}")


def aplicar(sobrescrever=False):
    url, key = _ambiente()
    conferir()
    bs = blocos()
    secoes = sorted({b["section"] for b in bs})
    existentes = _chamar(url, key, "GET",
                         "report_content?version_id=is.null&section=in.(" + ",".join(secoes) + ")"
                         "&select=id,section,dimension_key,mode,content_json,status")
    por_chave = {(r["section"], r["dimension_key"], r["mode"]): r for r in existentes}
    novos, diferentes = [], []
    for b in bs:
        atual = por_chave.get((b["section"], b["dimension_key"], b["mode"]))
        if atual is None:
            novos.append(b)
        elif (atual["content_json"], atual["status"]) != (b["content_json"], b["status"]):
            diferentes.append((atual, b))
    if novos:
        criados = _chamar(url, key, "POST", "report_content", novos)
        for r in criados:
            print(f"  criado    {r['id']}  {r['section']:<32} {r['dimension_key']:<8} {r['status']}")
    for atual, b in diferentes:
        if sobrescrever:
            _chamar(url, key, "PATCH", f"report_content?id=eq.{atual['id']}",
                    {"content_json": b["content_json"], "status": b["status"]})
            print(f"  REESCRITO {atual['id']}  {b['section']:<32} {b['dimension_key']:<8} {b['status']}")
        else:
            print(f"  DIFERE    {atual['id']}  {b['section']:<32} {b['dimension_key']:<8} "
                  f"banco={atual['status']} arquivo={b['status']} (não mexi; use --sobrescrever)")
    depois = _chamar(url, key, "GET",
                     "report_content?version_id=is.null&section=in.(" + ",".join(secoes) + ")"
                     "&select=section,dimension_key,status")
    por_secao = {}
    for r in depois:
        por_secao.setdefault(r["section"], {"publicado": 0, "pendente": 0})[r["status"]] += 1
    print("\nNo banco agora:")
    for s in secoes:
        print(f"  {s:<32} {por_secao.get(s)}")
    faltando = {(b["section"], b["dimension_key"]) for b in bs} - {(r["section"], r["dimension_key"]) for r in depois}
    assert not faltando, f"linhas que não chegaram ao banco: {sorted(faltando)[:5]}"


if __name__ == "__main__":
    conferir()
    for secao in (SECAO_SWOT, SECAO_GANHOS_PERDAS, SECAO_ONDE_APARECE, SECAO_COMUNICADORES):
        publicadas = sorted(CONTEUDO.get(secao, {}).keys())
        pendentes = [s for s in siglas_disc() if s not in publicadas]
        print(f"{secao}: {len(publicadas)} publicadas {publicadas} · {len(pendentes)} pendentes",
              file=sys.stderr)
    print("ok", file=sys.stderr)
    if len(sys.argv) > 1 and sys.argv[1] == "aplicar":
        aplicar(sobrescrever="--sobrescrever" in sys.argv)
