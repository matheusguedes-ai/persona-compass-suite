/**
 * dono-central — testa a decisão "quem é o dono?" SEM rede e SEM banco (cliente falso).
 *   npx tsx scripts/testar_dono_central.ts
 * Cobre `exigirDono` e a classificação de `membershipDoUsuario`. A regra de verdade mora no banco
 * (`is_account_owner()`); aqui se prova que o código só pergunta a ela — e que "ter pessoa cadastrada"
 * não faz ninguém virar dono.
 */
import { exigirDono, membershipDoUsuario } from "../src/lib/team.functions";

let falhas = 0;
function confere(nome: string, cond: boolean, extra = "") {
  if (!cond) falhas++;
  console.log(`${cond ? "ok   " : "FALHA"} ${nome}${cond ? "" : ` ${extra}`}`);
}

type Mundo = {
  donoNoBanco: boolean;           // resposta de is_account_owner()
  teamRow?: { kind: string; permissions?: string[]; owner_id: string };
  pessoasComoAvaliado: number;    // people.user_id = eu
  pessoasSobGestao: number;       // people.mentor_id = eu (qualquer login consegue criar)
};

function clienteFalso(m: Mundo) {
  const rpcs: string[] = [];
  const cliente = {
    rpc: async (nome: string) => {
      rpcs.push(nome);
      if (nome === "is_account_owner") return { data: m.donoNoBanco, error: null };
      return { data: null, error: null };
    },
    from: (tabela: string) => {
      if (tabela === "team_members") {
        const linhas = m.teamRow ? [{ id: "tm1", status: "ativo", created_at: "x", name: "n", team_member_groups: [], ...m.teamRow }] : [];
        const cadeia: Record<string, unknown> = {};
        for (const k of ["select", "eq", "order"]) cadeia[k] = () => cadeia;
        cadeia.limit = async () => ({ data: linhas, error: null });
        return cadeia;
      }
      // people: select(..., {count, head}).eq(coluna, id)
      return {
        select: () => ({
          eq: (coluna: string) => Promise.resolve({ count: coluna === "user_id" ? m.pessoasComoAvaliado : m.pessoasSobGestao, error: null }),
        }),
      };
    },
  };
  return { cliente: cliente as never, rpcs };
}

async function recusa(m: Mundo) {
  try { await exigirDono(clienteFalso(m).cliente); return false; } catch { return true; }
}

// ---- exigirDono: só pergunta ao banco ----
confere("dono (está em contas) passa", !(await recusa({ donoNoBanco: true, pessoasComoAvaliado: 0, pessoasSobGestao: 0 })));
confere("aluno recusado", await recusa({ donoNoBanco: false, pessoasComoAvaliado: 1, pessoasSobGestao: 0 }));
confere("aluno que cadastrou uma pessoa para si continua recusado", await recusa({ donoNoBanco: false, pessoasComoAvaliado: 1, pessoasSobGestao: 1 }));
confere("colaborador recusado", await recusa({ donoNoBanco: false, teamRow: { kind: "colaborador", owner_id: "outro" }, pessoasComoAvaliado: 0, pessoasSobGestao: 0 }));
confere("dono novo, sem nenhum aluno, passa", !(await recusa({ donoNoBanco: true, pessoasComoAvaliado: 0, pessoasSobGestao: 0 })));
{
  const f = clienteFalso({ donoNoBanco: true, pessoasComoAvaliado: 0, pessoasSobGestao: 0 });
  await exigirDono(f.cliente);
  confere("exigirDono pergunta is_account_owner (e só isso)", f.rpcs.length === 1 && f.rpcs[0] === "is_account_owner");
}

// ---- membershipDoUsuario ----
let r = await membershipDoUsuario(clienteFalso({ donoNoBanco: true, pessoasComoAvaliado: 0, pessoasSobGestao: 17 }).cliente, "u");
confere("dono → owner, com todas as permissões", r.kind === "owner" && r.permissions.length > 0);
r = await membershipDoUsuario(clienteFalso({ donoNoBanco: true, pessoasComoAvaliado: 0, pessoasSobGestao: 0 }).cliente, "u");
confere("dono novo SEM nenhum aluno → owner", r.kind === "owner");
r = await membershipDoUsuario(clienteFalso({ donoNoBanco: true, pessoasComoAvaliado: 1, pessoasSobGestao: 17 }).cliente, "u");
confere("dono que também é avaliado → owner + atalho", r.kind === "owner" && r.tambem_avaliado === true);
r = await membershipDoUsuario(clienteFalso({ donoNoBanco: false, pessoasComoAvaliado: 1, pessoasSobGestao: 0 }).cliente, "u");
confere("aluno → aluno, sem permissões", r.kind === "aluno" && r.permissions.length === 0);
r = await membershipDoUsuario(clienteFalso({ donoNoBanco: false, pessoasComoAvaliado: 1, pessoasSobGestao: 1 }).cliente, "u");
confere("aluno que cadastrou pessoa para si → AINDA aluno (o buraco)", r.kind === "aluno" && r.permissions.length === 0);
r = await membershipDoUsuario(clienteFalso({ donoNoBanco: false, pessoasComoAvaliado: 0, pessoasSobGestao: 0 }).cliente, "u");
confere("login novo, ainda sem cadastro → aluno (não abre o painel)", r.kind === "aluno");
r = await membershipDoUsuario(clienteFalso({ donoNoBanco: false, teamRow: { kind: "colaborador", permissions: ["pessoas", "relatorios"], owner_id: "dono1" }, pessoasComoAvaliado: 0, pessoasSobGestao: 0 }).cliente, "u");
confere("colaborador → colaborador, com as permissões que já tinha (nem mais, nem menos)", r.kind === "colaborador" && r.permissions.length === 2 && r.account_id === "dono1");
r = await membershipDoUsuario(clienteFalso({ donoNoBanco: false, teamRow: { kind: "mentor", owner_id: "dono1" }, pessoasComoAvaliado: 0, pessoasSobGestao: 0 }).cliente, "u");
confere("mentor convidado → mentor", r.kind === "mentor");

console.log(falhas === 0 ? "\nTUDO CERTO" : `\n${falhas} FALHA(S)`);
process.exit(falhas === 0 ? 0 : 1);
