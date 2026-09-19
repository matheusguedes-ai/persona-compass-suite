"""
Texto do perfil — o parágrafo da PÁGINA DE INTENSIDADE do relatório (#288, Etapa 2c).

A página de intensidade abre com "PERFIL <sigla>", e a sigla é a do gráfico NATURAL que o motor gravou
(uma letra quando há predominância, duas quando é perfil combinado — ver docs/motor-ipsativo.md). Logo
abaixo vem um texto sobre aquele perfil. Este arquivo é a fonte desses textos; eles vivem no banco em
report_content, seção `<instrumento>_perfil_texto`, dimension_key = a sigla, mode = 'natural'.

Como cada texto é escrito (padrão da referência que o Matheus usa, analisado em 19/09 — cartão #288.3)
-------------------------------------------------------------------------------------------------------
  a. UMA letra ................. descrição corrida da pessoa, sem anunciar combinação.
  b. DUAS letras COMPATÍVEIS ... descrição integrada, também sem anunciar combinação.
  c. DUAS letras EM TENSÃO ..... ANUNCIA a combinação e diz em que circunstância cada lado aparece.
No DISC, letras em tensão são as de quadrantes opostos: D↔S e I↔C (DS, SD, IC, CI). As outras oito
combinações são de quadrantes vizinhos — compartilham um eixo — e são compatíveis.

Regras que não se negociam
--------------------------
1. NADA INVENTADO. Só entra texto derivado da referência (onde ela cobre) ou escrito/aprovado pelo dono
   do produto. O resto fica PENDENTE: a linha existe no banco com status 'pendente' e corpo vazio, e o
   relatório mostra, no lugar do texto, um aviso de que a descrição está sendo preparada.
   "Relatório com texto inventado sobre a personalidade de alguém é pior do que relatório incompleto."
2. NADA COPIADO. A referência é um relatório comercial (CIS Assessment) e o texto dele é protegido. Daqui
   sai só a IDEIA (os traços que ela atribui ao perfil), escrita com palavras nossas. A lista
   FRASES_DA_REFERENCIA abaixo trava por `assert` as frases distintivas de lá.

O que a referência cobre, e o que saiu dela
-------------------------------------------
Chegaram até aqui trechos de três perfis (S, CS e CI) — o começo de cada texto, no pedido da Etapa 2c.
A referência também tem um perfil IC, mas o trecho dele não veio no pedido nem no cartão: sem ele, o texto
seria invenção, então IC fica pendente até o dono mandar o trecho (ou escrever).

Uso
---
    python3 scripts/conteudo_perfil_texto.py                 # só confere (asserts), não toca no banco
    python3 scripts/conteudo_perfil_texto.py aplicar         # grava o que falta, via REST
    python3 scripts/conteudo_perfil_texto.py aplicar --sobrescrever
`aplicar` só CRIA as linhas que faltam e AVISA quando o banco difere deste arquivo — não sobrescreve,
porque o texto pode ter sido editado direto no banco (é para isso que ele vive lá). `--sobrescrever`
faz este arquivo valer sobre o banco.
"""
import itertools
import json
import os
import sys
import urllib.error
import urllib.request

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Letras de cada instrumento, na ordem do instrumento, com o nome que aparece no relatório.
LETRAS = {
    "disc": {"D": "Dominância", "I": "Influência", "S": "Estabilidade", "C": "Conformidade"},
    "temperamentos": {"SAN": "Sanguíneo", "COL": "Colérico", "MEL": "Melancólico", "FLE": "Fleumático"},
    "vak": {"V": "Visual", "A": "Auditivo", "K": "Cinestésico"},
}

# DISC: quadrantes opostos puxam para lados contrários (ritmo e foco invertidos ao mesmo tempo).
PARES_EM_TENSAO = {"disc": {"DS", "SD", "IC", "CI"}}

# Textos APROVADOS para o relatório. Sigla ausente daqui = pendente.
TEXTOS = {
    "disc": {
        # a. uma letra — traços da referência: calma, pacífica, equilibrada, atenta às outras pessoas.
        "S": (
            "Você tem um jeito sereno e conciliador, de quem prefere a paz ao conflito e não perde o "
            "equilíbrio com facilidade. Costuma perceber como estão as pessoas ao seu redor e se importa de "
            "verdade com o bem-estar delas."
        ),
        # b. compatíveis — traços da referência: analítico, racional, calmo, equilibrado, metódico;
        #    precisão somada à paciência de levar um trabalho até o fim.
        "CS": (
            "Seu raciocínio é analítico, lógico e metódico, e o seu jeito, sereno e estável. Preza pelo "
            "trabalho bem-feito, cuida dos detalhes e tem paciência para acompanhar uma tarefa do começo ao "
            "fim, sem pular etapas."
        ),
        # c. em tensão — da referência: anuncia a combinação Conformidade + Influência; o lado analítico
        #    e racional prevalece; em certas circunstâncias, sobretudo em ambientes familiares, aparece o
        #    lado sociável e comunicativo.
        "CI": (
            "Seu perfil junta dois estilos que costumam puxar para lados opostos: Conformidade e "
            "Influência. Na maior parte do tempo, prevalece o lado analítico: você pesa os fatos e decide "
            "pela razão. Já em algumas situações — principalmente entre pessoas próximas e em lugares onde "
            "se sente em casa — aparece o outro lado: você se solta, puxa conversa e se mostra uma pessoa "
            "sociável e comunicativa."
        ),
    },
    "temperamentos": {},
    "vak": {},
}

# Frases distintivas do texto da referência. Nenhuma pode aparecer aqui (regra 2).
FRASES_DA_REFERENCIA = [
    "combinação rara",
    "do tipo calma",
    "do tipo analítico",
    "calma, pacífica",
    "pacífica e equilibrada",
    "pacífico e equilibrado",
    "analítica e racional",
    "analítico, racional",
    "calmo e equilibrado",
    "ambientes familiares",
    "pensa de forma sistemática",
    "exatidão e precisão com paciência",
    "até que ele seja concluído",
    "diante de algumas circunstâncias",
    "tornar-se uma comunicadora",
    "geralmente se preocupa com as outras pessoas",
]


def juntar(chaves):
    """Mesma regra do motor (`codigo`): sem separador se toda chave tem 1 caractere; senão, com '+'."""
    return "".join(chaves) if all(len(k) == 1 for k in chaves) else "+".join(chaves)


def siglas(instrumento):
    """Todas as siglas possíveis: cada letra sozinha + cada par ORDENADO (a 1ª letra é a que lidera)."""
    chaves = list(LETRAS[instrumento])
    return [juntar([k]) for k in chaves] + [juntar(list(p)) for p in itertools.permutations(chaves, 2)]


def partes(instrumento, sigla):
    """As chaves que formam a sigla ('CI' → ['C', 'I']; 'SAN+COL' → ['SAN', 'COL']; 'SAN' → ['SAN'])."""
    if "+" in sigla:
        return sigla.split("+")
    return list(sigla) if all(len(k) == 1 for k in LETRAS[instrumento]) else [sigla]


def padrao(instrumento, sigla):
    """Que padrão de redação a sigla pede (a, b ou c). Fora do DISC a tensão ainda não foi definida."""
    if len(partes(instrumento, sigla)) == 1:
        return "a"
    tensao = PARES_EM_TENSAO.get(instrumento)
    if tensao is None:
        return "?"
    return "c" if sigla in tensao else "b"


def blocos():
    out = []
    for instrumento in LETRAS:
        for i, sigla in enumerate(siglas(instrumento), start=1):
            texto = TEXTOS[instrumento].get(sigla)
            out.append({
                "section": f"{instrumento}_perfil_texto",
                "dimension_key": sigla,
                "mode": "natural",
                "title": None,
                "body": texto or "",
                "status": "publicado" if texto else "pendente",
                "version_id": None,
                "band_min": None,
                "band_max": None,
                "sort_order": i,
            })
    return out


def conferir():
    bs = blocos()
    for instrumento, textos in TEXTOS.items():
        todas = set(siglas(instrumento))
        desconhecidas = set(textos) - todas
        assert not desconhecidas, f"{instrumento}: sigla que o motor nunca produz: {desconhecidas}"
        for sigla, texto in textos.items():
            baixo = texto.lower()
            for frase in FRASES_DA_REFERENCIA:
                assert frase not in baixo, f"{instrumento}/{sigla}: frase copiada da referência: '{frase}'"
            assert 80 <= len(texto) <= 700, f"{instrumento}/{sigla}: tamanho fora do esperado ({len(texto)})"
            nomes = [LETRAS[instrumento][k] for k in partes(instrumento, sigla)]
            anuncia = all(n in texto for n in nomes) and len(nomes) == 2
            p = padrao(instrumento, sigla)
            if p == "c":
                assert anuncia, f"{instrumento}/{sigla}: perfil em tensão precisa ANUNCIAR a combinação ({nomes})"
            if p in ("a", "b"):
                assert not any(n in texto for n in LETRAS[instrumento].values()), \
                    f"{instrumento}/{sigla}: padrão '{p}' descreve a pessoa sem citar os perfis pelo nome"
    esperado = {"disc": 16, "temperamentos": 16, "vak": 9}
    for instrumento, n in esperado.items():
        assert len(siglas(instrumento)) == n, f"{instrumento}: {len(siglas(instrumento))} siglas, esperado {n}"
    chaves = [(b["section"], b["dimension_key"]) for b in bs]
    assert len(chaves) == len(set(chaves)), "sigla repetida"
    return bs


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
    bs = conferir()
    secoes = sorted({b["section"] for b in bs})
    existentes = _chamar(url, key, "GET",
                         "report_content?version_id=is.null&section=in.(" + ",".join(secoes) + ")"
                         "&select=id,section,dimension_key,mode,body,status,title")
    por_chave = {(r["section"], r["dimension_key"], r["mode"]): r for r in existentes}
    novos, diferentes = [], []
    for b in bs:
        atual = por_chave.get((b["section"], b["dimension_key"], b["mode"]))
        if atual is None:
            novos.append(b)
        elif (atual["body"], atual["status"], atual["title"]) != (b["body"], b["status"], b["title"]):
            diferentes.append((atual, b))
    if novos:
        criados = _chamar(url, key, "POST", "report_content", novos)
        for r in criados:
            print(f"  criado   {r['id']}  {r['section']:<28} {r['dimension_key']:<8} {r['status']}")
    for atual, b in diferentes:
        if sobrescrever:
            _chamar(url, key, "PATCH", f"report_content?id=eq.{atual['id']}",
                    {"body": b["body"], "status": b["status"], "title": b["title"]})
            print(f"  REESCRITO {atual['id']}  {b['section']:<28} {b['dimension_key']:<8} {b['status']}")
        else:
            print(f"  DIFERE   {atual['id']}  {b['section']:<28} {b['dimension_key']:<8} "
                  f"banco={atual['status']} arquivo={b['status']} (não mexi; use --sobrescrever)")
    # conferência pelo que o banco devolve, não pelo que eu acho que gravei
    depois = _chamar(url, key, "GET",
                     "report_content?version_id=is.null&section=in.(" + ",".join(secoes) + ")"
                     "&select=section,dimension_key,status")
    por_secao = {}
    for r in depois:
        por_secao.setdefault(r["section"], {"publicado": 0, "pendente": 0})[r["status"]] += 1
    print("\nNo banco agora:")
    for s in secoes:
        print(f"  {s:<28} {por_secao.get(s)}")
    faltando = {(b["section"], b["dimension_key"]) for b in bs} - {(r["section"], r["dimension_key"]) for r in depois}
    assert not faltando, f"linhas que não chegaram ao banco: {sorted(faltando)[:5]}"


if __name__ == "__main__":
    bs = conferir()
    for instrumento in LETRAS:
        publicados = [b["dimension_key"] for b in bs if b["section"] == f"{instrumento}_perfil_texto" and b["status"] == "publicado"]
        pendentes = [f"{b['dimension_key']}({padrao(instrumento, b['dimension_key'])})"
                     for b in bs if b["section"] == f"{instrumento}_perfil_texto" and b["status"] == "pendente"]
        print(f"{instrumento}: {len(publicados)} publicados {publicados} · {len(pendentes)} pendentes {' '.join(pendentes)}",
              file=sys.stderr)
    print("ok", file=sys.stderr)
    if len(sys.argv) > 1 and sys.argv[1] == "aplicar":
        aplicar(sobrescrever="--sobrescrever" in sys.argv)
