"""
Valores (Spranger) reescrito: 30 blocos situacionais.

O problema do conjunto anterior
-------------------------------
As alternativas eram autoelogios. "Assumo naturalmente a liderança quando o
grupo precisa de direção" (Político) ao lado de "Avalio se o esforço realmente
compensa antes de assumir um compromisso" (Econômico): a primeira soa nobre, a
segunda soa mesquinha. O resultado media o que a pessoa gosta de dizer sobre si.

O que muda
----------
- SITUAÇÃO concreta no enunciado, e as três alternativas custam alguma coisa.
  "Uma proposta paga muito bem, mas te afasta do que você acredita" tem três
  saídas defensáveis — inclusive recusar, que aqui aparece com o preço junto.
- COBERTURA EQUILIBRADA: são 6 valores e 3 alternativas por bloco. Os 30 blocos
  usam as 20 combinações possíveis de 3 entre 6, mais 10 escolhidas para fechar
  15 aparições por valor — 5 em cada posição da tela.
- 5 PARES DE CHECAGEM, cada um a 20 blocos de distância do seu par.
"""

# Valores de Spranger. Letras curtas só para montar os trios aqui.
# T=Teórico  E=Econômico  S=Estético  O=Social  P=Político  R=Religioso
BLOCOS = [
    ("Uma tarde inteira livre, sem cobrança nenhuma. Você:", {
        "T": "Vou fundo num assunto que me deu curiosidade.",
        "E": "Adianto algo que vai me poupar tempo ou dinheiro depois.",
        "S": "Faço alguma coisa bonita, sem utilidade nenhuma.",
    }, "tempo_livre"),

    ("Você recebe um dinheiro que não esperava, o bastante para fazer diferença.", {
        "O": "Divido com quem está passando aperto.",
        "P": "Uso para chegar onde eu quero chegar.",
        "R": "Dou um destino que me deixe em paz comigo.",
    }, "dinheiro"),

    ("Escolhendo um curso para fazer:", {
        "T": "O que me explica como as coisas funcionam.",
        "E": "O que se paga mais rápido.",
        "O": "O que me deixa mais útil para as pessoas.",
    }, None),

    ("Do que você não abre mão num trabalho:", {
        "S": "De fazer com capricho, que dê gosto de ver.",
        "P": "De ter voz nas decisões.",
        "R": "De não trair o que eu acredito.",
    }, "inegociavel"),

    ("Numa discussão sobre o rumo da empresa, o argumento que mais te convence:", {
        "T": "O que explica melhor a causa do problema.",
        "E": "O que dá mais retorno pelo esforço.",
        "P": "O que nos deixa numa posição mais forte.",
    }, None),

    ("O que faz um ambiente ser bom para você:", {
        "S": "Que seja bonito e bem cuidado.",
        "O": "Que as pessoas se deem bem ali.",
        "R": "Que tenha um sentido, não só função.",
    }, None),

    ("Você descobre que o jeito como sempre fez uma coisa estava errado.", {
        "T": "Quero entender onde estava o erro.",
        "E": "Quero saber quanto isso custou.",
        "R": "Me incomoda ter feito errado sem perceber.",
    }, "erro"),

    ("O elogio que te deixa mais satisfeito:", {
        "S": "“Ficou bonito.”",
        "O": "“Você me ajudou muito.”",
        "P": "“Foi você que puxou isso.”",
    }, None),

    ("Visitando uma cidade nova, você faz questão de:", {
        "T": "Entender a história do lugar.",
        "S": "Ver o que tem de mais bonito.",
        "O": "Conversar com quem mora ali.",
    }, "cultura"),

    ("Uma proposta paga muito bem, mas te afasta do que você acredita.", {
        "E": "Aceitaria: segurança financeira vem primeiro.",
        "P": "Aceitaria se me colocasse num lugar de mais influência.",
        "R": "Recusaria, mesmo perdendo a oportunidade.",
    }, None),

    ("O que te faz admirar alguém:", {
        "T": "Saber muito sobre aquilo de que fala.",
        "S": "Ter bom gosto e cuidado com a forma.",
        "P": "Ter presença e ser ouvido.",
    }, None),

    ("Sobrou uma hora no fim do dia.", {
        "E": "Resolvo alguma pendência prática.",
        "O": "Ligo para alguém que está precisando.",
        "R": "Paro para pensar na vida.",
    }, None),

    ("Um bom livro, para você, é o que:", {
        "T": "Explica alguma coisa que eu não sabia.",
        "S": "É bem escrito e dá prazer ler.",
        "R": "Mexe com o que eu penso sobre a vida.",
    }, None),

    ("Montando um time do zero, sua primeira preocupação:", {
        "E": "Que caiba no orçamento.",
        "O": "Que as pessoas se deem bem.",
        "P": "Que eu fique com as rédeas.",
    }, None),

    ("O que você quer que digam do seu trabalho daqui a dez anos:", {
        "T": "Que foi feito com rigor.",
        "O": "Que ajudou gente de verdade.",
        "P": "Que mudou o rumo das coisas.",
    }, None),

    ("Comprando uma coisa cara para você:", {
        "E": "Peso durabilidade e preço.",
        "S": "Peso o quanto me agrada olhar e usar.",
        "R": "Peso se eu preciso mesmo disso.",
    }, None),

    ("O que mais te incomoda numa notícia ruim:", {
        "T": "Ninguém entender a causa do problema.",
        "O": "As pessoas que vão sofrer com aquilo.",
        "R": "O tanto que a gente se afastou do que importa.",
    }, None),

    ("Um projeto seu vai ser apresentado. Você se preocupa mais com:", {
        "E": "Os números fecharem.",
        "S": "A apresentação ficar impecável.",
        "P": "Quem vai estar na sala.",
    }, None),

    ("O que te dá mais satisfação:", {
        "T": "Finalmente entender uma coisa difícil.",
        "P": "Ver a minha ideia ser adotada.",
        "R": "Sentir que estou no caminho certo.",
    }, None),

    ("Organizando um evento, seu foco:", {
        "E": "Não estourar o custo.",
        "S": "Ficar bonito e bem feito.",
        "O": "Todo mundo se sentir bem.",
    }, None),

    ("Um sábado sem compromisso nenhum. O que você faria com gosto:", {
        "T": "Ler sobre algo que me deu vontade de entender.",
        "E": "Deixar resolvido o que ia me atrapalhar depois.",
        "S": "Fazer alguma coisa bonita, só pelo prazer.",
    }, "tempo_livre"),

    ("Caiu um dinheiro extra na sua conta.", {
        "O": "Ajudaria alguém próximo.",
        "P": "Investiria em mim, para crescer.",
        "R": "Daria um destino que me deixasse tranquilo.",
    }, "dinheiro"),

    ("Escolhendo entre dois empregos com o mesmo salário:", {
        "T": "Fico com o que me ensina mais.",
        "E": "Fico com o que tem mais estabilidade e benefício.",
        "O": "Fico com o que tem gente melhor para conviver.",
    }, None),

    ("O que você não aceitaria perder no trabalho:", {
        "S": "O capricho de entregar coisa bem feita.",
        "P": "O espaço para influenciar o rumo.",
        "R": "A coerência com o que eu acredito.",
    }, "inegociavel"),

    ("Alguém te pede conselho sobre uma decisão grande.", {
        "T": "Ajudo a pessoa a entender o problema direito.",
        "E": "Faço com ela a conta do que compensa.",
        "P": "Digo qual caminho deixa ela mais forte.",
    }, None),

    ("Uma festa que você organizou. Deu certo se:", {
        "S": "Ficou bonita.",
        "O": "Todo mundo se sentiu à vontade.",
        "R": "Teve algum significado, não foi só festa.",
    }, None),

    ("Você percebe que vinha errando havia meses.", {
        "T": "Primeiro quero entender por que não vi antes.",
        "E": "Primeiro quero saber o tamanho do prejuízo.",
        "R": "Primeiro me cobro por ter deixado passar.",
    }, "erro"),

    ("O que faz um líder ser bom, na sua opinião:", {
        "S": "Cuidar de como as coisas são feitas.",
        "O": "Cuidar das pessoas.",
        "P": "Saber conduzir e decidir.",
    }, None),

    ("Num museu ou centro cultural, o que te prende:", {
        "T": "A explicação, o contexto.",
        "S": "A beleza das peças.",
        "O": "As histórias das pessoas envolvidas.",
    }, "cultura"),

    ("Você precisa dizer não a alguém importante.", {
        "E": "Digo não quando o custo não compensa.",
        "P": "Digo não quando me enfraquece.",
        "R": "Digo não quando fere o que eu acredito.",
    }, None),
]

DIMS = {
    "T": "0da4ae12-eff9-420d-8b42-687d190e9018",  # Teórico
    "E": "f4b45fa2-abb9-48c3-ade0-6ea3ddf2e3ae",  # Econômico
    "S": "6da588e1-b25f-4a7a-864d-792c35bd5057",  # Estético
    "O": "601ce9b7-e452-4aa0-b27b-bbb1ba2b001a",  # Social
    "P": "01877de3-c26c-4c6e-8b82-17775e6d04d0",  # Político
    "R": "ef6a5018-f874-4746-8ae1-967d7ddeac0f",  # Religioso
}
VERSION = "facb3043-ae0a-4162-81da-1262680939f5"
DICA = "Escolha a que MAIS e a que MENOS tem a ver com você."


def ordens():
    """
    Em que posição da tela cada valor aparece, bloco a bloco.

    Cada valor aparece 15 vezes no teste e precisa cair 5 vezes em cada uma das
    3 posições — senão quem clica sempre no primeiro item sai com um perfil
    fabricado pela posição, não pela escolha. Resolvido por busca simples com
    verificação no fim: se não fechar exato, o script quebra.
    """
    from itertools import permutations

    ordens_saida = []
    contagem = {d: [0, 0, 0] for d in DIMS}
    # Onde já caiu o primeiro bloco de cada par, para o segundo não repetir.
    primeiro_do_par = {}
    for idx, (_, alts, grupo) in enumerate(BLOCOS):
        chaves = list(alts)
        candidatas = list(permutations(chaves))
        # Se este é o segundo bloco de um par de checagem, ele NÃO pode começar
        # pelo mesmo valor do primeiro: senão quem clica sempre na primeira
        # alternativa escolhe igual nos dois e a checagem não pega nada.
        if grupo in primeiro_do_par:
            proibido = primeiro_do_par[grupo]
            candidatas = [p for p in candidatas if p[0] != proibido] or candidatas
        melhor = min(
            candidatas,
            key=lambda p: tuple(sorted(contagem[d][i] for i, d in enumerate(p))[::-1]),
        )
        if grupo and grupo not in primeiro_do_par:
            primeiro_do_par[grupo] = melhor[0]
        for i, d in enumerate(melhor):
            contagem[d][i] += 1
        ordens_saida.append(list(melhor))

    # A restrição do par tira o equilíbrio do lugar por uma ou duas unidades.
    # Aqui ele volta: nos blocos que NÃO fazem parte de par, troca a ordem por
    # outra do mesmo trio sempre que isso aproximar a distribuição de 5/5/5.
    livres = [i for i, b in enumerate(BLOCOS) if not b[2]]

    def desvio():
        return sum(abs(v - 5) for c in contagem.values() for v in c)

    def aplicar(ordem, sinal):
        for j, d in enumerate(ordem):
            contagem[d][j] += sinal

    def tentar_um():
        for i in livres:
            atual = ordens_saida[i]
            antes = desvio()
            for cand in permutations(atual):
                if list(cand) == atual:
                    continue
                aplicar(atual, -1)
                aplicar(cand, +1)
                if desvio() < antes:
                    ordens_saida[i] = list(cand)
                    return True
                aplicar(cand, -1)
                aplicar(atual, +1)
        return False

    def tentar_dois():
        """
        Mexer num bloco só não resolve sempre: tirar um valor da primeira posição
        põe outro no lugar dele, e o desequilíbrio só anda de lugar. Mudar dois
        blocos ao mesmo tempo dá o movimento que fecha a conta.
        """
        for a in range(len(livres)):
            for b in range(a + 1, len(livres)):
                i, j = livres[a], livres[b]
                oi, oj = ordens_saida[i], ordens_saida[j]
                antes = desvio()
                for ci in permutations(oi):
                    for cj in permutations(oj):
                        if list(ci) == oi and list(cj) == oj:
                            continue
                        aplicar(oi, -1); aplicar(oj, -1)
                        aplicar(ci, +1); aplicar(cj, +1)
                        if desvio() < antes:
                            ordens_saida[i], ordens_saida[j] = list(ci), list(cj)
                            return True
                        aplicar(ci, -1); aplicar(cj, -1)
                        aplicar(oi, +1); aplicar(oj, +1)
        return False

    while desvio() > 0 and (tentar_um() or tentar_dois()):
        pass
    return ordens_saida, contagem


def blocos():
    ords, _ = ordens()
    saida = []
    for (enunciado, alts, grupo), ordem in zip(BLOCOS, ords):
        cfg = {"hint": DICA}
        if grupo:
            cfg["check_group"] = grupo
        saida.append({
            "prompt": enunciado,
            "type": "forced_choice",
            "required": True,
            "config": cfg,
            "opcoes": [{"label": alts[d], "dim": d} for d in ordem],
        })
    return saida


if __name__ == "__main__":
    import sys
    from collections import Counter

    _, contagem = ordens()
    print(f"blocos: {len(BLOCOS)}", file=sys.stderr)
    total = Counter()
    for _, alts, _ in BLOCOS:
        total.update(alts.keys())
    print(f"  aparições por valor: {dict(sorted(total.items()))}", file=sys.stderr)
    assert set(total.values()) == {15}, f"desequilíbrio de cobertura: {total}"
    for d, c in sorted(contagem.items()):
        print(f"  {d}: posições {c}", file=sys.stderr)
        assert c == [5, 5, 5], f"valor {d} desequilibrado nas posições: {c}"
    pares = Counter(b[2] for b in BLOCOS if b[2])
    print(f"  pares de checagem: {dict(pares)}", file=sys.stderr)
    assert all(v == 2 for v in pares.values())
    pos = {}
    for i, b in enumerate(BLOCOS, start=1):
        if b[2]:
            pos.setdefault(b[2], []).append(i)
    print(f"  distância entre pares: {({k: v[1] - v[0] for k, v in pos.items()})}", file=sys.stderr)
    assert all(v[1] - v[0] >= 8 for v in pos.values())
    # A ordem precisa mudar entre os dois blocos do par: se caírem iguais, quem
    # clica sempre na mesma posição escolhe o mesmo dos dois lados e escapa da
    # checagem — foi o que aconteceu no VAK antes desta verificação existir.
    ords, _ = ordens()
    for grupo, (a, b) in pos.items():
        assert ords[a - 1][0] != ords[b - 1][0], f"par {grupo} começa igual nos dois blocos"
    print("  pares com primeira alternativa trocada: ok", file=sys.stderr)
    for enunciado, alts, _ in BLOCOS:
        assert len(alts) == 3, f"bloco fora do formato: {enunciado}"
    print("ok", file=sys.stderr)
