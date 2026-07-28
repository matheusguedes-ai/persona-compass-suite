"""
Simula alguém respondendo um teste, para conferir o que o motor devolve.

Serve para responder a pergunta que importa: "quem responde no automático sai
com um perfil bonito?". Se sair, o teste está errado, e o relatório vai
descrever uma pessoa que não existe.

Cria a resposta pelo banco, envia pelo endpoint público (o mesmo que a pessoa
usa), lê o resultado e apaga tudo no fim.

Uso:  python3 scripts/simular_resposta.py <versao> <estrategia>
      estratégias: primeira | ultima | coerente
"""
import json
import sys
import urllib.request

sys.path.insert(0, __file__.rsplit("/", 1)[0])
from aplicar_conteudo import KEY, URL, chamar  # noqa: E402

APP = "http://localhost:8080"


def perguntas(version_id):
    return chamar(
        "GET",
        f"test_questions?version_id=eq.{version_id}"
        "&select=id,sort_order,type,test_options(id,sort_order,option_scores(dimension_id))"
        "&order=sort_order",
        retorno=True,
    )


def dimensoes(version_id):
    return {
        d["id"]: d["key"]
        for d in chamar("GET", f"test_dimensions?version_id=eq.{version_id}&select=id,key", retorno=True)
    }


def responder(qs, estrategia, dims):
    """
    primeira / ultima: o preguiçoso, que sempre marca do mesmo lado.
    coerente: alguém com um perfil de verdade — tem uma ordem de preferência
    fixa entre as dimensões e a aplica em toda pergunta, esteja a alternativa
    em que posição estiver.

    A preferência precisa ser sobre TODAS as dimensões, não sobre uma só: num
    teste de vários eixos (o MBTI tem quatro), quem só persegue uma dimensão
    responde ao acaso nos outros eixos e o resultado sai contraditório de
    mentira — foi assim que a primeira versão deste script acusou o MBTI à toa.
    """
    ranking = {d: i for i, d in enumerate(sorted(dims, key=lambda k: dims[k]))}
    saida = []
    for q in qs:
        ops = sorted(q["test_options"], key=lambda o: o["sort_order"])

        def posto(o):
            return min((ranking.get(s["dimension_id"], 99) for s in o["option_scores"]), default=99)

        if estrategia == "coerente":
            preferida = min(ops, key=posto)
            outra = max(ops, key=posto)
        elif estrategia == "primeira":
            preferida, outra = ops[0], ops[-1]
        else:
            preferida, outra = ops[-1], ops[0]
        if q["type"] == "forced_choice":
            saida.append({"question_id": q["id"], "payload": {"most_option_id": preferida["id"], "least_option_id": outra["id"]}})
        else:
            saida.append({"question_id": q["id"], "payload": {"option_id": preferida["id"]}})
    return saida


def main(version_id, estrategia):
    qs = perguntas(version_id)
    if not qs:
        sys.exit("versão sem perguntas")
    dims = dimensoes(version_id)
    mentor = chamar("GET", f"test_versions?id=eq.{version_id}&select=mentor_id", retorno=True)[0]["mentor_id"]
    pessoa = chamar("POST", "people", [{
        "full_name": f"Simulação {estrategia}", "email": f"sim-{estrategia}@exemplo.invalido", "mentor_id": mentor,
    }], retorno=True)[0]
    resp = chamar("POST", "test_responses", [{
        "version_id": version_id, "person_id": pessoa["id"], "mentor_id": mentor,
        "status": "in_progress", "kind": "self",
    }], retorno=True)[0]

    try:
        req = urllib.request.Request(
            f"{APP}/api/public/response/{resp['id']}",
            method="POST",
            data=json.dumps({"answers": responder(qs, estrategia, dims)}).encode(),
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req) as r:
            json.loads(r.read().decode())
        gravado = chamar("GET", f"test_responses?id=eq.{resp['id']}&select=computed_scores", retorno=True)[0]
        c = gravado["computed_scores"] or {}
        norm = c.get("normalized") or {}
        linha = {dims.get(k, k): round(v["natural"]) for k, v in norm.items()} or {
            dims.get(k, k): v for k, v in (c.get("total") or {}).items()
        }
        q = c.get("qualidade") or {}
        print(f"  {estrategia:9} -> {dict(sorted(linha.items()))}")
        print(f"              selo: {q.get('nivel', '—')}  {'; '.join(q.get('motivos', [])) or 'sem ressalva'}")
    finally:
        chamar("DELETE", f"test_responses?id=eq.{resp['id']}")
        chamar("DELETE", f"people?id=eq.{pessoa['id']}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
