#!/usr/bin/env python3
"""
Quantos tipos junguianos a derivação do DISC consegue de fato distinguir?

A pergunta importa porque o relatório mostra uma sigla de quatro letras. Se a
derivação só produz duas ou três famílias, a sigla dá ao leitor a impressão de
uma precisão que o cálculo não tem — e essa é exatamente a diferença entre
estimativa e resultado.

O QUE ESTE SCRIPT FEZ APARECER (30/07/2026)
-------------------------------------------
Com os três eixos que existiam (E/I, N/S, T/F) e sem J/P:

    ENT 32.9% · ISF 30.0% · IST 16.5% · ENF 16.0% · resto 4.6%
    EN… ou IS… = 95.5% dos perfis

Ou seja: uma classificação de duas famílias vestida de oito. A causa é
estrutural — `extroversao` pesa D e I, `intuicao` pesa D e I, então os dois
eixos concordam quase sempre. E o DISC tem só DOIS contrastes independentes
(ritmo: D+I contra S+C; foco: D+C contra I+S), enquanto Jung pede quatro eixos.
Nenhum ajuste de peso cabe quatro em dois.

O que mudou depois: entrou o eixo J/P (a sigla vinha com TRÊS letras, o que é
código malformado), e o relatório passou a esconder a sigla quando dois ou mais
eixos ficam abaixo de 55%. Os pesos NÃO foram inventados para "espalhar melhor"
— espalhar sem amostra é fabricar calibração, que é pior do que a estimativa
honesta. Este script fica como linha de base para o dia em que houver dados
reais e a calibração puder ser feita de verdade.

Uso:  python3 scripts/medir_derivacao_jung.py
"""
import collections

# Espelham DEFAULT_JUNG em src/lib/derivations.ts. Se mudarem lá, mudam aqui —
# é duplicação consciente, para o script não depender de rodar TypeScript.
EIXOS = {
    "E/I": ({"I": 0.55, "D": 0.45}, "E", "I"),
    "N/S": ({"D": 0.50, "I": 0.50}, "N", "S"),
    "T/F": ({"D": 0.50, "C": 0.50}, "T", "F"),
    "J/P": ({"C": 0.55, "S": 0.45}, "J", "P"),
}

PASSO = 5  # grade de 0 a 100 de 5 em 5: 194.481 perfis, roda em segundos


def peso(perfil, pesos):
    return sum(perfil.get(k, 0) * v for k, v in pesos.items())


def tipo_de(perfil):
    return "".join(
        alto if peso(perfil, p) >= 50 else baixo for p, alto, baixo in EIXOS.values()
    )


def main():
    conta = collections.Counter()
    faixa = range(0, 101, PASSO)
    for d in faixa:
        for i in faixa:
            for s in faixa:
                for c in faixa:
                    conta[tipo_de({"D": d, "I": i, "S": s, "C": c})] += 1

    total = sum(conta.values())
    print(f"{total} perfis na grade · {len(conta)} tipos distintos de 16\n")
    for t, n in sorted(conta.items(), key=lambda x: -x[1]):
        print(f"  {t}  {n:7d}  {100 * n / total:5.1f}%")

    acumulado = 0
    quantos = 0
    for _, n in sorted(conta.items(), key=lambda x: -x[1]):
        acumulado += n
        quantos += 1
        if acumulado / total >= 0.90:
            break
    print(f"\n{quantos} tipos concentram 90% dos perfis.")

    # O par que denuncia a colinearidade: E/I e N/S saem dos mesmos fatores.
    juntos = sum(n for t, n in conta.items() if t[:2] in ("EN", "IS"))
    print(f"EN… ou IS… (os dois primeiros eixos concordando): {100 * juntos / total:.1f}%")
    print("Quanto mais perto de 100%, menos os dois primeiros eixos dizem coisas diferentes.")


if __name__ == "__main__":
    main()
