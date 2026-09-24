"""
Descrição do perfil (`disc_perfil_texto`) — lote novo, completo, dos 16 perfis do DISC.

SUBSTITUI, só para o DISC, o que `conteudo_perfil_texto.py` cadastrou em 19/09 (S, CS, CI —
3 de 16, derivados por trechos da referência CIS com trava anti-cópia). Este lote é diferente:
texto ORIGINAL aprovado pelo dono do produto em 24/09/2026 (CONTEUDO_perfil_D_DISC.md +
CONTEUDO_DISC_15_perfis_restantes.md), escrito numa voz própria e consistente nos 16 — não
deriva da referência, então o padrão a/b/c (anunciar a combinação com o NOME literal da
dimensão) e a lista de frases-trava do script antigo não se aplicam aqui: a combinação nos
perfis "em tensão" é anunciada por IMAGEM ("duas forças que raramente andam juntas"), não pelo
nome da dimensão escrito por extenso. `conteudo_perfil_texto.py` continua valendo para
Temperamentos e VAK, que ainda usam o formato antigo — nada lá foi tocado.

Uso
---
    python3 scripts/conteudo_perfil_texto_disc_v2.py             # só confere
    python3 scripts/conteudo_perfil_texto_disc_v2.py aplicar
    python3 scripts/conteudo_perfil_texto_disc_v2.py aplicar --sobrescrever
"""
import itertools
import json
import os
import sys
import urllib.error
import urllib.request

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SECAO = "disc_perfil_texto"
LETRAS_DISC = ["D", "I", "S", "C"]

# Aprovado por Matheus Guedes em 24/09/2026, cadastrado exatamente como está nos dois arquivos.
TEXTOS = {
    "D": (
        "Sua comunicação nasce resolutiva. Você fala para chegar a algum lugar: abre a conversa já "
        "sabendo onde quer terminar, corta o excesso e move o grupo. Em sala, é você quem tira a "
        "discussão da inércia.\n\n"
        "No automático, porém, a velocidade vira a mensagem. Você entrega a conclusão sem o caminho "
        "que levou até ela — e quem ouve recebe uma decisão, não um convite. A resistência que "
        "aparece não é ao seu conteúdo: é ao fato de não ter havido espaço para entrar. O corpo e a "
        "voz acompanham a pressa, e o que você sente como firmeza chega como pressão.\n\n"
        "Seu trabalho é de intenção, não de contenção. Não se trata de falar menos nem de suavizar "
        "quem você é — mas de escolher, antes de abrir a boca, o que você quer que aconteça no "
        "outro. Diminuir o ritmo não te enfraquece: é o que transforma força em autoridade "
        "reconhecida."
    ),
    "I": (
        "Sua comunicação nasce viva. Você cria vínculo rápido, improvisa bem, ocupa o espaço com "
        "naturalidade e é lembrado pela energia que traz. O que muitos buscam durante um curso "
        "inteiro — presença — em você já vem de fábrica.\n\n"
        "No automático, a mesma força dispersa. O entusiasmo abre portas laterais no meio da fala, "
        "o assunto se ramifica, e o ponto central se dissolve numa conversa agradável que não deixa "
        "marca. Você é ouvido com prazer e lembrado com imprecisão — e essa diferença silenciosa é "
        "o que separa simpatia de influência real.\n\n"
        "Sua virada está em escolher uma intenção e sustentá-la até o fim. Uma ideia central, "
        "defendida com a energia que você já tem, vale mais que cinco distribuídas. Seu carisma "
        "nunca foi o problema; ele é o veículo. O que faltava era o destino."
    ),
    "S": (
        "Sua comunicação nasce segura. Você mantém o ritmo, escuta de verdade e cria um ambiente em "
        "que as pessoas se abrem — contam a você o que não contariam a outros. Num grupo, você é o "
        "chão.\n\n"
        "No automático, essa qualidade vira ausência. Para preservar a relação, você engole a "
        "discordância, adia a conversa difícil, aceita o combinado que não te serve. O que não foi "
        "dito na hora certa volta depois, maior e no pior momento. O silêncio parece cuidado, mas é "
        "o outro sendo privado de saber o que você pensa.\n\n"
        "Seu desenvolvimento é ocupar o espaço que você já conquistou. As pessoas confiam em você "
        "antes de você falar — dizer o que pensa não quebra esse vínculo; é o que o torna real."
    ),
    "C": (
        "Sua comunicação nasce confiável. Você verifica antes de afirmar, sustenta o que diz e não "
        "promete o que não entrega. Quando você fala, as pessoas sabem que foi conferido — "
        "credibilidade, que a maioria leva anos para construir, em você já está posta.\n\n"
        "No automático, o cuidado vira armadura. Você acumula justificativa antes da conclusão, "
        "antecipa a objeção que ninguém fez, e a ideia principal fica enterrada sob a precisão que "
        "deveria protegê-la. Quanto mais importa, mais você detalha — e mais difícil fica encontrar "
        "o que importa.\n\n"
        "Sua chave é entender que comunicar não é provar. Diga a conclusão primeiro; guarde o "
        "detalhe para quem pedir. Sua credibilidade não depende de demonstrar o percurso."
    ),
    # Em tensão (quadrantes opostos: D↔S, I↔C) — a combinação é anunciada por IMAGEM, não pelo nome
    # literal da dimensão (estilo próprio deste lote; diferente do padrão do script antigo).
    "DS": (
        "Você combina duas forças que raramente andam juntas: a pressa de resolver e a paciência de "
        "sustentar. Na maior parte do tempo você conduz — decide, aponta a direção, tira o grupo da "
        "inércia. Mas, diferente de quem só tem impulso, você não abandona o que começou: fica até "
        "terminar, e as pessoas percebem isso.\n\n"
        "A tensão aparece por dentro. Uma parte de você quer cortar a conversa e agir; outra quer "
        "preservar a relação e esperar. O resultado costuma ser oscilação: você segura, segura, "
        "segura — e um dia resolve tudo de uma vez, com uma dureza que surpreende quem estava "
        "acostumado com sua calma. Quem convive com você aprende que existe um limite invisível, e "
        "passa a temê-lo sem saber onde fica.\n\n"
        "Seu trabalho é tornar o limite visível antes de chegar nele. Dizer o incômodo pequeno, no "
        "tamanho pequeno. Sua firmeza não precisa ser um evento — pode ser um hábito."
    ),
    "SD": (
        "Você é firme sem ser barulhento. Sustenta o ritmo, cuida das pessoas, e quando precisa "
        "decidir, decide — sem precisar de plateia. É o tipo de presença que se descobre com o "
        "tempo: quem convive percebe que por trás da calma há uma posição bem definida.\n\n"
        "A tensão aparece na hora de mostrar isso. Você tem opinião formada e costuma guardá-la, "
        "esperando o momento certo que nem sempre chega. Aí, quando a situação aperta, a firmeza "
        "sai de uma vez — e soa desproporcional para quem nunca viu você discordar. O problema não "
        "é o que você diz; é que ninguém estava preparado, porque você só mostrou no limite.\n\n"
        "Seu desenvolvimento é antecipar sua própria posição. Dizer no começo o que você pensa "
        "poupa você de precisar dizer no fim, com força que não seria necessária."
    ),
    "IC": (
        "Você tem uma combinação rara: o calor de quem conecta e o rigor de quem confere. "
        "Geralmente é entusiasta, sociável, fácil de ouvir — mas, diante de assuntos que exigem "
        "precisão, aparece outra pessoa: analítica, atenta ao detalhe, incomodada com o que está "
        "mal-acabado.\n\n"
        "A tensão é entre agradar e acertar. Você quer que a conversa seja leve e que a informação "
        "esteja certa, e nem sempre dá para ter os dois no mesmo minuto. Quando o rigor vence, você "
        "corrige alguém no meio de um momento descontraído e o clima cai — sem você entender por "
        "quê. Quando o calor vence, você deixa passar um erro para não estragar o ambiente, e "
        "depois se cobra por isso.\n\n"
        "Sua chave é escolher qual dos dois a situação está pedindo. As duas capacidades são suas; "
        "o que falta é decidir qual entra em cena — em vez de deixar que a mais forte do momento "
        "decida sozinha."
    ),
    "CI": (
        "Você é analítico com brilho. Verifica antes de afirmar, sustenta o que diz — e comunica "
        "isso de um jeito que as pessoas realmente acompanham. Onde muitos técnicos perdem a "
        "plateia, você prende, porque tem vocabulário e presença além do conteúdo.\n\n"
        "A tensão aparece em ambientes diferentes. No trabalho, o rigor domina: você é reservado, "
        "cuidadoso, prefere conferir a arriscar. Em ambientes onde se sente à vontade, "
        "especialmente entre gente próxima, aparece o comunicador — solto, engraçado, expansivo. "
        "Quem te conhece só de um lado costuma se surpreender com o outro, e às vezes desconfiar de "
        "qual é o verdadeiro.\n\n"
        "Seu desenvolvimento é deixar o lado leve entrar onde ele ainda não entra. Sua credibilidade "
        "já está garantida pelo rigor; ela não se perde por você ser humano em público — ganha "
        "alcance."
    ),
    # Integrados (letras vizinhas) — descrição corrida, sem anunciar combinação.
    "DI": (
        "Você conduz e engaja ao mesmo tempo. Decide rápido, aponta a direção e consegue levar "
        "gente junto — não pela hierarquia, mas porque as pessoas querem ir. É a combinação natural "
        "de quem abre mercado, funda empresa, puxa um grupo do zero.\n\n"
        "O risco está na velocidade somada ao encanto: você convence antes de conferir, e o "
        "entusiasmo faz a promessa crescer. As pessoas vão com você e, quando o plano muda, é a sua "
        "palavra que fica no jogo. Também é comum atropelar sem perceber, porque a reação imediata "
        "costuma ser boa — o desconforto aparece depois, longe de você.\n\n"
        "Seu trabalho é prometer no tamanho que você entrega. Sua energia já move o grupo; o que a "
        "sustenta é o histórico de fazer o que disse."
    ),
    "ID": (
        "Você é o comunicador que fecha. Cria conexão rápido, sustenta a atenção — e, diferente de "
        "quem só encanta, sabe conduzir para uma decisão. Em vendas, palco e liderança de projeto, "
        "é uma combinação poderosa.\n\n"
        "O risco é o volume. Você ocupa muito espaço: fala mais que a maioria, e como funciona, "
        "ninguém te avisa. Os mais quietos param de contribuir, não por discordarem, mas por não "
        "encontrarem brecha. E quando o entusiasmo não convence, o impulso é insistir com mais "
        "energia — o que costuma piorar.\n\n"
        "Seu desenvolvimento é criar silêncio de propósito. Perguntar e esperar. A resposta que você "
        "não ouviu ainda é, quase sempre, a que faltava."
    ),
    "IS": (
        "Você aproxima e acolhe. Tem a leveza de quem conecta com facilidade e a constância de quem "
        "fica — as pessoas gostam de você no primeiro dia e continuam gostando anos depois. É o "
        "perfil que segura um grupo unido sem precisar de autoridade.\n\n"
        "O risco é a dificuldade com o desconforto. Você evita o conflito por dois motivos somados: "
        "não quer quebrar o clima e não quer ferir a relação. Então suaviza, adia, contorna com "
        "humor — e o que precisava ser dito nunca é dito. Com o tempo, você carrega combinados que "
        "não te servem e mágoas que ninguém sabe que existem.\n\n"
        "Sua chave é entender que a relação aguenta mais do que você imagina. A franqueza dita com "
        "cuidado não afasta — aprofunda."
    ),
    "SI": (
        "Você é a presença calma que também aquece. Escuta de verdade, sustenta o combinado, e tem "
        "a simpatia de quem torna o ambiente melhor só por estar nele. As pessoas confiam em você "
        "rápido e se abrem sem esforço.\n\n"
        "O risco é desaparecer atrás do outro. Você ajusta o que diz ao que o outro parece querer "
        "ouvir, cede espaço por hábito e adia sua própria agenda. Como você é agradável e "
        "disponível, ninguém percebe o custo — inclusive você, até acumular.\n\n"
        "Seu desenvolvimento é dizer o que você quer, e não só o que acomoda. Sua presença já é bem "
        "recebida; ela não deixa de ser por carregar uma vontade própria."
    ),
    "SC": (
        "Você é confiável em dobro. Mantém o ritmo, cumpre o combinado e faz bem feito — pensa de "
        "forma sistemática, cuida do detalhe, e tem paciência para levar um trabalho até o fim sem "
        "perder a qualidade no meio do caminho. Em qualquer equipe, você é quem sustenta.\n\n"
        "O risco é a lentidão para se mover e para se posicionar. Você prefere o conhecido ao novo, "
        "prepara antes de falar, e quando finalmente está pronto a conversa já andou. Também tende "
        "a absorver o excesso em silêncio: não reclama, não negocia prazo, e quando o limite chega, "
        "ele chega sem aviso.\n\n"
        "Seu trabalho é falar antes de estar pronto. A opinião parcial dita no tempo certo vale mais "
        "que a conclusão perfeita entregue tarde."
    ),
    "CS": (
        "Você combina exatidão e constância. Pensa de forma sistemática, confere antes de afirmar e "
        "tem paciência para trabalhar num projeto até que ele esteja realmente concluído. Quando "
        "você diz que está pronto, está — e todos ao redor sabem disso.\n\n"
        "O risco é o excesso de zelo somado à dificuldade de dizer não. Você refina além do "
        "necessário e, ao mesmo tempo, aceita o que chega, o que cria uma conta que não fecha: mais "
        "trabalho, mesmo padrão, menos tempo. A cobrança vira interna, e o desgaste não aparece "
        "para ninguém.\n\n"
        "Sua chave é negociar antes de aceitar. Definir o que é bom o bastante e o que cabe no prazo "
        "não diminui seu padrão — protege ele."
    ),
    "CD": (
        "Você decide com base, não com impulso. Analisa, confere e então age — e age com firmeza. É "
        "o perfil de quem assume decisões difíceis em ambientes técnicos, onde errar custa caro e o "
        "argumento precisa se sustentar.\n\n"
        "O risco é a combinação de rigor com pouca paciência. Quando o outro apresenta algo mal "
        "fundamentado, você aponta a falha direto — e está certo no conteúdo, mas o efeito é de "
        "julgamento. As pessoas passam a te mostrar só o que está pronto, e você perde exatamente o "
        "que gostaria de ver cedo: o problema em formação.\n\n"
        "Seu desenvolvimento é separar o erro da pessoa. Perguntar como chegou ali antes de dizer "
        "onde está errado. Você não perde rigor com isso; ganha acesso."
    ),
    "DC": (
        "Você quer resultado e quer certo. Decide rápido, mas não no escuro: exige base, checa o "
        "que sustenta, e não aceita \"mais ou menos\" como resposta. É o perfil de quem entrega com "
        "velocidade sem abrir mão do padrão.\n\n"
        "O risco é a exigência dupla sobre os outros — e sobre você. Você cobra rapidez e precisão "
        "ao mesmo tempo, o que é difícil de entregar, e a insatisfação transparece antes de você "
        "decidir demonstrá-la. Com o tempo, o time trabalha com medo de errar, e medo produz "
        "exatamente o que você não quer: cautela, lentidão, informação filtrada.\n\n"
        "Sua chave é dizer qual dos dois importa mais naquela entrega. Quando você explicita a "
        "prioridade, o outro consegue acertar. Quando não, ele tenta adivinhar — e erra nos dois."
    ),
}


def siglas_disc():
    return [k for k in LETRAS_DISC] + ["".join(p) for p in itertools.permutations(LETRAS_DISC, 2)]


def conferir():
    todas = set(siglas_disc())
    assert todas == set(TEXTOS), f"faltando ou sobrando sigla: {todas.symmetric_difference(set(TEXTOS))}"
    for sigla, texto in TEXTOS.items():
        assert 200 <= len(texto) <= 1400, f"{sigla}: tamanho fora do esperado ({len(texto)})"
    # Trava contra o bug já cometido uma vez aqui: `body` puxando de uma variável de loop que
    # sobrou de fora, em vez do texto da PRÓPRIA sigla — as 16 saíram todas iguais (a do DC) até
    # esta prova pegar. Nunca mais sem checar que os 16 textos são de fato 16 textos distintos.
    assert len(set(TEXTOS.values())) == len(TEXTOS), "dois ou mais perfis com o MESMO texto — bug de novo"
    return [
        {
            "section": SECAO, "dimension_key": sigla, "mode": "natural", "title": None,
            "body": TEXTOS[sigla], "status": "publicado", "version_id": None,
            "band_min": None, "band_max": None, "sort_order": i,
        }
        for i, sigla in enumerate(siglas_disc(), start=1)
    ]


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
    existentes = _chamar(url, key, "GET", f"report_content?version_id=is.null&section=eq.{SECAO}&select=id,dimension_key,body,status")
    por_chave = {r["dimension_key"]: r for r in existentes}
    novos, diferentes = [], []
    for b in bs:
        atual = por_chave.get(b["dimension_key"])
        if atual is None:
            novos.append(b)
        elif (atual["body"], atual["status"]) != (b["body"], b["status"]):
            diferentes.append((atual, b))
    if novos:
        criados = _chamar(url, key, "POST", "report_content", novos)
        for r in criados:
            print(f"  criado    {r['id']}  {r['dimension_key']:<4} publicado")
    for atual, b in diferentes:
        if sobrescrever:
            _chamar(url, key, "PATCH", f"report_content?id=eq.{atual['id']}", {"body": b["body"], "status": "publicado"})
            marca = "SUBSTITUÍDO (já tinha texto publicado antes)" if atual["status"] == "publicado" else "REESCRITO"
            print(f"  {marca:45} {atual['id']}  {b['dimension_key']}")
            if atual["status"] == "publicado":
                print(f"      texto antigo: {atual['body'][:90]}...")
                print(f"      texto novo:   {b['body'][:90]}...")
        else:
            print(f"  DIFERE    {atual['id']}  {b['dimension_key']:<4} banco={atual['status']} (não mexi; use --sobrescrever)")
    depois = _chamar(url, key, "GET", f"report_content?version_id=is.null&section=eq.{SECAO}&select=dimension_key,status,body")
    pub = sorted(r["dimension_key"] for r in depois if r["status"] == "publicado")
    print(f"\nNo banco agora: {len(pub)} publicadas {pub}")
    # Conferência pelo que o banco DEVOLVEU, não pelo que o script achou que mandou.
    corpos = [r["body"] for r in depois if r["status"] == "publicado"]
    assert len(set(corpos)) == len(corpos), "o banco tem duas siglas publicadas com o MESMO texto — não confie, confira"
    print("conferido: as", len(corpos), "publicadas têm texto distinto entre si")


if __name__ == "__main__":
    conferir()
    print("ok", file=sys.stderr)
    if len(sys.argv) > 1 and sys.argv[1] == "aplicar":
        aplicar(sobrescrever="--sobrescrever" in sys.argv)
