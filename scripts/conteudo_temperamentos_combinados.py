"""
Temperamentos — as 12 descrições COMBINADAS (SAN+COL, COL+SAN, …), escritas pelo chat e aprovadas por Matheus
Guedes em 28/09/2026 (arquivo CONTEUDO_Temperamentos_12_combinados.md). Completa o que
`conteudo_temperamentos_perfis.py` cadastrou no mesmo dia: os 4 perfis simples.

ONDE ENTRA: no mesmo lugar dos 4 simples — `report_content`, seção `temperamentos_perfil_texto`, dimension_key =
a sigla do NATURAL como o motor a escreve ("SAN+COL": a primeira é a que lidera), mode 'natural', global
(version_id NULL). As 12 linhas JÁ EXISTEM (nasceram pendentes e vazias por `conteudo_perfil_texto.py`, para o
relatório mostrar o aviso de texto pendente): aqui elas só ganham o texto e passam a publicado. Nenhuma linha nova.

A ORDEM IMPORTA: SAN+COL e COL+SAN são perfis diferentes, com textos diferentes — a trava abaixo confere cada
sigla contra o título dela no arquivo aprovado ("SANGUÍNEO COM COLÉRICO" = SAN+COL), não pela posição no arquivo.

REGRA DE HERANÇA (a mesma do DISC, 24/09): combinado tem SÓ descrição própria. SWOT e Ganhos e Perdas não
existem para combinado — quando um dia forem ligados, vêm das duas dimensões. E hoje nem os dos simples aparecem:
`temperamentos_swot_comunicador` e `temperamentos_ganhos_perdas` seguem guardados como pendente (decisão do dono,
#302 — quatro SWOTs numa bateria cansariam). Este script não cria nem mexe nessas seções; só confere, no fim, que
continuam exatamente como estavam.

Dois grupos, como o arquivo explica: EM TENSÃO (temperamentos opostos — Sanguíneo × Melancólico, Colérico ×
Fleumático) anunciam a combinação; INTEGRADOS são descrição corrida.

Uso:
    python3 scripts/conteudo_temperamentos_combinados.py            # só confere (e contra o arquivo aprovado, se achar)
    python3 scripts/conteudo_temperamentos_combinados.py aplicar
"""
import itertools
import json
import os
import re
import sys
import urllib.error
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from conteudo_perfil_texto import FRASES_DA_REFERENCIA  # noqa: E402
from conteudo_temperamentos_perfis import DESCRICOES as DESCRICOES_SIMPLES  # noqa: E402

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ARQUIVO_APROVADO = os.path.expanduser("~/Desktop/CONTEUDO_Temperamentos_12_combinados.md")
SECAO_TEXTO = "temperamentos_perfil_texto"
SECOES_GUARDADAS = ("temperamentos_swot_comunicador", "temperamentos_ganhos_perdas")
CHAVES = ["SAN", "COL", "MEL", "FLE"]  # a ordem das dimensões no instrumento
NOMES = {"SAN": "SANGUÍNEO", "COL": "COLÉRICO", "MEL": "MELANCÓLICO", "FLE": "FLEUMÁTICO"}
OPOSTOS = [{"SAN", "MEL"}, {"COL", "FLE"}]
EM_TENSAO = {"SAN+MEL", "MEL+SAN", "COL+FLE", "FLE+COL"}

# Aprovado por Matheus Guedes em 28/09/2026, cadastrado exatamente como está no arquivo (conferido abaixo).
TEXTOS = {
    # SANGUÍNEO COM COLÉRICO
    "SAN+COL": (
        "Você move o grupo pela energia e pela vontade. Entusiasma, decide, puxa para a frente — é o tipo de "
        "presença que tira um time da inércia sem precisar de cargo para isso.\n\n"
        "O risco é a velocidade somada ao encanto. Você promete no calor, arrasta as pessoas junto, e quando o "
        "plano muda é a sua palavra que fica em jogo. Também é comum atropelar sem perceber, porque a reação "
        "imediata costuma ser boa — o desconforto aparece depois, longe de você.\n\n"
        "Seu trabalho é prometer no tamanho que entrega. Sua energia já move o grupo; o que a sustenta é o "
        "histórico de fazer o que disse."
    ),
    # SANGUÍNEO COM MELANCÓLICO
    "SAN+MEL": (
        "Você combina duas naturezas que raramente moram na mesma pessoa: o calor de quem se conecta rápido e a "
        "profundidade de quem leva tudo a sério. Na maior parte do tempo você é a pessoa leve, que anima o "
        "ambiente. Mas quando algo toca o que importa, aparece outra — reflexiva, exigente, que sente fundo.\n\n"
        "A tensão é entre a leveza e o peso. Você ri de algo na hora e remói aquilo à noite. Quem convive com "
        "você só de longe conhece o lado solar e se surpreende ao descobrir que você levou a sério uma frase "
        "dita de passagem. E você se cobra pelos dois lados: por não ser leve o bastante quando pesa, e por não "
        "ser sério o bastante quando está leve.\n\n"
        "Sua chave é parar de escolher entre os dois. Os dois são você. A profundidade dá peso à sua leveza, e a "
        "leveza torna sua profundidade suportável — para você e para quem está perto."
    ),
    # SANGUÍNEO COM FLEUMÁTICO
    "SAN+FLE": (
        "Você aproxima e acalma. Tem a leveza de quem conecta com facilidade e a constância de quem fica — as "
        "pessoas gostam de você no primeiro dia e continuam gostando anos depois, porque você não cansa ninguém.\n\n"
        "O risco é evitar o desconforto duas vezes: por não querer quebrar o clima e por não querer se mover. "
        "Você suaviza, adia, contorna com humor — e o que precisava ser dito nunca é dito. Com o tempo você "
        "carrega combinados que não te servem.\n\n"
        "Sua chave é entender que a relação aguenta mais do que você imagina. A franqueza dita com cuidado não "
        "afasta — aprofunda."
    ),
    # COLÉRICO COM SANGUÍNEO
    "COL+SAN": (
        "Você lidera com calor. Resolve rápido e leva gente junto — não pela hierarquia, mas porque as pessoas "
        "querem ir com você. Em momento de crise, é a combinação que segura o time e a moral ao mesmo tempo.\n\n"
        "O risco é o volume. Você ocupa muito espaço: fala mais que a maioria e decide antes dos outros, e como "
        "funciona, ninguém te avisa. Os mais quietos param de contribuir — não por discordarem, mas por não "
        "encontrarem brecha.\n\n"
        "Seu desenvolvimento é criar silêncio de propósito. Perguntar e esperar. A resposta que você não ouviu "
        "ainda é, quase sempre, a que faltava."
    ),
    # COLÉRICO COM MELANCÓLICO
    "COL+MEL": (
        "Você decide com base, não com impulso. Analisa, confere e então age com firmeza — é o perfil de quem "
        "assume decisões difíceis onde errar custa caro e o argumento precisa se sustentar.\n\n"
        "O risco é a exigência dupla, sobre os outros e sobre você. Você cobra rapidez e precisão ao mesmo "
        "tempo, o que é difícil de entregar, e a insatisfação transparece antes de você decidir demonstrá-la. "
        "Com o tempo, quem trabalha com você passa a ter medo de errar — e medo produz cautela, lentidão e "
        "informação filtrada.\n\n"
        "Sua chave é dizer qual dos dois importa mais naquela entrega. Quando você explicita a prioridade, o "
        "outro consegue acertar. Quando não, ele adivinha — e erra nos dois."
    ),
    # COLÉRICO COM FLEUMÁTICO
    "COL+FLE": (
        "Você é intenso com freio. Decide rápido, assume a frente, resolve — mas tem uma serenidade de fundo que "
        "impede você de explodir a cada contrariedade. É uma combinação valiosa: a força de quem age, com a "
        "regulação de quem não se descontrola.\n\n"
        "A tensão é entre agir e deixar passar. Uma parte quer resolver agora; outra acha que não vale a pena "
        "entrar. O resultado costuma ser acúmulo: você tolera, tolera, e um dia resolve tudo de uma vez, com uma "
        "intensidade que surpreende quem só conhecia sua calma. Quem convive aprende que existe um limite "
        "invisível, e passa a temê-lo sem saber onde fica.\n\n"
        "Seu trabalho é tornar o limite visível antes de chegar nele. Dizer o incômodo pequeno no tamanho "
        "pequeno. Sua firmeza não precisa ser um evento."
    ),
    # MELANCÓLICO COM SANGUÍNEO
    "MEL+SAN": (
        "Você é profundo com jeito de leve. Pensa antes de falar, cuida do detalhe, leva as relações a sério — e "
        "comunica isso com um calor que a maioria das pessoas reflexivas não tem. Por isso você consegue dizer "
        "coisas difíceis sem afastar ninguém.\n\n"
        "A tensão aparece na energia. O lado leve abre portas e aceita convites; o lado profundo precisa de "
        "silêncio para se recompor. Você diz sim no calor do momento e depois se arrepende, não por não querer "
        "ir, mas porque não tinha o combustível. Com o tempo isso vira um ciclo de empolgação e recolhimento que "
        "confunde quem está por perto.\n\n"
        "Seu desenvolvimento é respeitar o próprio ritmo antes de prometer. Um sim mais lento vale mais que um "
        "sim entusiasmado que você depois precisa desfazer."
    ),
    # MELANCÓLICO COM COLÉRICO
    "MEL+COL": (
        "Você é rigoroso e não recua. Prepara com cuidado, confere antes de afirmar, e quando chega a hora de "
        "sustentar, sustenta sem hesitar. Quem discorda de você precisa de argumento, não de volume.\n\n"
        "O risco é apontar a falha antes de entender o caminho. Quando alguém apresenta algo mal fundamentado, "
        "você diz onde está errado — e está certo no conteúdo, mas o efeito é de julgamento. As pessoas passam a "
        "te mostrar só o que já está pronto, e você perde exatamente o que gostaria de ver cedo: o problema em "
        "formação.\n\n"
        "Seu desenvolvimento é separar o erro da pessoa. Perguntar como ela chegou ali antes de dizer onde "
        "errou. Você não perde rigor com isso; ganha acesso."
    ),
    # MELANCÓLICO COM FLEUMÁTICO
    "MEL+FLE": (
        "Você é profundo e estável. Pensa antes, cumpre o combinado, cuida do detalhe e não se abala com o que "
        "agita os outros. Em qualquer equipe, você é quem sustenta o padrão sem precisar de holofote.\n\n"
        "O risco é a lentidão dobrada: você prepara demais e se move de menos. Prefere o conhecido ao novo, "
        "revisa antes de falar, e quando finalmente está pronto a conversa já andou. Também tende a absorver o "
        "excesso em silêncio — não reclama, não negocia prazo, e quando o limite chega, chega sem aviso.\n\n"
        "Seu trabalho é falar antes de estar pronto. A opinião parcial dita no tempo certo vale mais que a "
        "conclusão perfeita entregue tarde."
    ),
    # FLEUMÁTICO COM SANGUÍNEO
    "FLE+SAN": (
        "Você é a presença serena que também aquece. Escuta de verdade, sustenta o combinado, e tem a simpatia "
        "de quem torna o ambiente melhor só por estar nele. As pessoas se abrem com você sem esforço.\n\n"
        "O risco é desaparecer atrás do outro. Você ajusta o que diz ao que ele parece querer ouvir, cede espaço "
        "por hábito e adia a própria agenda. Como você é agradável e disponível, ninguém percebe o custo — "
        "inclusive você, até acumular.\n\n"
        "Seu desenvolvimento é dizer o que você quer, e não só o que acomoda. Sua presença já é bem recebida; "
        "ela não deixa de ser por carregar uma vontade própria."
    ),
    # FLEUMÁTICO COM COLÉRICO
    "FLE+COL": (
        "Você é calmo com força embaixo. Mantém o equilíbrio, escuta, não se abala com o que agita os outros — "
        "e, quando é preciso, decide sem hesitar. As pessoas costumam subestimar sua firmeza até precisarem "
        "dela.\n\n"
        "A tensão está em quando entrar. Você tem opinião formada e capacidade de resolver, mas o custo de se "
        "mover parece sempre alto demais, então espera. E quando finalmente entra, entra com tudo — o que soa "
        "desproporcional para quem nunca viu você discordar. O problema não é o que você faz; é que ninguém "
        "estava preparado.\n\n"
        "Seu desenvolvimento é entrar antes de ser obrigado. A sua leitura, que é fria e costuma ser a mais "
        "clara da sala, só serve se chegar enquanto a decisão ainda está aberta."
    ),
    # FLEUMÁTICO COM MELANCÓLICO
    "FLE+MEL": (
        "Você é sereno com profundidade. Mantém o equilíbrio quando o ambiente esquenta e, por baixo dessa "
        "calma, tem uma vida interior densa que quase ninguém alcança. Quem chega perto encontra muito mais do "
        "que imaginava.\n\n"
        "O risco é a invisibilidade. Você não se altera e não se expõe, então o que você pensa raramente chega a "
        "alguém — e as pessoas concluem que você não tem posição, quando na verdade você já concluiu tudo por "
        "dentro. Decisões são tomadas sem a leitura mais clara da sala.\n\n"
        "Sua chave é deixar aparecer o que você já concluiu por dentro. Não precisa ser alto nem rápido — "
        "precisa ser dito."
    ),
}


def siglas_combinadas():
    """Os 12 pares ORDENADOS, na ordem do instrumento — a mesma dos `sort_order` 5 a 16 no banco."""
    return ["+".join(p) for p in itertools.permutations(CHAVES, 2)]


def _conferir_contra_o_arquivo():
    """Cada texto daqui contra o arquivo aprovado, caractere por caractere — quando ele estiver no computador.
    A sigla é tirada do TÍTULO de cada trecho e conferida contra o nome por extenso ("SANGUÍNEO COM COLÉRICO"
    tem de ser SAN+COL, nessa ordem), para um texto nunca ir para a sigla invertida."""
    if not os.path.exists(ARQUIVO_APROVADO):
        print(f"(arquivo aprovado não encontrado em {ARQUIVO_APROVADO} — conferência contra ele pulada)")
        return
    texto = open(ARQUIVO_APROVADO, encoding="utf-8").read()
    trechos = re.findall(r"^## ([A-Z]{3}\+[A-Z]{3}) — (.+?)\n\n(.*?)(?=\n\n---|\n## |\Z)", texto, re.S | re.M)
    assert sorted(s for s, _, _ in trechos) == sorted(TEXTOS), "o arquivo e este script não têm as mesmas 12 siglas"
    for sigla, nome, corpo in trechos:
        primeira, segunda = sigla.split("+")
        assert nome == f"{NOMES[primeira]} COM {NOMES[segunda]}", f"{sigla}: o título diz '{nome}' — ordem trocada?"
        assert corpo.strip() == TEXTOS[sigla], f"{sigla}: texto diferente do arquivo aprovado"
    assert set(re.findall(r"^## ([A-Z]{3}\+[A-Z]{3})", texto.split("# GRUPO 2")[0], re.M)) == EM_TENSAO, \
        "o grupo EM TENSÃO do arquivo não é o deste script"
    print(f"conferido caractere por caractere contra o arquivo aprovado: {len(trechos)} descrições, cada uma na sua sigla")


def conferir():
    assert list(TEXTOS) == siglas_combinadas(), "faltando, sobrando ou fora de ordem — esperava os 12 pares ordenados"
    for sigla, texto in TEXTOS.items():
        assert 300 <= len(texto) <= 1400, f"{sigla}: tamanho fora do esperado ({len(texto)})"
        assert texto.count("\n\n") == 2 and "\n\n\n" not in texto, f"{sigla}: esperava 3 parágrafos"
        assert texto == texto.strip() and "  " not in texto, f"{sigla}: espaço sobrando"
        baixo = texto.lower()
        for frase in FRASES_DA_REFERENCIA:
            assert frase not in baixo, f"{sigla}: frase da referência comercial: '{frase}'"
    # A trava do bug que já aconteceu no DISC: o mesmo texto gravado em várias siglas.
    assert len(set(TEXTOS.values())) == 12, "dois combinados com o MESMO texto"
    assert not set(TEXTOS.values()) & set(DESCRICOES_SIMPLES.values()), "um combinado com o texto de um perfil simples"
    for a, b in itertools.combinations(CHAVES, 2):
        assert TEXTOS[f"{a}+{b}"] != TEXTOS[f"{b}+{a}"], f"{a}+{b} e {b}+{a} com o mesmo texto — a ordem importa"
    assert EM_TENSAO == {s for s in TEXTOS if set(s.split("+")) in OPOSTOS}, "grupo em tensão ≠ pares de opostos"
    _conferir_contra_o_arquivo()


# --------------------------------------------------------------------------- banco (REST)
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


def _chamar(url, key, metodo, caminho, corpo=None, cabecalhos=None):
    req = urllib.request.Request(
        f"{url}/rest/v1/{caminho}", method=metodo,
        data=None if corpo is None else json.dumps(corpo).encode(),
        headers={"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json",
                 "Prefer": "return=representation", **(cabecalhos or {})},
    )
    try:
        with urllib.request.urlopen(req) as r:
            texto = r.read().decode()
            return (json.loads(texto) if texto.strip() else None), r.headers
    except urllib.error.HTTPError as e:
        sys.exit(f"{metodo} {caminho} falhou ({e.code}): {e.read().decode()[:300]}")


def _ler(url, key, caminho):
    return _chamar(url, key, "GET", caminho)[0]


def _contar_report_content(url, key):
    _, cab = _chamar(url, key, "GET", "report_content?select=id&limit=1", cabecalhos={"Prefer": "count=exact"})
    return int(cab["Content-Range"].split("/")[1])


def aplicar():
    conferir()
    url, key = _ambiente()
    antes_total = _contar_report_content(url, key)

    # Um texto da VERSÃO venceria o global (intensidade.ts): se existisse algum, o relatório não mostraria este.
    da_versao = _ler(url, key, f"report_content?version_id=not.is.null&section=eq.{SECAO_TEXTO}&select=id")
    assert not da_versao, f"há {len(da_versao)} texto(s) de perfil de Temperamentos presos a uma versão — conferir antes"

    linhas = _ler(url, key, f"report_content?version_id=is.null&section=eq.{SECAO_TEXTO}&mode=eq.natural"
                            "&select=id,dimension_key,status,body&order=sort_order,id")
    por_sigla = {}
    for r in linhas:
        assert r["dimension_key"] not in por_sigla, f"{r['dimension_key']}: duas linhas para a mesma sigla"
        por_sigla[r["dimension_key"]] = r
    # Os 4 simples não são tocados aqui — só conferidos, antes e depois.
    for chave in CHAVES:
        assert por_sigla[chave]["status"] == "publicado" and por_sigla[chave]["body"] == DESCRICOES_SIMPLES[chave], \
            f"{chave}: o perfil simples não está como `conteudo_temperamentos_perfis.py` deixou — parei sem gravar nada"

    for sigla in siglas_combinadas():
        atual = por_sigla.get(sigla)
        assert atual, f"{sigla}: a linha não existe — esperava achar a pendente"
        if atual["status"] == "publicado" and atual["body"] == TEXTOS[sigla]:
            print(f"  {sigla:8} já estava publicada com este texto  [{atual['id']}]")
            continue
        if atual["status"] == "publicado" and atual["body"].strip():
            sys.exit(f"{sigla}: já tem OUTRO texto publicado — não sobrescrevo sem ordem do dono")
        feito, _ = _chamar(url, key, "PATCH", f"report_content?id=eq.{atual['id']}",
                           {"body": TEXTOS[sigla], "status": "publicado"})
        assert feito and len(feito) == 1 and feito[0]["body"] == TEXTOS[sigla] and feito[0]["status"] == "publicado"
        print(f"  {sigla:8} publicada ({'em tensão' if sigla in EM_TENSAO else 'integrada'})  [{atual['id']}]")

    # Conferência pelo que o banco DEVOLVE, não pelo que o script acha que mandou.
    depois = _ler(url, key, f"report_content?version_id=is.null&section=eq.{SECAO_TEXTO}&mode=eq.natural"
                            "&select=dimension_key,status,body")
    pub = {r["dimension_key"]: r["body"] for r in depois if r["status"] == "publicado"}
    esperado = {**DESCRICOES_SIMPLES, **TEXTOS}
    assert pub == esperado, f"no banco: {sorted(pub)} — esperava as 16 siglas com os textos aprovados"
    assert len(set(pub.values())) == 16, "o banco tem duas siglas com o MESMO texto"
    guardadas = _ler(url, key, "report_content?section=in.(" + ",".join(SECOES_GUARDADAS) + ")"
                               "&select=section,dimension_key,status,version_id")
    assert len(guardadas) == 8, f"SWOT/ganhos: {len(guardadas)} linhas, esperava 8 (4 simples × 2 seções)"
    assert all(g["status"] == "pendente" and g["version_id"] is None and "+" not in g["dimension_key"]
               for g in guardadas), "SWOT/ganhos: alguma publicada, presa a versão, ou de combinado"
    depois_total = _contar_report_content(url, key)
    assert depois_total == antes_total, f"report_content tinha {antes_total} e passou a {depois_total} — nada devia nascer"
    print(f"\nNo banco: {len(pub)} descrições de Temperamentos publicadas (4 simples + 12 combinadas), todas distintas;"
          f" SWOT e ganhos e perdas: 8 linhas, todas pendentes, nenhuma de combinado;"
          f" report_content: {depois_total} blocos (antes {antes_total}).")


if __name__ == "__main__":
    conferir()
    print("ok")
    if len(sys.argv) > 1 and sys.argv[1] == "aplicar":
        aplicar()
