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
sigla — hoje os 4 perfis SIMPLES (D, I, S, C; CONTEUDO_perfil_D_DISC.md +
CONTEUDO_DISC_15_perfis_restantes.md, ambos aprovados 24/09/2026).

⚠️ Os 12 perfis COMBINADOS ficam pendentes AQUI DE PROPÓSITO, e é isso mesmo — não é trabalho
faltando. Pela regra de herança que o dono do produto definiu em 24/09: a SWOT/Ganhos e
Perdas/Onde Isso Aparece de um perfil combinado (ex.: "DI") não é conteúdo próprio — é a das
DUAS letras que o formam, mostrada lado a lado. Uma vez que os 4 simples estão publicados (como
agora), os 12 combinados JÁ TÊM tudo que essas três seções precisam — não vai entrar mais linha
nenhuma aqui para eles. Falta só a montagem em `src/lib/disc-secoes-extra.ts`/`relatorio.ts`
saber buscar as DUAS letras em vez de uma (mudança de lógica combinada com o Matheus em 24/09,
pendente de confirmar o layout antes de implementar). "Comunicadores com Traços Semelhantes"
não tem regra de herança — combinados simplesmente não mostram essa seção.

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
        "I": {
            "forcas": ["Conexão imediata", "Improviso sob pressão", "Energia que contagia", "Simplifica o complexo"],
            "fragilidades": [
                "Ponto central se dispersa", "Foge do conflito com humor", "Excesso de palavra", "Combinado que fica vago",
            ],
            "oportunidades": ["Palco e apresentação", "Vídeo e redes", "Vendas consultivas", "Papéis de representação"],
            "ameacas": [
                "Ser lido como superficial", "Acordo que ninguém cumpre", "Promessa feita no entusiasmo",
                "Conversa adiada que azeda",
            ],
        },
        "S": {
            "forcas": ["Escuta genuína", "Constância no combinado", "Ambiente seguro ao redor", "Paciência real"],
            "fragilidades": [
                "Discordância engolida", "Conversa difícil adiada", "Posição que não aparece", "Acúmulo silencioso",
            ],
            "oportunidades": [
                "Mediação e conciliação", "Relação de longo prazo", "Formação e acompanhamento", "Times em reconstrução",
            ],
            "ameacas": [
                "Ser passado para trás por educação", "Ressentimento acumulado", "Ser lido como sem opinião",
                "Sobrecarga por não dizer não",
            ],
        },
        "C": {
            "forcas": [
                "Precisão no que afirma", "Preparo antes de falar", "Consistência ao longo do tempo",
                "Antecipa o que pode falhar",
            ],
            "fragilidades": [
                "Conclusão enterrada no detalhe", "Demora para se posicionar", "Excesso de ressalva",
                "Autocrítica que trava",
            ],
            "oportunidades": [
                "Temas técnicos e sensíveis", "Documentos e material escrito", "Ambientes que exigem rigor",
                "Formação e ensino",
            ],
            "ameacas": [
                "Ser lido como lento ou travado", "Perder a janela da decisão", "Cansar quem só queria a resposta",
                "Paralisia antes do bom o bastante",
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
        "I": {
            "mantendo": {
                "ganha": "Portas abertas, ambiente leve, conflito adiado, energia alta e a sensação constante de que foi bem.",
                "perde": (
                    "Ser lembrado com carinho e não com peso. Decisões tomadas por outros porque as suas não "
                    "ficaram claras. O cansaço de sustentar o clima de todo mundo."
                ),
            },
            "mudando": {
                "ganha": "A mesma simpatia, agora com consequência. Gente que não só gosta de você, mas conta com você.",
                "perde": "A tolerância ao desconforto. Aceitar que alguém saia da conversa chateado com você.",
            },
            "frase_que_te_segura": (
                '"Se eu for mais direto, as pessoas vão se afastar." — O oposto costuma acontecer. O que afasta '
                "não é a franqueza; é a sensação de nunca saber onde você está de verdade."
            ),
        },
        "S": {
            "mantendo": {
                "ganha": "Relações preservadas, ambiente sem atrito, confiança de todos.",
                "perde": (
                    "Voz nas decisões que te afetam. O respeito que vem de ter posição. E o peso do que você "
                    "nunca disse."
                ),
            },
            "mudando": {
                "ganha": "Ser ouvido quando importa. Relações mais verdadeiras. Parar de carregar o que era do outro.",
                "perde": "A paz imediata. E a certeza de que ninguém vai ficar chateado.",
            },
            "frase_que_te_segura": (
                '"Se eu falar o que penso, vou estragar a relação." — A relação aguenta mais do que você imagina. '
                "A franqueza dita com cuidado não afasta: aprofunda."
            ),
        },
        "C": {
            "mantendo": {
                "ganha": "Confiança total no que diz, zero retratação, segurança de estar certo.",
                "perde": (
                    "Velocidade. Espaço para quem fala mais e sabe menos. E a ideia boa que nunca saiu porque "
                    "não estava pronta."
                ),
            },
            "mudando": {
                "ganha": "Ser ouvido no tempo em que a decisão acontece. Mesma credibilidade, agora com alcance.",
                "perde": "A proteção de ter conferido tudo. E o conforto de nunca errar em público.",
            },
            "frase_que_te_segura": (
                '"Se eu não explicar tudo, não vão levar a sério." — Comunicar não é provar. Sua credibilidade já '
                "está no fato de você não falar o que não sustenta."
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
        "I": {
            "situacoes": [
                {
                    "situacao": "Liderando",
                    "automatico": (
                        "Você engaja pela relação e o time gosta de trabalhar com você. Para não quebrar o "
                        "clima, você suaviza o combinado e a régua vira negociável."
                    ),
                    "tecnica": "Separe o momento de conectar do momento de combinar. Feche dizendo quem faz o quê e até quando.",
                },
                {
                    "situacao": "Vendendo",
                    "automatico": "Você abre qualquer porta e cria simpatia em minutos. Mas conversa boa vira reunião agradável sem fechamento.",
                    "tecnica": "Antes de entrar, escreva a frase que você quer ouvir do cliente no fim.",
                },
                {
                    "situacao": "Falando em público",
                    "automatico": (
                        "Você tem palco: prende, diverte, sustenta a atenção. O risco é sair do roteiro atrás "
                        "da reação e nunca voltar."
                    ),
                    "tecnica": "Três marcos fixos por fala. Improvise entre eles, mas passe pelos três.",
                },
                {
                    "situacao": "Fazendo networking",
                    "automatico": (
                        "É seu território natural, e aí mora a armadilha: você conhece muita gente e "
                        "aprofunda pouco."
                    ),
                    "tecnica": "Saia de cada evento com três nomes, não trinta. Follow-up em 48 horas.",
                },
                {
                    "situacao": "Gravando vídeo",
                    "automatico": "Sua entrega funciona bem na câmera. Você começa a gravar sem saber onde vai parar e o corte fica impossível.",
                    "tecnica": "Defina a última frase antes de gravar a primeira.",
                },
                {
                    "situacao": "Em família",
                    "automatico": (
                        "Você anima a casa, mas desvia da conversa difícil com humor. Quem está do outro "
                        "lado se sente não levado a sério."
                    ),
                    "tecnica": "Quando perceber a piada chegando num assunto pesado, segure.",
                },
                {
                    "situacao": "Entre pares",
                    "automatico": (
                        "Você é bem-quisto, mas evita o conflito aberto e acaba concordando na frente e "
                        "discordando depois."
                    ),
                    "tecnica": "Diga a discordância na reunião, não no corredor.",
                },
            ],
        },
        "S": {
            "situacoes": [
                {
                    "situacao": "Liderando",
                    "automatico": "Você sustenta o time, mas adia a conversa de desempenho até virar demissão.",
                    "tecnica": "Faça o incômodo virar conversa na mesma semana.",
                },
                {
                    "situacao": "Vendendo",
                    "automatico": "Constrói confiança como poucos, mas não pede o fechamento.",
                    "tecnica": "Termine toda reunião com uma pergunta de decisão.",
                },
                {
                    "situacao": "Falando em público",
                    "automatico": "Tom constante e agradável; falta relevo.",
                    "tecnica": "Escolha uma frase para dizer mais devagar e mais alto.",
                },
                {
                    "situacao": "Fazendo networking",
                    "automatico": "Aprofunda bem, mas espera ser abordado.",
                    "tecnica": "Chegue e puxe a primeira conversa. Uma só.",
                },
                {
                    "situacao": "Gravando vídeo",
                    "automatico": "Transmite calma e confiança; o começo demora.",
                    "tecnica": "Comece pela frase mais forte, não pela apresentação.",
                },
                {
                    "situacao": "Em família",
                    "automatico": "Absorve o desconforto de todos e não diz o que precisa.",
                    "tecnica": "Diga o que você quer antes de perguntar o que os outros querem.",
                },
                {
                    "situacao": "Entre pares",
                    "automatico": "Concorda na reunião e discorda por dentro.",
                    "tecnica": 'Diga "tenho uma ressalva" antes que a reunião acabe.',
                },
            ],
        },
        "C": {
            "situacoes": [
                {
                    "situacao": "Liderando",
                    "automatico": 'Você explica o porquê em profundidade e o time se perde antes do "o quê".',
                    "tecnica": "Dê a decisão em uma frase; o raciocínio, se perguntarem.",
                },
                {
                    "situacao": "Vendendo",
                    "automatico": "Apresenta todas as ressalvas e planta dúvida onde não havia.",
                    "tecnica": "Responda a objeção feita, não a que você imaginou.",
                },
                {
                    "situacao": "Falando em público",
                    "automatico": "Conteúdo impecável, abertura arrastada.",
                    "tecnica": "Comece pela conclusão. O percurso vem depois.",
                },
                {
                    "situacao": "Fazendo networking",
                    "automatico": "Aprofunda com quem já conhece, custa a iniciar com estranho.",
                    "tecnica": "Prepare uma pergunta só e use com todo mundo.",
                },
                {
                    "situacao": "Gravando vídeo",
                    "automatico": "Informação sólida, primeiros segundos frios.",
                    "tecnica": "Corte tudo que vem antes da primeira ideia.",
                },
                {
                    "situacao": "Em família",
                    "automatico": "Corrige imprecisão em conversa que não pedia rigor.",
                    "tecnica": "Pergunte se é hora de resolver ou de escutar.",
                },
                {
                    "situacao": "Entre pares",
                    "automatico": "Trava a entrega por um detalhe que só você vê.",
                    "tecnica": 'Defina antes o que é "bom o bastante" — e pare ali.',
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
        "I": {
            "pessoas": [
                {"nome": "Silvio Santos", "descricao": "carreira inteira construída sobre improviso e conexão imediata."},
                {"nome": "Oprah Winfrey", "descricao": "referência em criar intimidade pública em minutos."},
                {"nome": "Luciano Huck", "descricao": "transita entre registros pela energia."},
                {"nome": "Ted Lasso (ficção)", "descricao": "vence pela relação, não pela técnica."},
            ],
        },
        "S": {
            "pessoas": [
                {"nome": "Ayrton Senna fora das pistas", "descricao": "serenidade e constância no trato."},
                {"nome": "Barack Obama", "descricao": "cadência e uso deliberado da pausa."},
                {"nome": "Samwise Gamgee (ficção)", "descricao": "lealdade que sustenta sem pedir palco."},
            ],
        },
        "C": {
            "pessoas": [
                {"nome": "Ada Lovelace", "descricao": "rigor e precisão como marca."},
                {"nome": "Tim Cook", "descricao": "contenção e exatidão na comunicação pública."},
                {"nome": "Hermione Granger e Spock (ficção)", "descricao": "o preparo como forma de cuidado."},
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
