#!/usr/bin/env python3
"""Gera a logo Intenção em Azul Cerúleo para o cabeçalho do PDF (#294).

    python3 scripts/gerar_logo_ceruleo.py

A logo oficial "Logo Intensão Preto" é monocromática com canal alpha, então trocar só o RGB
preserva a FORMA EXATA da marca — nada aqui redesenha o logotipo. Rodar de novo só é necessário
se o arquivo oficial mudar.
"""
import os
import sys

try:
    from PIL import Image
except ImportError:
    sys.exit("Falta o Pillow: python3 -m pip install --user Pillow")

ORIGEM = os.path.expanduser(
    "~/Desktop/METODO INTENÇAO/AULAS/LOGOS/Logo Intenção/PNG/Logo Intensão Preto.png"
)
DESTINO = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                       "public/marca/intencao-ceruleo.png")
CERULEO = (0x02, 0x5E, 0xC4)

if not os.path.isfile(ORIGEM):
    sys.exit(f"não achei a logo oficial em {ORIGEM}")

im = Image.open(ORIGEM).convert("RGBA")
px = im.load()
for y in range(im.size[1]):
    for x in range(im.size[0]):
        a = px[x, y][3]
        if a > 0:
            px[x, y] = (*CERULEO, a)
im.save(DESTINO, optimize=True)
print(f"gerada: {DESTINO}  ({im.size[0]}x{im.size[1]})")
