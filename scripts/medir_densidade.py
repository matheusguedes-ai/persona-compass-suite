#!/usr/bin/env python3
"""Mede quanto de cada página do PDF está ocupado (#295).

    python3 scripts/medir_densidade.py arquivo.pdf [arquivo2.pdf ...]

O problema que motivou este script: num relatório de 25 páginas, algumas tinham 5 linhas de texto
e outras 29. Respiro é parte do design aprovado — o defeito é a IRREGULARIDADE, páginas quase
vazias ao lado de páginas cheias.

A medida é a fração da ALTURA ÚTIL (entre as margens) que vai do topo do conteúdo até o fim dele,
ignorando cabeçalho e rodapé, que existem em todas as páginas e não dizem nada sobre densidade.
Sai a média, o desvio e a lista das páginas mais vazias — que é onde se olha.
"""
import sys

try:
    import pypdfium2 as pdfium
except ImportError:
    sys.exit("Falta o pypdfium2: python3 -m pip install --user pypdfium2")

# Os mesmos valores de src/lib/pdf/doc.ts.
ALTURA = 841.89
MARGEM_TOPO, MARGEM_BASE = 92, 78
UTIL = ALTURA - MARGEM_TOPO - MARGEM_BASE


def ocupacao(pagina):
    """Fração da área útil coberta por conteúdo, do topo ao ponto mais baixo desenhado."""
    tp = pagina.get_textpage()
    y_min, y_max = None, None
    for i in range(tp.count_chars()):
        try:
            x0, y0, x1, y1 = tp.get_charbox(i)
        except Exception:
            continue
        if x1 - x0 == 0 and y1 - y0 == 0:
            continue
        # Fora da área útil = ornamento (cabeçalho, rodapé): não conta.
        if y0 < MARGEM_BASE - 6 or y1 > ALTURA - MARGEM_TOPO + 30:
            continue
        y_min = y0 if y_min is None else min(y_min, y0)
        y_max = y1 if y_max is None else max(y_max, y1)
    if y_min is None:
        return 0.0
    return min(1.0, (y_max - y_min) / UTIL)


def medir(caminho):
    doc = pdfium.PdfDocument(caminho)
    # A capa não entra: ela é peça gráfica, e "densidade de texto" não a descreve.
    valores = [ocupacao(doc[i]) for i in range(1, len(doc))]
    if not valores:
        return None
    media = sum(valores) / len(valores)
    desvio = (sum((v - media) ** 2 for v in valores) / len(valores)) ** 0.5
    return {
        "paginas": len(doc),
        "valores": valores,
        "media": media,
        "desvio": desvio,
        "min": min(valores),
        "max": max(valores),
    }


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    for caminho in sys.argv[1:]:
        r = medir(caminho)
        nome = caminho.split("/")[-1]
        if not r:
            print(f"{nome}: sem páginas de conteúdo")
            continue
        print(f"\n{nome} — {r['paginas']} páginas")
        print(f"  ocupação média {r['media']:.0%} · desvio {r['desvio']:.0%} · "
              f"da mais vazia ({r['min']:.0%}) à mais cheia ({r['max']:.0%})")
        vazias = [(i + 2, v) for i, v in enumerate(r["valores"]) if v < 0.55]
        if vazias:
            print(f"  {len(vazias)} página(s) abaixo de 55%:")
            for pag, v in vazias:
                print(f"     página {pag:2}: {v:.0%}")
        else:
            print("  nenhuma página abaixo de 55%")


if __name__ == "__main__":
    main()
