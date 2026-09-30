/** Ficha da pessoa (lado do mentor): só o STATUS do WhatsApp, só leitura (#291 F1b). Quem decide é o aluno. */
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ROTULO_NIVEL } from "@/lib/canal/consentimento";
import { getWhatsappDaPessoa } from "@/lib/whatsapp-consentimento.functions";

const dia = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

export function StatusWhatsapp({ personId }: { personId: string }) {
  const fn = useServerFn(getWhatsappDaPessoa);
  const { data } = useQuery({ queryKey: ["whatsapp-da-pessoa", personId], queryFn: () => fn({ data: { person_id: personId } }) });
  if (!data) return null;
  const texto =
    data.status === "autorizado" ? `autorizado (${ROTULO_NIVEL[data.nivel].titulo}) desde ${dia(data.desde)}`
    : data.status === "numero_mudou" ? `autorizado (${ROTULO_NIVEL[data.nivel].titulo}), mas o telefone mudou depois do aceite — o aluno precisa confirmar de novo`
    : data.status === "desligado" ? `desligado em ${dia(data.em)}`
    : "não autorizado";
  return (
    <div className="rounded-xl bg-card p-4 text-sm ring-1 ring-black/5 dark:ring-white/10">
      <span className="text-muted-foreground">WhatsApp: </span>
      <span className="font-medium">{texto}</span>
    </div>
  );
}
