/**
 * Oferta de conta no fim do teste.
 *
 * O momento é escolhido: a pessoa acabou de investir 15 minutos e quer ver o
 * resultado. Pedir cadastro ANTES do teste derruba a taxa de resposta; pedir
 * depois, quando ela já quer algo, é quando o cadastro faz sentido para ela.
 *
 * A senha não é escolhida aqui, de propósito — ver o cabeçalho de
 * `concluirCadastroPeloLink`. O link do teste é descartável; a conta não é.
 */
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { dadosParaCadastro, concluirCadastroPeloLink } from "@/lib/acesso-aluno.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MailCheck, UserPlus } from "lucide-react";

export function CriarContaNoFim({ responseId }: { responseId: string }) {
  const dadosFn = useServerFn(dadosParaCadastro);
  const concluirFn = useServerFn(concluirCadastroPeloLink);
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [enviado, setEnviado] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ["dados-cadastro", responseId],
    queryFn: async () => {
      const d = await dadosFn({ data: { response_id: responseId } });
      if (d.encontrado) { setNome(d.nome); setTelefone(d.telefone); }
      return d;
    },
  });

  const enviar = useMutation({
    mutationFn: () => concluirFn({ data: { response_id: responseId, nome, telefone } }),
    onSuccess: (r) => setEnviado(r.mensagem),
    onError: (e: Error) => setEnviado(e.message),
  });

  // Sem cadastro ligado, ou já tem conta: não há o que oferecer.
  if (!data?.encontrado || data.ja_tem_conta) return null;

  if (enviado) {
    return (
      <div className="rounded-xl bg-card p-6 ring-1 ring-black/5">
        <MailCheck className="mx-auto size-8 text-emerald-500" />
        <p className="mt-3 text-center text-sm">{enviado}</p>
      </div>
    );
  }

  if (!aberto) {
    return (
      <div className="rounded-xl bg-card p-6 text-center ring-1 ring-black/5">
        <UserPlus className="mx-auto size-7 text-muted-foreground" />
        <h2 className="mt-3 text-base font-medium">Quer guardar seus resultados?</h2>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
          Criando sua conta, você acompanha este e os próximos testes num painel só, com os
          gráficos e o que ficar combinado nas devolutivas.
        </p>
        <Button className="mt-4" onClick={() => setAberto(true)}>Criar minha conta</Button>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-card p-6 ring-1 ring-black/5">
      <h2 className="text-base font-medium">Confirme seus dados</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Vamos enviar um link para <strong>{data.email_mascarado}</strong>. É nele que você escolhe
        sua senha.
      </p>
      <div className="mt-4 space-y-3">
        <div>
          <label className="text-sm font-medium">Nome completo</label>
          <Input value={nome} onChange={(e) => setNome(e.target.value)} className="mt-1.5" />
        </div>
        <div>
          <label className="text-sm font-medium">Telefone</label>
          <Input
            value={telefone} onChange={(e) => setTelefone(e.target.value)}
            className="mt-1.5" placeholder="(11) 99999-0000"
          />
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button onClick={() => enviar.mutate()} disabled={enviar.isPending || nome.trim().length < 2}>
          {enviar.isPending ? "Enviando…" : "Enviar link de acesso"}
        </Button>
        <Button variant="ghost" onClick={() => setAberto(false)}>Agora não</Button>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        O e-mail é o que seu mentor cadastrou e não muda por aqui. Se estiver errado, fale com ele.
      </p>
    </div>
  );
}
