#!/usr/bin/env python3
"""
PREENCHE os índices do DISC nas respostas que já existiam (#304, segunda parte).

A partir da #304 o motor grava os índices DENTRO do resultado, em `computed_scores.ipsativo.indices`,
no momento do envio. As respostas enviadas antes não têm a chave. Este script a acrescenta — e só ela:
o resto de `computed_scores` fica byte a byte como estava (o script confere depois de gravar).

  python3 scripts/gravar_indices.py            # só MOSTRA o que faria (não grava nada)
  python3 scripts/gravar_indices.py --aplicar  # grava, confere e imprime o antes e o depois

A conta vem da função REAL (`src/lib/indices.ts`, pela ponte `scripts/indices_node.mjs`) e é conferida
contra o oráculo em Python antes de gravar — se os dois discordarem, nada é gravado. Só entram respostas
de DISC com o resultado do motor gravado; a trava na própria gravação (`indices=is.null`) impede
sobrescrever uma resposta que tenha ganho índice entre a leitura e a escrita. Desfazer = tirar a chave.
Ordem segura (regra 5 do CLAUDE.md): rodar DEPOIS de o código que grava e lê os índices estar no ar —
é acréscimo puro, então rodar antes também não quebraria nada; rodar de novo não repete nada.
"""
import argparse, json, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from indices_oraculo import indices as oraculo_indices  # noqa: E402
from testar_indices import rodar_node  # noqa: E402
from testar_ipsativo import rest  # noqa: E402


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--aplicar", action="store_true", help="grava de verdade (sem isto, só mostra)")
    args = ap.parse_args()

    versoes = [v["id"] for v in rest("GET", "test_versions", {"instrument_id": "eq.disc", "select": "id"})]
    respostas = rest("GET", "test_responses", {
        "version_id": "in.(" + ",".join(versoes) + ")", "computed_scores": "not.is.null",
        "select": "id,kind,submitted_at,canceled_at,computed_scores,people(email)", "order": "id"})
    # Pessoa FICTÍCIA de algum teste (e-mail @exemplo.invalido, a convenção dos scripts) não é resposta
    # existente de verdade: pode estar no meio do teste de outra sessão, e some quando ele termina.
    ficticias = [r for r in respostas if ((r.get("people") or {}).get("email") or "").endswith("@exemplo.invalido")]
    for r in ficticias:
        print(f"  pulando {r['id']}: pessoa fictícia de teste (não é resposta de verdade)")
    respostas = [r for r in respostas if r not in ficticias]
    faltam = [r for r in respostas
              if (r["computed_scores"] or {}).get("ipsativo") and "indices" not in r["computed_scores"]["ipsativo"]]
    ja_tem = [r for r in respostas if (r["computed_scores"] or {}).get("ipsativo", {}).get("indices") is not None]
    print(f"Respostas de DISC com resultado do motor: {len(faltam) + len(ja_tem)} · já com índice: {len(ja_tem)} · "
          f"a preencher: {len(faltam)}")
    if not faltam:
        print("Nada a fazer.")
        return 0

    calculado = rodar_node([r["computed_scores"]["ipsativo"] for r in faltam])
    problemas = 0
    for r, saida in zip(faltam, calculado):
        esperado = oraculo_indices(r["computed_scores"]["ipsativo"])
        r["_indices"] = saida["calculado"]
        if saida["calculado"] != esperado:
            problemas += 1
            print(f"  ERRO {r['id']}: TypeScript {saida['calculado']} ≠ oráculo {esperado}")
    if problemas:
        print("TypeScript e oráculo discordam — nada foi gravado.")
        return 1

    print("\nANTES — ids que vão ganhar a chave `ipsativo.indices` (o resto não muda):")
    for r in faltam:
        situacao = "cancelada" if r["canceled_at"] else (r["submitted_at"] or "sem envio")[:10]
        print(f"  {r['id']} ({r['kind']}, {situacao}) → {r['_indices']}")
    if not args.aplicar:
        print("\n(só mostrando — para gravar: --aplicar)")
        return 0

    print("\nGRAVANDO:")
    falhas = 0
    for r in faltam:
        antes = r["computed_scores"]
        novo = {**antes, "ipsativo": {**antes["ipsativo"], "indices": r["_indices"]}}
        gravadas = rest("PATCH", "test_responses",
                        {"id": f"eq.{r['id']}", "computed_scores->ipsativo->indices": "is.null"},
                        corpo={"computed_scores": novo})
        depois = rest("GET", "test_responses", {"id": f"eq.{r['id']}", "select": "computed_scores"})[0]["computed_scores"]
        resto_igual = {**depois, "ipsativo": {k: v for k, v in depois["ipsativo"].items() if k != "indices"}} == antes
        ok = len(gravadas or []) == 1 and depois["ipsativo"].get("indices") == r["_indices"] and resto_igual
        falhas += not ok
        print(f"  {'OK ' if ok else 'ERRO'} {r['id']}: índices {depois['ipsativo'].get('indices')} · "
              f"resto de computed_scores {'idêntico' if resto_igual else 'DIFERENTE'}")
    print("\nTUDO GRAVADO E CONFERIDO" if falhas == 0 else f"\n{falhas} FALHA(S)")
    return 0 if falhas == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
