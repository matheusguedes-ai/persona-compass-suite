/**
 * #221 F3 — resultado da verificação pública de certificado.
 *
 * Rota de RAIZ, sem login (mesmo motivo de `verificar.tsx` e de
 * `certificado.$certificadoId.tsx`). O código vem da URL — é o que permite
 * o QR do PDF (e um link direto) levarem já para o resultado, sem passar
 * pelo formulário (requisito 1).
 *
 * `verificarCertificado` devolve um de três estados (`valido` / `limite` /
 * `nao_encontrado`) — nunca lança erro para "não achei", de propósito: um
 * erro genérico do React Query mostraria a MESMA tela tanto para "código
 * errado" quanto para "aconteceu algo técnico", e a pessoa do RH não teria
 * como distinguir. Estados explícitos deixam cada caso com a mensagem certa.
 */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { verificarCertificado } from "@/lib/certificados.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BrandMark } from "@/lib/brand";
import { CheckCircle2, XCircle, Clock3, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/verificar/$codigo")({
  head: () => ({
    meta: [
      { title: "Verificar certificado — Métrica Humana" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: VerificarCodigoPage,
});

function VerificarCodigoPage() {
  const { codigo } = Route.useParams();
  const navigate = useNavigate();
  const fn = useServerFn(verificarCertificado);
  const { data, isLoading } = useQuery({
    queryKey: ["verificar-certificado", codigo],
    queryFn: () => fn({ data: { codigo } }),
  });

  const [outroCodigo, setOutroCodigo] = useState("");

  function verificarOutro(e: React.FormEvent) {
    e.preventDefault();
    const valor = outroCodigo.trim();
    if (!valor) return;
    setOutroCodigo("");
    navigate({ to: "/verificar/$codigo", params: { codigo: valor } });
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-8 px-6 py-16 text-center">
      <ShieldCheck className="size-8 text-primary" />

      {isLoading && <p className="text-sm text-muted-foreground">Verificando…</p>}

      {!isLoading && data?.estado === "valido" && (
        <div className="w-full rounded-2xl border bg-card p-8 shadow-sm">
          <CheckCircle2 className="mx-auto size-10 text-emerald-600" />
          <p className="mt-3 text-sm font-medium text-emerald-700">Certificado autêntico</p>
          <div className="mt-6 flex justify-center">
            <BrandMark brand={data.brand} size={28} />
          </div>
          <h1 className="mt-6 text-2xl font-semibold tracking-tight text-balance">
            {data.nome_pessoa}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground text-balance">
            concluiu <strong className="text-foreground">{data.nome_item}</strong>
          </p>
          <p className="mt-4 text-xs text-muted-foreground">
            Emitido em {new Date(data.emitido_em).toLocaleDateString("pt-BR")}
          </p>
        </div>
      )}

      {!isLoading && data?.estado === "nao_encontrado" && (
        <div className="w-full rounded-2xl border bg-card p-8 shadow-sm">
          <XCircle className="mx-auto size-10 text-destructive" />
          <p className="mt-3 text-sm font-medium">
            Não encontramos nenhum certificado com este código
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Confira se o código foi digitado certo, sem espaços a mais.
          </p>
        </div>
      )}

      {!isLoading && data?.estado === "limite" && (
        <div className="w-full rounded-2xl border bg-card p-8 shadow-sm">
          <Clock3 className="mx-auto size-10 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium">Muitas tentativas</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Espere alguns minutos e tente de novo.
          </p>
        </div>
      )}

      <form onSubmit={verificarOutro} className="flex w-full flex-col gap-2">
        <Input
          value={outroCodigo}
          onChange={(e) => setOutroCodigo(e.target.value)}
          placeholder="Código do certificado"
          className="text-center font-mono text-xs"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
        />
        <Button type="submit" variant="outline" size="sm" disabled={!outroCodigo.trim()}>
          Verificar outro código
        </Button>
      </form>
    </div>
  );
}
