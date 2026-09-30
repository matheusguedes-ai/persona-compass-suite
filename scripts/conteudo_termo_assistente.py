"""
Termo de consentimento da assistente do Método Intenção (#289).

Texto redigido em 19/09/2026 e aprovado pelo dono do produto
(Desktop/TERMO_consentimento_assistente_IA.md, seção "TEXTO DO TERMO"). Este script é a
fonte versionada: grava a VERSÃO 1 em `assistente_termos`, pela REST, como os outros
`conteudo_*.py`.

Regras do próprio arquivo do termo, e onde cada uma mora:
- consentimento ÚNICO para os cinco níveis → um termo só, sem capacidade por capacidade;
- registrar QUANDO e QUAL versão → `assistente_consentimentos` guarda versão, data e a cópia do
  texto (o banco copia da linha do termo, o cliente não escolhe o que fica registrado);
- texto legível na tela ANTES do aceite, aceite explícito e nunca marcado por padrão → na tela;
- termo publicado não se edita → o banco recusa (gatilho `assistente_termo_imutavel`); mudar o
  texto é cadastrar a versão 2 aqui.

A linha "[ ] Autorizo..." do arquivo não entra no corpo: é o rótulo da caixa de aceite
(`rotulo_aceite`), que a tela desenha como caixa de verdade.

VERSÃO 2 (#316, fatia A — 30/09/2026): o consentimento deixa de ser único. O termo passa a explicar as
QUATRO CHAVES independentes (aprovadas pelo dono em 28/09), todas desligadas até o aluno ligar, e traz,
PALAVRA POR PALAVRA, o bloco sobre as observações do mentor escrito e aprovado pelo dono em 28/09
(`BLOCO_OBSERVACAO_APROVADO` — o `conferir` falha se uma vírgula mudar). O resto do texto é redação
nova, a partir da versão 1, e só vale depois que o dono do produto aprovar: por isso `aplicar` grava a
versão 2 como RASCUNHO (`pendente` — nenhuma tela e nenhum aluno a enxerga), e só `publicar --confirmo`
a põe em vigor. Ordem obrigatória (regra 5): o código da #316A no ar ANTES de publicar a versão 2 —
publicada com o código antigo, o aluno aceitaria pela tela antiga, sem as chaves.

Uso:  python3 scripts/conteudo_termo_assistente.py conferir
      python3 scripts/conteudo_termo_assistente.py aplicar              # v1 (se faltar) e v2 como rascunho
      python3 scripts/conteudo_termo_assistente.py publicar --confirmo  # só com o aviso do dono do produto
"""
import json
import os
import re
import sys
import urllib.error
import urllib.request

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ARQUIVO_APROVADO = os.path.expanduser("~/Desktop/TERMO_consentimento_assistente_IA.md")

VERSAO = 1

# Os parágrafos do arquivo aprovado, com as quebras de linha do editor desfeitas (em Markdown,
# quebra simples dentro do parágrafo é espaço). Títulos em "### ", parágrafos separados por linha
# em branco. Nenhuma palavra mudou — `conferir` compara com o arquivo quando ele está na máquina.
TEXTO = """### Sobre a assistente

A plataforma tem uma assistente digital que pode conversar com você sobre seus resultados, seus testes e o seu caminho dentro do Método Intenção. Ela funciona com inteligência artificial e foi criada para te apoiar — não para te avaliar.

Antes de usar, é importante que você saiba exatamente o que ela faz com as suas informações.

### O que ela pode acessar

Com a sua autorização, a assistente pode consultar: os testes que você respondeu e os relatórios gerados a partir deles; sua presença e participação nas aulas; as aulas que você concluiu e suas avaliações; e o que você conversar com ela.

### O que ela guarda

Ela guarda o histórico das suas conversas e vai aprendendo sobre você com o tempo — o que você já contou, o que costuma perguntar, como usa a plataforma. É isso que permite que ela te ajude melhor a cada conversa, em vez de recomeçar do zero toda vez.

### Se a conversa entrar em assuntos delicados

Você pode falar com ela sobre o que quiser, inclusive sobre coisas pessoais. Quando o assunto for sensível, ela vai te avisar que aquilo ficará guardado e perguntar se você quer seguir. A escolha é sempre sua.

### O que o seu mentor vê — e o que não vê

O seu mentor não lê as suas conversas com a assistente. O que ele recebe é um resumo do que você está trabalhando e de como está evoluindo — os temas, não as palavras. É isso que permite que ele te ajude melhor nas aulas e na mentoria.

O que você contar de mais pessoal fica entre você e a assistente. Se em algum momento você quiser que algo chegue ao seu mentor, é só pedir a ela.

### Seus direitos, sempre

A qualquer momento você pode: ver tudo o que a assistente guardou sobre você; apagar o que quiser, ou tudo; pedir uma cópia das suas informações; e retirar esta autorização. Se retirar, ela para de acessar seus dados e o histórico é apagado.

### O que ela não é

A assistente não é profissional de saúde e não faz diagnóstico. Ela oferece leituras e sugestões a partir dos seus resultados — pontos de partida para a conversa, não verdades sobre quem você é. Quem conduz o seu processo é o seu mentor."""

ROTULO_ACEITE = "Autorizo o uso da assistente nos termos acima."

SECOES = [
    "Sobre a assistente",
    "O que ela pode acessar",
    "O que ela guarda",
    "Se a conversa entrar em assuntos delicados",
    "O que o seu mentor vê — e o que não vê",
    "Seus direitos, sempre",
    "O que ela não é",
]

# ------------------------------------------------------------------------------------------------------
# VERSÃO 2 — as quatro chaves (#316A). Rascunho até o dono do produto aprovar.
# ------------------------------------------------------------------------------------------------------
VERSAO_2 = 2

# Escrito e aprovado pelo dono do produto em 28/09/2026 — entra IGUAL, três parágrafos. Três decisões
# moram nele e não se mexem: "PODE registrar" (nem todo mentor usa — o termo não promete o que talvez não
# aconteça); manda o aluno PERGUNTAR AO MENTOR (a conversa é dos dois; a IA não vira juíza do que pode ser
# revelado); e NÃO diz que ela não vai contar (negar confirma que existe algo e convida a insistir).
BLOCO_OBSERVACAO_APROVADO = [
    "Seu mentor pode registrar observações sobre o seu processo.",
    "Ele pode anotar coisas que percebe sobre como você aprende e se comunica — e eu uso isso para te "
    "responder melhor, com mais precisão sobre o que você precisa.",
    "Essas anotações são de trabalho, não de julgamento: servem para eu te ajudar mais, não para guardar "
    "segredo sobre você. Se você quiser saber o que ele observou, pergunte a ele — essa conversa é de vocês "
    "dois, e eu não substituo ela.",
]

# Os títulos das chaves — os MESMOS de `src/lib/assistente/chaves.ts` (o `conferir` compara com o arquivo).
TITULOS_DAS_CHAVES = [
    "Lembrar das nossas conversas",
    "Aprender com o que eu faço na plataforma",
    "Meu mentor acompanha meu progresso",
    "Ajudar a melhorar a assistente",
]

TEXTO_2 = """### Sobre a assistente

A plataforma tem uma assistente digital que pode conversar com você sobre seus resultados, seus testes e o seu caminho dentro do Método Intenção. Ela funciona com inteligência artificial e foi criada para te apoiar — não para te avaliar.

Antes de usar, é importante que você saiba exatamente o que ela faz com as suas informações — e o que depende de uma escolha sua.

### O que ela usa para te responder

Com a sua autorização, a assistente consulta: os testes que você respondeu e os relatórios gerados a partir deles; o que você tem na plataforma — suas aulas e sua presença, as trilhas e o que você já concluiu, a agenda, os materiais liberados para você, as suas mentorias e os seus pontos; e o que você conversar com ela.

As suas conversas ficam guardadas para você retomar quando quiser. Só você vê.

### Se a conversa entrar em assuntos delicados

Você pode falar com ela sobre o que quiser, inclusive sobre coisas pessoais. Quando o assunto for sensível, ela vai te avisar que aquilo ficará guardado e perguntar se você quer seguir. A escolha é sempre sua.

### O que o seu mentor vê — e o que não vê

O seu mentor não lê as suas conversas com a assistente — nunca, com nenhuma escolha. Da assistente, ele só recebe algo se você ligar a chave “Meu mentor acompanha meu progresso”, explicada abaixo.

O que você contar de mais pessoal fica entre você e a assistente. Se em algum momento você quiser que algo chegue ao seu mentor, conte diretamente a ele: a assistente não leva recados.

### Quatro chaves que ficam na sua mão

Além do uso descrito acima, existem quatro chaves. Cada uma liga uma coisa diferente, e elas são independentes: você pode ligar uma e deixar as outras desligadas. Todas começam desligadas. Você escolhe o que ligar agora, junto com este termo, e pode mudar quando quiser.

As duas primeiras ficam só entre você e a assistente. As duas últimas levam algo seu para fora da conversa: para o seu mentor ou para melhorar a assistente.

Algumas funções ligadas por estas chaves chegam à plataforma aos poucos. Quando uma ainda não existe, a tela avisa, e a sua escolha passa a valer quando ela chegar.

### Chave 1 — “Lembrar das nossas conversas”

O que liga: a assistente guarda o que foi dito de uma conversa para a outra, e assim não precisa recomeçar do zero a cada vez. Com ela desligada, cada conversa começa do zero.

Quem vê: só você e a assistente.

Ao desligar: ela deixa de lembrar. Se a chave 3 estiver ligada, ela desliga junto.

### Chave 2 — “Aprender com o que eu faço na plataforma”

O que liga: a assistente passa a usar o jeito como você usa a plataforma — o que você assistiu, o que deixou pela metade, o seu ritmo, os seus pontos — para ajustar as respostas a você com o tempo. Com ela desligada, a assistente continua consultando o que você tem na plataforma para te responder, como descrito acima; o que ela não faz é aprender com o seu jeito de usar.

Quem vê: só você e a assistente.

Ao desligar: ela deixa de aprender com o que você faz.

### Chave 3 — “Meu mentor acompanha meu progresso”

O que liga: o seu mentor passa a receber um resumo do seu processo com a assistente — o tema do que você está trabalhando, o padrão e o progresso. Nunca a conversa escrita, e nunca o que você contou em confiança.

Quem vê: o seu mentor. Aqui a informação sai de você.

Esta chave só liga com a chave 1 ligada: sem a memória das conversas, o resumo seria de conversas soltas, sem mostrar evolução. Se a chave 1 desligar, esta desliga junto.

Ao desligar: o seu mentor deixa de receber resumos novos.

### Chave 4 — “Ajudar a melhorar a assistente”

O que liga: as suas conversas passam a ajudar a calibrar a assistente da plataforma, de forma despersonalizada — sem o seu nome e sem nada que identifique você.

Quem vê: a equipe que cuida da qualidade da assistente, sem saber que é você. Aqui também a informação sai de você.

Ao desligar: as suas conversas deixam de ser usadas para isso.

### Quando você desliga uma chave

Desligar uma chave não apaga nada sozinho: o que ela guardou fica em espera, parado, sem ser usado. Mas a escolha de apagar aparece na hora em que você desliga. A tela pergunta se você quer apagar o que foi guardado ou manter em espera, caso volte a ligar — e as duas opções ficam ali, lado a lado.

### Observações do seu mentor

Nas palavras da própria assistente:

""" + "\n\n".join(BLOCO_OBSERVACAO_APROVADO) + """

### Seus direitos, sempre

A qualquer momento você pode: ver tudo o que a assistente guardou sobre você e baixar uma cópia; ligar ou desligar qualquer chave; apagar tudo o que você informou à assistente, com um botão que fica sempre à mão; e retirar esta autorização. Se retirar, ela para de acessar seus dados, as quatro chaves desligam e o que foi guardado é apagado.

Fica registrado quando você aceitou, qual versão deste texto e quais chaves ficaram ligadas — e cada vez que você muda uma chave. Se este texto mudar, você lê a versão nova antes de continuar.

### O que ela não é

A assistente não é profissional de saúde e não faz diagnóstico. Ela oferece leituras e sugestões a partir dos seus resultados — pontos de partida para a conversa, não verdades sobre quem você é. Quem conduz o seu processo é o seu mentor."""

ROTULO_ACEITE_2 = "Autorizo o uso da assistente nos termos acima, com as chaves que escolhi."

SECOES_2 = [
    "Sobre a assistente",
    "O que ela usa para te responder",
    "Se a conversa entrar em assuntos delicados",
    "O que o seu mentor vê — e o que não vê",
    "Quatro chaves que ficam na sua mão",
    "Chave 1 — “Lembrar das nossas conversas”",
    "Chave 2 — “Aprender com o que eu faço na plataforma”",
    "Chave 3 — “Meu mentor acompanha meu progresso”",
    "Chave 4 — “Ajudar a melhorar a assistente”",
    "Quando você desliga uma chave",
    "Observações do seu mentor",
    "Seus direitos, sempre",
    "O que ela não é",
]


def _texto_do_arquivo_aprovado():
    """A seção "TEXTO DO TERMO" do arquivo aprovado, normalizada do mesmo jeito que TEXTO."""
    bruto = open(ARQUIVO_APROVADO, encoding="utf-8").read()
    secao = bruto.split("## TEXTO DO TERMO", 1)[1].split("\n---", 1)[0]
    secao = secao.split("### Aceite", 1)[0]
    blocos = [b.strip() for b in re.split(r"\n\s*\n", secao) if b.strip()]
    return "\n\n".join(" ".join(l.strip() for l in b.splitlines()) for b in blocos)


def conferir():
    titulos = re.findall(r"^### (.+)$", TEXTO, flags=re.M)
    assert titulos == SECOES, f"seções fora de ordem ou faltando: {titulos}"
    assert "[ ]" not in TEXTO and "[x]" not in TEXTO.lower(), "a caixa de aceite não vai no corpo do texto"
    assert ROTULO_ACEITE.strip() and "Autorizo" in ROTULO_ACEITE
    for titulo, corpo in zip(SECOES, re.split(r"^### .+$", TEXTO, flags=re.M)[1:]):
        assert len(corpo.strip()) > 40, f"seção vazia: {titulo}"
    if os.path.exists(ARQUIVO_APROVADO):
        assert _texto_do_arquivo_aprovado() == TEXTO, "o texto daqui DIFERE do arquivo aprovado"
        assert f"[ ] {ROTULO_ACEITE}" in open(ARQUIVO_APROVADO, encoding="utf-8").read(), "rótulo difere do arquivo"
        print("conferido: palavra por palavra igual ao arquivo aprovado")
    else:
        print("(arquivo aprovado não está nesta máquina — conferi só a estrutura)")
    print(f"conferido: versão 1 — {len(SECOES)} seções, {len(TEXTO)} caracteres, rótulo de aceite separado")
    conferir_versao_2()


def _titulos_em_chaves_ts():
    """Os títulos das chaves como a TELA os mostra (`src/lib/assistente/chaves.ts`), na ordem de lá."""
    fonte = open(os.path.join(RAIZ, "src", "lib", "assistente", "chaves.ts"), encoding="utf-8").read()
    return re.findall(r'^\s+titulo: "([^"]+)",$', fonte, flags=re.M)


def conferir_versao_2():
    titulos = re.findall(r"^### (.+)$", TEXTO_2, flags=re.M)
    assert titulos == SECOES_2, f"versão 2: seções fora de ordem ou faltando: {titulos}"
    assert "[ ]" not in TEXTO_2 and "[x]" not in TEXTO_2.lower(), "a caixa de aceite não vai no corpo do texto"
    for titulo, corpo in zip(SECOES_2, re.split(r"^### .+$", TEXTO_2, flags=re.M)[1:]):
        assert len(corpo.strip()) > 40, f"versão 2: seção vazia: {titulo}"
    # O bloco do dono, IGUAL e na ordem: três parágrafos seguidos, sem nada entre eles.
    paragrafos = [b.strip() for b in re.split(r"\n\s*\n", TEXTO_2) if b.strip()]
    i = paragrafos.index(BLOCO_OBSERVACAO_APROVADO[0])
    assert paragrafos[i:i + 3] == BLOCO_OBSERVACAO_APROVADO, "o bloco aprovado sobre a observação do mentor MUDOU"
    assert "PODE registrar" not in TEXTO_2 and "pode registrar observações" in TEXTO_2  # (a) "pode", não "registra"
    assert "pergunte a ele" in TEXTO_2                                                # (b) manda perguntar ao mentor
    for proibida in ("não posso te contar", "não vou contar", "não posso contar", "não conto", "é sigilos"):
        assert proibida not in TEXTO_2.lower(), f"(c) o termo não diz que ela não conta: achei “{proibida}”"
    # As quatro chaves, uma a uma, com o que liga, quem vê e o que acontece ao desligar.
    assert _titulos_em_chaves_ts() == TITULOS_DAS_CHAVES, "os títulos das chaves daqui diferem de chaves.ts"
    for n, titulo in enumerate(TITULOS_DAS_CHAVES, start=1):
        secao = TEXTO_2.split(f"### Chave {n} — “{titulo}”", 1)[1].split("\n### ", 1)[0]
        for parte in ("O que liga:", "Quem vê:", "Ao desligar:"):
            assert parte in secao, f"chave {n} sem “{parte}”"
    for regra in ("Todas começam desligadas", "só liga com a chave 1 ligada", "desliga junto",
                  "apagar o que foi guardado ou manter em espera"):
        assert regra in TEXTO_2, f"versão 2 sem a regra: {regra}"
    assert "é só pedir a ela" not in TEXTO_2, "a assistente não leva recados — a v1 prometia o contrário"
    assert ROTULO_ACEITE_2.startswith("Autorizo") and ROTULO_ACEITE_2 != ROTULO_ACEITE
    print(f"conferido: versão 2 — {len(SECOES_2)} seções, {len(TEXTO_2)} caracteres; bloco do mentor igual ao "
          "aprovado; as quatro chaves com o que liga, quem vê e o que acontece ao desligar; títulos iguais aos da tela")


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


def _gravar(url, key, versao, texto, rotulo, explica_chaves, publicar_agora):
    """Cria a versão se faltar; confere se já existe; rascunho pode ser reescrito, publicado não."""
    campos = "id,texto,rotulo_aceite,status,explica_chaves"
    atual = _chamar(url, key, "GET", f"assistente_termos?versao=eq.{versao}&select={campos}")
    if not atual:
        from datetime import datetime, timezone
        corpo = {"versao": versao, "texto": texto, "rotulo_aceite": rotulo, "explica_chaves": explica_chaves,
                 "status": "publicado" if publicar_agora else "pendente"}
        if publicar_agora:
            corpo["publicado_em"] = datetime.now(timezone.utc).isoformat()
        criado = _chamar(url, key, "POST", "assistente_termos", [corpo])[0]
        print(f"  criado    {criado['id']}  versão {versao} ({criado['status']})")
    elif (atual[0]["texto"], atual[0]["rotulo_aceite"], atual[0]["explica_chaves"]) == (texto, rotulo, explica_chaves):
        print(f"  já está   {atual[0]['id']}  versão {versao} ({atual[0]['status']}) — nada a fazer")
    elif atual[0]["status"] == "pendente":
        _chamar(url, key, "PATCH", f"assistente_termos?id=eq.{atual[0]['id']}",
                {"texto": texto, "rotulo_aceite": rotulo, "explica_chaves": explica_chaves})
        print(f"  reescrito {atual[0]['id']}  versão {versao} (rascunho — ainda não publicada)")
    else:
        sys.exit(f"A versão {versao} já está PUBLICADA com outro texto. Termo publicado não se edita: "
                 f"cadastre a versão {versao + 1}.")
    # Lê de volta do banco — o que vale é o que ficou gravado, não o que eu acho que mandei.
    gravado = _chamar(url, key, "GET", f"assistente_termos?versao=eq.{versao}&select={campos}")[0]
    assert (gravado["texto"], gravado["rotulo_aceite"], gravado["explica_chaves"]) == (texto, rotulo, explica_chaves), \
        "o banco devolveu texto diferente"
    print(f"conferido no banco: versão {versao} {gravado['status']}, texto idêntico ({len(gravado['texto'])} caracteres)")


def aplicar():
    conferir()
    url, key = _ambiente()
    _gravar(url, key, VERSAO, TEXTO, ROTULO_ACEITE, explica_chaves=False, publicar_agora=True)
    # A versão 2 nasce RASCUNHO: nenhuma tela e nenhum aluno enxerga até `publicar --confirmo`.
    _gravar(url, key, VERSAO_2, TEXTO_2, ROTULO_ACEITE_2, explica_chaves=True, publicar_agora=False)


def publicar():
    """Põe a versão 2 em vigor. SÓ com o aviso do dono do produto, e com o código da #316A já no ar."""
    if "--confirmo" not in sys.argv:
        sys.exit("Publicar a versão 2 faz TODO aluno com aceite da versão 1 ler o texto novo antes de continuar.\n"
                 "Só com o aviso do dono do produto e com o código da #316A já publicado (regra 5).\n"
                 "Para seguir: python3 scripts/conteudo_termo_assistente.py publicar --confirmo")
    conferir()
    url, key = _ambiente()
    atual = _chamar(url, key, "GET", f"assistente_termos?versao=eq.{VERSAO_2}&select=id,texto,rotulo_aceite,status,explica_chaves")
    if not atual:
        sys.exit("A versão 2 ainda não está no banco: rode `aplicar` primeiro.")
    t2 = atual[0]
    assert (t2["texto"], t2["rotulo_aceite"], t2["explica_chaves"]) == (TEXTO_2, ROTULO_ACEITE_2, True), \
        "o rascunho no banco difere do texto daqui — rode `aplicar` antes de publicar"
    if t2["status"] == "publicado":
        print(f"  já está publicada  {t2['id']}  versão {VERSAO_2}")
        return
    from datetime import datetime, timezone
    _chamar(url, key, "PATCH", f"assistente_termos?id=eq.{t2['id']}",
            {"status": "publicado", "publicado_em": datetime.now(timezone.utc).isoformat()})
    lido = _chamar(url, key, "GET", f"assistente_termos?id=eq.{t2['id']}&select=status,publicado_em")[0]
    assert lido["status"] == "publicado"
    print(f"  publicada {t2['id']}  versão {VERSAO_2} em {lido['publicado_em']}")


if __name__ == "__main__":
    comando = sys.argv[1] if len(sys.argv) > 1 else "conferir"
    {"conferir": conferir, "aplicar": aplicar, "publicar": publicar}[comando]()
