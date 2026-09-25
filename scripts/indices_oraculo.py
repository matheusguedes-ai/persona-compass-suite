"""
ORÁCULO dos índices do perfil DISC (#304) — Positividade, Estima, Flexibilidade e Energia.

Escrito a partir da ESPECIFICAÇÃO (docs/motor-ipsativo.md, seção "Os índices (#304)"), não
copiado de `src/lib/indices.ts`: `scripts/testar_indices.py puro` roda os dois sobre as mesmas
respostas e exige o MESMO número, casa por casa. Recebe o resultado do motor ipsativo no formato
gravado em `computed_scores.ipsativo` (o mesmo que `ipsativo_oraculo.oraculo` devolve).

  positividade = MENOS em D e C ÷ total de MENOS           (Marston: ambiente percebido como desafio)
  energia      = MENOS em S e C ÷ total de MENOS           (Marston: resposta receptiva)
  aceitação    = 1 − MENOS ÷ (maximo − MAIS)               (rejeição só quando o estilo estava disponível)
  estima       = Σ MAIS × nota na ordem de aceitação ÷ Σ MAIS   (nota 1 = mais aceito, 0 = menos; empate = meio)
  flexibilidade= fração dos pares com ordem de MAIS contrária à de aceitação (empate de um lado = meia troca)
Estima e Flexibilidade só com as letras de sinal suficiente (#292) e disponíveis (maximo − MAIS > 0).
"""
import math

LETRAS_DO_DISC = ("D", "I", "S", "C")
LADO_DO_DESAFIO = ("D", "C")
LADO_RECEPTIVO = ("S", "C")


def _duas_casas(x):
    """Como o Math.round do JavaScript (meio arredonda para cima), não o round() do Python."""
    return math.floor(x * 100 + 0.5) / 100


def _sinal(x):
    return (x > 0) - (x < 0)


def _disp(l):
    return l["maximo"] - l["mais"]


def _cmp_aceitacao(a, b):
    """+1 se `a` é mais aceita que `b`: menos_a/disp_a < menos_b/disp_b, sem dividir."""
    return _sinal(b["menos"] * _disp(a) - a["menos"] * _disp(b))


def _fracao_dos_menos(letras, lado):
    total = sum(l["menos"] for l in letras)
    if total <= 0:
        return None
    return sum(l["menos"] for l in letras if l["chave"].strip().upper() in lado) / total


def _estima(validas):
    if len(validas) < 2:
        return None
    total_mais = sum(l["mais"] for l in validas)
    if total_mais <= 0:
        return None
    soma = 0
    for l in validas:
        a_frente = 0
        for outra in validas:
            if outra is l:
                continue
            c = _cmp_aceitacao(outra, l)
            a_frente += 1 if c > 0 else 0.5 if c == 0 else 0
        soma += l["mais"] * (1 - a_frente / (len(validas) - 1))
    return soma / total_mais


def _flexibilidade(validas):
    if len(validas) < 2:
        return None
    trocas, pares = 0, 0
    for i, a in enumerate(validas):
        for b in validas[i + 1:]:
            trocas += abs(_cmp_aceitacao(a, b) - _sinal(a["mais"] - b["mais"])) / 2
            pares += 1
    return trocas / pares


def indices(ips):
    """Lista como a de `calcularIndices`, ou None fora do DISC."""
    chaves = [l["chave"].strip().upper() for l in ips["letras"]]
    if len(chaves) != 4 or set(chaves) != set(LETRAS_DO_DISC):
        return None
    validas = [l for l in ips["letras"] if l["sinal_suficiente"] and _disp(l) > 0]
    v = lambda x: None if x is None else _duas_casas(x)  # noqa: E731
    return [
        {"key": "positividade", "label": "Positividade", "value": v(_fracao_dos_menos(ips["letras"], LADO_DO_DESAFIO))},
        {"key": "estima", "label": "Estima", "value": v(_estima(validas))},
        {"key": "flexibilidade", "label": "Flexibilidade", "value": v(_flexibilidade(validas))},
        {"key": "energia", "label": "Energia", "value": v(_fracao_dos_menos(ips["letras"], LADO_RECEPTIVO))},
    ]


def sem_arredondar(ips):
    """Os mesmos números antes das duas casas — para a calibração, que quer a distribuição fina."""
    validas = [l for l in ips["letras"] if l["sinal_suficiente"] and _disp(l) > 0]
    return {
        "positividade": _fracao_dos_menos(ips["letras"], LADO_DO_DESAFIO),
        "estima": _estima(validas),
        "flexibilidade": _flexibilidade(validas),
        "energia": _fracao_dos_menos(ips["letras"], LADO_RECEPTIVO),
    }
