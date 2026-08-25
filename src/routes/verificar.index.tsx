/**
 * #221 F3 — porta de entrada da verificação pública de certificado.
 *
 * Rota de RAIZ, sem login, fora de `_app`/`aluno` — igual à
 * `certificado.$certificadoId.tsx` (ver o comentário grande lá). Só um
 * formulário: digitou o código, navega para `/verificar/$codigo`, que é
 * quem de fato consulta. Nenhuma chamada ao servidor acontece aqui — não há
 * nada para consultar antes de ter um código.
 *
 * Vive em `verificar.index.tsx`, não em `verificar.tsx`: no roteamento por
 * arquivo desta base, `verificar.tsx` + `verificar.$codigo.tsx` viraria
 * pai/filho automaticamente (mesmo padrão de `_app.pessoas.tsx` +
 * `_app.pessoas.index.tsx`), e o pai precisaria renderizar `<Outlet />` para
 * o filho aparecer. `verificar.tsx` é esse pai — só o `<Outlet />`, sem
 * conteúdo próprio (ver o arquivo).
 */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/verificar/")({
  head: () => ({
    meta: [
      { title: "Verificar certificado — Métrica Humana" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: VerificarPage,
});

function VerificarPage() {
  const navigate = useNavigate();
  const [codigo, setCodigo] = useState("");

  function verificar(e: React.FormEvent) {
    e.preventDefault();
    const valor = codigo.trim();
    if (!valor) return;
    navigate({ to: "/verificar/$codigo", params: { codigo: valor } });
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-6 px-6 py-16 text-center">
      <ShieldCheck className="size-10 text-primary" />
      <div className="space-y-1.5">
        <h1 className="text-xl font-semibold tracking-tight">Verificar certificado</h1>
        <p className="text-sm text-muted-foreground">
          Digite o código impresso no certificado para confirmar se ele é autêntico.
        </p>
      </div>
      <form onSubmit={verificar} className="flex w-full flex-col gap-3">
        <Input
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
          placeholder="Código do certificado"
          className="text-center font-mono text-sm"
          autoFocus
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
        />
        <Button type="submit" disabled={!codigo.trim()}>
          Verificar
        </Button>
      </form>
    </div>
  );
}
