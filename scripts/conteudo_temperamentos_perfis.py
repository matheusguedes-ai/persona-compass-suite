"""
Temperamentos — os 4 perfis (Sanguíneo, Colérico, Melancólico, Fleumático), aprovados por Matheus Guedes em
24/09/2026 (arquivo CONTEUDO_Temperamentos.md, escrito pelo chat). Mesmo formato do DISC.

O QUE ENTRA NO RELATÓRIO: só a DESCRIÇÃO, no lugar onde o texto do perfil já vive — a página de intensidade,
seção `temperamentos_perfil_texto` (chave = SAN/COL/MEL/FLE). As 12 combinações (SAN+COL etc.) têm arquivo
aprovado e script próprios desde 28/09: `conteudo_temperamentos_combinados.py` — este aqui não as toca.

O QUE FICA GUARDADO SEM APARECER: a SWOT e os Ganhos e Perdas. A #302 ligou essas seções só no DISC, por
decisão do dono (num relatório de bateria, quatro SWOTs cansariam). Aqui elas nascem em
`temperamentos_swot_comunicador` e `temperamentos_ganhos_perdas`, SEMPRE com status `pendente`, no mesmo
formato estruturado (content_json) das do DISC — prontas para ligar, e ligar é decisão do dono. Nenhum
código lê essas duas seções hoje (as do DISC têm nome fixo "disc_" e só rodam no DISC).

28/09/2026 — LIGADAS E DESLIGADAS NO MESMO DIA, por decisão do dono. Ligadas (commit 7955479), mostraram o
problema na bateria real do Robson: a SWOT do DISC (letra C) e a do Melancólico diziam quase o mesmo ("Perder
a janela da decisão" nas duas). A SWOT responde "o que você tem de forte e de frágil como comunicador" — UMA
resposta por pessoa, não uma por instrumento, e quem responde melhor é o DISC. Duas matrizes que parecem
diferentes e dizem o mesmo não cansam: desacreditam. Por isso seguem pendentes e o código foi revertido
(6f32d6b). Uso futuro possível, em demanda própria: só no relatório INDIVIDUAL de Temperamentos, onde não há
DISC competindo — o ponto de partida é o 7955479 (separa a sigla SAN+COL pelas chaves e mostra o nome).

Uso:
    python3 scripts/conteudo_temperamentos_perfis.py                # só confere (e contra o arquivo aprovado, se achar)
    python3 scripts/conteudo_temperamentos_perfis.py aplicar
"""
import json
import os
import re
import sys
import unicodedata
import urllib.error
import urllib.request

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ARQUIVO_APROVADO = os.path.expanduser("~/Desktop/CONTEUDO_Temperamentos.md")
SECAO_TEXTO = "temperamentos_perfil_texto"
SECAO_SWOT = "temperamentos_swot_comunicador"
SECAO_GANHOS = "temperamentos_ganhos_perdas"
CHAVES = ["SAN", "COL", "MEL", "FLE"]  # a ordem das dimensões no instrumento
NOMES = {"SAN": "SANGUÍNEO", "COL": "COLÉRICO", "MEL": "MELANCÓLICO", "FLE": "FLEUMÁTICO"}

DESCRICOES = {
    "SAN": (
        "Sua comunicação nasce calorosa. Você fala com facilidade, ri alto, contagia um grupo e transforma sala fria "
        "em conversa em poucos minutos. As pessoas se sentem bem perto de você antes mesmo de saberem por quê.\n\n"
        "No automático, a mesma energia dispersa. Você começa empolgado e larga no meio, promete no calor e nem "
        "sempre cumpre, muda de assunto antes de fechar o anterior. Como tudo é dito com afeto, ninguém te confronta "
        "— e a conta chega em silêncio, na forma de gente que gosta de você mas não conta com você.\n\n"
        "Seu trabalho é terminar o que começou a dizer. Uma ideia até o fim vale mais que cinco pela metade. Sua "
        "energia nunca foi o problema; ela é o veículo."
    ),
    "COL": (
        "Sua comunicação nasce em movimento. Você reage na hora, assume a frente, resolve. Onde a maioria ainda está "
        "entendendo o problema, você já está agindo — e essa velocidade é o que faz as pessoas te procurarem quando "
        "algo quebra.\n\n"
        "No automático, a intensidade chega antes da mensagem. Você rebate no impulso, domina a conversa sem "
        "perceber, e o que sente como firmeza soa como rispidez. Você esquece rápido; quem ouviu, não. A falta de "
        "retorno que você interpreta como concordância costuma ser cansaço.\n\n"
        "Seu desenvolvimento é deixar espaço para o outro entrar. Perguntar antes de concluir. Sua força não diminui "
        "com isso — deixa de ser enfrentada."
    ),
    "MEL": (
        "Sua comunicação nasce profunda. Você pensa antes de falar, escolhe as palavras, e quando diz algo é porque "
        "considerou. Suas conversas têm camadas que a maioria não alcança, e quem se aproxima de verdade encontra uma "
        "lealdade rara.\n\n"
        "No automático, a profundidade vira peso. Você antecipa o pior cenário, demora a começar planejando, revisa "
        "até tirar a vida do que ia dizer. E leva a sério demais: uma frase mal colocada volta por dias. O que você "
        "chama de exigência costuma ser autocobrança disfarçada.\n\n"
        "Sua chave é falar antes de estar pronto. A ideia parcial dita no tempo certo vale mais que a conclusão "
        "perfeita entregue depois da decisão."
    ),
    "FLE": (
        "Sua comunicação nasce serena. Você mantém o equilíbrio quando o ambiente aquece, escuta primeiro e fala "
        "quando tem o que dizer. Numa discussão acalorada, você é o único que continua pensando — e é por isso que "
        "sua opinião, quando vem, costuma encerrar o assunto.\n\n"
        "No automático, o equilíbrio vira ausência. Você escolhe não entrar, deixa passar, adia a mudança. Como nunca "
        "se altera, ninguém percebe que você discordou — e decisões são tomadas sem a única cabeça fria da sala. O que "
        "parece paciência às vezes é só o custo de entrar sendo alto demais.\n\n"
        "Seu desenvolvimento é entrar antes de ser chamado. Sua serenidade é rara e valiosa; ela só serve se estiver "
        "dentro da conversa."
    ),
}

SWOT = {
    "SAN": {
        "forcas": ["Contagia um grupo", "Improviso natural", "Recomeça rápido", "Cria vínculo em minutos"],
        "fragilidades": ["Larga no meio", "Promete no calor", "Foge do peso com humor", "Disperso no essencial"],
        "oportunidades": ["Palco e vídeo", "Vendas e relacionamento", "Ambientes que precisam de ânimo",
                          "Abertura de portas"],
        "ameacas": ["Ser lido como inconstante", "Combinado que não se cumpre", "Perder credibilidade aos poucos",
                    "Relação que não aprofunda"],
    },
    "COL": {
        "forcas": ["Decide sob pressão", "Assume responsabilidade", "Não recua no difícil", "Reconhece erro e segue"],
        "fragilidades": ["Rispidez involuntária", "Domina a conversa", "Impaciência com o ritmo alheio",
                         "Reação antes da escuta"],
        "oportunidades": ["Crise e virada", "Liderança de operação", "Negociação dura", "Decisão com prazo curto"],
        "ameacas": ["Time que trabalha com medo", "Informação filtrada", "Relações desgastadas por intensidade",
                    "Ficar sabendo por último"],
    },
    "MEL": {
        "forcas": ["Prepara com rigor", "Lealdade duradoura", "Enxerga o risco antes", "Profundidade real"],
        "fragilidades": ["Demora a se posicionar", "Autocobrança excessiva", "Guarda o que magoou",
                         "Revisa até travar"],
        "oportunidades": ["Trabalho que exige rigor", "Relação de longo prazo", "Escrita e material denso",
                          "Planejamento"],
        "ameacas": ["Perder a janela da decisão", "Ressentimento acumulado", "Desgaste por cobrança interna",
                    "Ser lido como pessimista"],
    },
    "FLE": {
        "forcas": ["Estabilidade sob pressão", "Diplomacia natural", "Constância no ritmo", "Julgamento frio"],
        "fragilidades": ["Demora a se mover", "Posição que não aparece", "Evita o confronto necessário",
                         "Adia a mudança"],
        "oportunidades": ["Mediação e conciliação", "Ambientes tensos", "Processos de longo prazo",
                          "Times em conflito"],
        "ameacas": ["Ser lido como desinteressado", "Decisões tomadas sem você", "Acomodação confundida com paz",
                    "Perder espaço por não ocupar"],
    },
}

GANHOS = {
    "SAN": {
        "mantendo": {
            "ganha": "Leveza, portas abertas, recuperação rápida e um ambiente que melhora quando você chega.",
            "perde": "Confiabilidade e peso. As pessoas gostam de você, mas não contam com você para o que é importante.",
        },
        "mudando": {
            "ganha": "A mesma simpatia, agora com consequência. Gente que te procura para o que importa, não só para o que é leve.",
            "perde": "O conforto de nunca se cobrar, e a facilidade de sair pela tangente quando o assunto pesa.",
        },
        "frase_que_te_segura": (
            '"Se eu ficar sério, perco meu jeito." — Não perde. O que faz as pessoas confiarem em você não é a '
            "leveza; é a leveza com palavra cumprida."
        ),
    },
    "COL": {
        "mantendo": {
            "ganha": "Velocidade, respeito imediato, problemas resolvidos antes de virarem crise.",
            "perde": "Acesso ao que as pessoas param de te contar. E a chance de ouvir o problema enquanto ele ainda é pequeno.",
        },
        "mudando": {
            "ganha": "Adesão em vez de obediência. Gente trazendo problema cedo, quando ainda dá para resolver barato.",
            "perde": "Os segundos que a pressa economizava. E o desconforto de ouvir uma objeção até o fim sem cortar.",
        },
        "frase_que_te_segura": (
            '"Se eu pegar leve, param de me levar a sério." — O que faz te levarem a sério não é a intensidade: é '
            "você sustentar o que diz. Isso continua igual num tom mais baixo."
        ),
    },
    "MEL": {
        "mantendo": {
            "ganha": "Qualidade, integridade e a segurança de nunca entregar algo mal feito.",
            "perde": "Velocidade e leveza. E as ideias boas que nunca saíram porque não estavam prontas.",
        },
        "mudando": {
            "ganha": "Presença no tempo em que as coisas acontecem. Mesma profundidade, agora com alcance.",
            "perde": "A proteção de ter conferido tudo antes, e o conforto de nunca errar em público.",
        },
        "frase_que_te_segura": (
            '"Se não estiver perfeito, é melhor não mostrar." — O que não é mostrado não protege ninguém. Uma ideia '
            "parcial no tempo certo ajuda mais que uma perfeita fora dele."
        ),
    },
    "FLE": {
        "mantendo": {
            "ganha": "Paz, desgaste zero e a posição de quem todos procuram quando o ambiente esquenta.",
            "perde": "Influência sobre o que te afeta. E a chance de a sua leitura, que costuma ser a mais clara, entrar na decisão.",
        },
        "mudando": {
            "ganha": "Voz nas decisões. O peso que a sua opinião tem quando finalmente aparece, agora disponível quando importa.",
            "perde": "A tranquilidade de ficar de fora, e o conforto de não ter que defender posição nenhuma.",
        },
        "frase_que_te_segura": (
            '"Não vale a pena entrar nessa." — Às vezes não vale mesmo. Mas quando você nunca entra, quem decide é '
            "sempre quem grita mais alto."
        ),
    },
}


def _norm(t):
    return re.sub(r"\s+", " ", unicodedata.normalize("NFC", t)).strip()


def _conferir_contra_o_arquivo():
    """Cada texto daqui, palavra por palavra, contra o arquivo aprovado — quando ele estiver no computador."""
    if not os.path.exists(ARQUIVO_APROVADO):
        print(f"(arquivo aprovado não encontrado em {ARQUIVO_APROVADO} — conferência contra ele pulada)")
        return
    texto = open(ARQUIVO_APROVADO, encoding="utf-8").read()
    for chave in CHAVES:
        bloco = re.search(rf"^## {NOMES[chave]}\n(.*?)(?=^---|\Z)", texto, re.S | re.M).group(1)
        desc = re.search(r"### DESCRIÇÃO\n(.*?)\n### SWOT", bloco, re.S).group(1)
        assert _norm(desc) == _norm(DESCRICOES[chave]), f"{chave}: descrição diferente do arquivo aprovado"
        swot = re.search(r"### SWOT\n(.*?)\n### GANHOS", bloco, re.S).group(1).strip().splitlines()
        for linha, quadrante in zip(swot, ("forcas", "fragilidades", "oportunidades", "ameacas")):
            itens = [_norm(x) for x in linha.split(":", 1)[1].split("·")]
            assert itens == SWOT[chave][quadrante], f"{chave}/{quadrante}: diferente do arquivo aprovado"
        gp = re.search(r"### GANHOS E PERDAS\n(.*?)$", bloco, re.S).group(1).strip().splitlines()
        esperado = [GANHOS[chave]["mantendo"]["ganha"], GANHOS[chave]["mantendo"]["perde"],
                    GANHOS[chave]["mudando"]["ganha"], GANHOS[chave]["mudando"]["perde"],
                    GANHOS[chave]["frase_que_te_segura"]]
        achado = [_norm(linha.split(":", 1)[1]) for linha in gp if ":" in linha][:5]
        assert achado == [_norm(x) for x in esperado], f"{chave}: ganhos e perdas diferentes do arquivo aprovado"
    print("conferido palavra por palavra contra o arquivo aprovado: 4 descrições, 4 SWOTs, 4 ganhos e perdas")


def conferir():
    assert set(DESCRICOES) == set(SWOT) == set(GANHOS) == set(CHAVES)
    for chave, texto in DESCRICOES.items():
        assert 300 <= len(texto) <= 1400, f"{chave}: tamanho fora do esperado ({len(texto)})"
        assert texto.count("\n\n") == 2, f"{chave}: esperava 3 parágrafos"
    # A trava do bug que já aconteceu no DISC: o mesmo texto gravado em várias siglas.
    assert len(set(DESCRICOES.values())) == 4, "dois perfis com o MESMO texto"
    for chave in CHAVES:
        for quadrante in ("forcas", "fragilidades", "oportunidades", "ameacas"):
            itens = SWOT[chave][quadrante]
            assert len(itens) == 4 and all(i.strip() for i in itens), f"{chave}/{quadrante}: precisa de 4 itens"
        for coluna in ("mantendo", "mudando"):
            assert GANHOS[chave][coluna]["ganha"].strip() and GANHOS[chave][coluna]["perde"].strip()
        assert GANHOS[chave]["frase_que_te_segura"].startswith('"')
    _conferir_contra_o_arquivo()


def _ambiente():
    env = {}
    for nome in (".env.local", ".env"):
        caminho = os.path.join(RAIZ, nome)
        if os.path.exists(caminho):
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


def aplicar():
    conferir()
    url, key = _ambiente()
    # 1. A descrição: as 4 linhas já existem (pendentes, sem texto) — ganham o texto e passam a publicado.
    existentes = _chamar(url, key, "GET", f"report_content?version_id=is.null&section=eq.{SECAO_TEXTO}"
                                          "&select=id,dimension_key,status,body")
    por_chave = {r["dimension_key"]: r for r in existentes}
    for chave in CHAVES:
        atual = por_chave.get(chave)
        assert atual, f"{SECAO_TEXTO}/{chave}: a linha não existe — esperava achar a pendente"
        if atual["status"] == "publicado" and atual["body"] not in ("", DESCRICOES[chave]):
            sys.exit(f"{chave}: já tem OUTRO texto publicado — não sobrescrevo sem ordem do dono")
        feito = _chamar(url, key, "PATCH", f"report_content?id=eq.{atual['id']}",
                        {"body": DESCRICOES[chave], "status": "publicado"})
        assert feito and feito[0]["body"] == DESCRICOES[chave]
        print(f"  descrição {chave}  publicada  [{atual['id']}]")
    # 2. SWOT e Ganhos e Perdas: guardados, SEMPRE pendentes.
    for secao, dados in ((SECAO_SWOT, SWOT), (SECAO_GANHOS, GANHOS)):
        ja = _chamar(url, key, "GET", f"report_content?version_id=is.null&section=eq.{secao}&select=id,dimension_key")
        ja_por_chave = {r["dimension_key"]: r["id"] for r in ja}
        for i, chave in enumerate(CHAVES, start=1):
            linha = {"section": secao, "dimension_key": chave, "mode": "natural", "title": None, "body": "",
                     "content_json": dados[chave], "status": "pendente", "version_id": None,
                     "band_min": None, "band_max": None, "sort_order": i}
            if chave in ja_por_chave:
                _chamar(url, key, "PATCH", f"report_content?id=eq.{ja_por_chave[chave]}",
                        {"content_json": dados[chave], "status": "pendente"})
                print(f"  {secao} {chave}  atualizada (pendente)  [{ja_por_chave[chave]}]")
            else:
                criado = _chamar(url, key, "POST", "report_content", [linha])[0]
                print(f"  {secao} {chave}  guardada (pendente)  [{criado['id']}]")
    # 3. Conferência pelo que o banco DEVOLVEU.
    depois = _chamar(url, key, "GET", f"report_content?version_id=is.null&section=eq.{SECAO_TEXTO}"
                                      "&select=dimension_key,status,body")
    pub = {r["dimension_key"]: r["body"] for r in depois if r["status"] == "publicado"}
    # Os 4 simples com o texto daqui; as combinadas, se publicadas, são de `conteudo_temperamentos_combinados.py`.
    assert all(pub.get(chave) == DESCRICOES[chave] for chave in CHAVES), f"publicadas: {sorted(pub)} — faltou um simples"
    assert len(set(pub.values())) == len(pub), "o banco tem dois perfis com o MESMO texto"
    guardadas = _chamar(url, key, "GET", f"report_content?version_id=is.null&section=in.({SECAO_SWOT},{SECAO_GANHOS})"
                                         "&select=section,dimension_key,status")
    assert len(guardadas) == 8 and all(g["status"] == "pendente" for g in guardadas), guardadas
    print(f"\nNo banco: {len(pub)} descrições publicadas {sorted(pub)} · 8 seções guardadas como pendente")


if __name__ == "__main__":
    conferir()
    print("ok")
    if len(sys.argv) > 1 and sys.argv[1] == "aplicar":
        aplicar()
