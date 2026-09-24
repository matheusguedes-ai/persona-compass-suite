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

Uso:  python3 scripts/conteudo_termo_assistente.py conferir
      python3 scripts/conteudo_termo_assistente.py aplicar
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
    print(f"conferido: {len(SECOES)} seções, {len(TEXTO)} caracteres, rótulo de aceite separado")


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


def aplicar():
    conferir()
    url, key = _ambiente()
    atual = _chamar(url, key, "GET", f"assistente_termos?versao=eq.{VERSAO}&select=id,texto,rotulo_aceite,status")
    if not atual:
        from datetime import datetime, timezone
        criado = _chamar(url, key, "POST", "assistente_termos", [{
            "versao": VERSAO, "texto": TEXTO, "rotulo_aceite": ROTULO_ACEITE,
            "status": "publicado", "publicado_em": datetime.now(timezone.utc).isoformat(),
        }])[0]
        print(f"  criado    {criado['id']}  versão {VERSAO} publicada")
    elif (atual[0]["texto"], atual[0]["rotulo_aceite"]) == (TEXTO, ROTULO_ACEITE):
        print(f"  já está   {atual[0]['id']}  versão {VERSAO} ({atual[0]['status']}) — nada a fazer")
    else:
        sys.exit(f"A versão {VERSAO} já existe com OUTRO texto. Termo publicado não se edita: "
                 f"cadastre a versão {VERSAO + 1} (mude VERSAO aqui e rode de novo).")
    # Lê de volta do banco — o que vale é o que ficou gravado, não o que eu acho que mandei.
    gravado = _chamar(url, key, "GET", f"assistente_termos?versao=eq.{VERSAO}&select=texto,rotulo_aceite,status")[0]
    assert gravado["texto"] == TEXTO and gravado["rotulo_aceite"] == ROTULO_ACEITE, "o banco devolveu texto diferente"
    print(f"conferido no banco: versão {VERSAO} {gravado['status']}, texto idêntico ({len(gravado['texto'])} caracteres)")


if __name__ == "__main__":
    comando = sys.argv[1] if len(sys.argv) > 1 else "conferir"
    {"conferir": conferir, "aplicar": aplicar}[comando]()
