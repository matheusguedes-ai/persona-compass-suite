/**
 * #317 — o nível da assistente em uso numa tela (a do aluno e a do mentor), junto do seletor
 * (`components/seletor-de-nivel.tsx`). Trocar vale a partir da próxima pergunta — inclusive no meio de
 * uma conversa — e fica lembrado para a próxima vez (`escolherNivelDaAssistente`). Quem decide o que
 * pode é o servidor, a cada pergunta; a tela só acompanha o nível que respondeu.
 */
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { mensagemDeErro } from "@/lib/erro-legivel";
import { escolherNivelDaAssistente } from "@/lib/assistente-niveis.functions";
import { NIVEL, ehCategoria, type Categoria, type NiveisDaTela } from "@/lib/assistente/niveis";

export function useNivelDaAssistente(escopo: "aluno" | "mentor", inicial: NiveisDaTela) {
  const [nivel, setNivel] = useState<Categoria | null>(inicial.atual);
  const escolherFn = useServerFn(escolherNivelDaAssistente);
  const guardar = useMutation({
    mutationFn: (categoria: Categoria) => escolherFn({ data: { escopo, categoria } }),
    // Não guardar a escolha não impede de usar: a próxima pergunta já vai no nível da tela.
    onError: (e) =>
      toast.error(
        `A escolha vale agora, mas não ficou guardada para a próxima vez: ${mensagemDeErro(e)}`,
      ),
  });

  function escolher(categoria: Categoria) {
    setNivel(categoria);
    guardar.mutate(categoria);
  }

  /** Depois de cada resposta: se o servidor usou outro nível (o mentor tirou o escolhido), a tela acompanha. */
  function conferirResposta(respondeu: unknown) {
    if (!ehCategoria(respondeu) || respondeu === nivel) return;
    if (nivel) {
      toast.info(
        `O nível ${NIVEL[nivel].nome} não está mais liberado. Esta resposta veio da ${NIVEL[respondeu].nome}.`,
      );
    }
    setNivel(respondeu);
  }

  return { nivel, escolher, conferirResposta };
}
