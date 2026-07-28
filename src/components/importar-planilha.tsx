/**
 * Importar pessoas de uma planilha para um grupo.
 *
 * O fluxo mostra a prévia antes de gravar de propósito: importação em massa é
 * exatamente o tipo de ação em que o estrago passa despercebido. O mentor vê o
 * que entendemos de cada linha, e o que vai ficar de fora, antes de confirmar.
 */
import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { importPeople } from "@/lib/data.functions";
import { lerPlanilhaDePessoas, csvModelo, type LinhaPlanilha } from "@/lib/planilha";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { AlertCircle, Download, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

export function ImportarPlanilha({
  groupId,
  onPronto,
}: {
  /** Ausente quando a importação vem do menu Pessoas: aí ninguém entra em grupo. */
  groupId?: string | null;
  onPronto?: () => void;
}) {
  const qc = useQueryClient();
  const [aberto, setAberto] = useState(false);
  const [lendo, setLendo] = useState(false);
  const [linhas, setLinhas] = useState<LinhaPlanilha[] | null>(null);
  const [erroArquivo, setErroArquivo] = useState<string | null>(null);
  const [nomeArquivo, setNomeArquivo] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const importFn = useServerFn(importPeople);

  const validas = (linhas ?? []).filter((l) => !l.erro);
  const invalidas = (linhas ?? []).filter((l) => l.erro);

  const importar = useMutation({
    mutationFn: () =>
      importFn({
        data: {
          group_id: groupId ?? null,
          pessoas: validas.map((l) => ({
            full_name: l.full_name,
            email: l.email,
            phone: l.phone || null,
            profession: l.profession || null,
            role_at_company: l.role_at_company || null,
          })),
        },
      }),
    onSuccess: (r) => {
      const res = r as {
        criados: number; reaproveitados: number;
        adicionados_ao_grupo: number; ja_estavam_no_grupo: number; com_grupo: boolean;
      };
      if (groupId) qc.invalidateQueries({ queryKey: ["group", groupId] });
      qc.invalidateQueries({ queryKey: ["people"] });
      const partes = res.com_grupo
        ? [
            `${res.adicionados_ao_grupo} adicionada(s) ao grupo`,
            res.criados > 0 ? `${res.criados} cadastro(s) novo(s)` : "",
            res.reaproveitados > 0 ? `${res.reaproveitados} já existia(m)` : "",
            res.ja_estavam_no_grupo > 0 ? `${res.ja_estavam_no_grupo} já estava(m) no grupo` : "",
          ]
        : [
            `${res.criados} pessoa(s) cadastrada(s)`,
            res.reaproveitados > 0 ? `${res.reaproveitados} já existia(m) e não foi duplicada(s)` : "",
          ];
      toast.success(partes.filter(Boolean).join(" · "));
      fechar();
      onPronto?.();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function fechar() {
    setAberto(false);
    setLinhas(null);
    setErroArquivo(null);
    setNomeArquivo("");
    if (fileRef.current) fileRef.current.value = "";
  }

  async function escolher(file: File) {
    setLendo(true);
    setErroArquivo(null);
    setLinhas(null);
    setNomeArquivo(file.name);
    try {
      const { linhas } = await lerPlanilhaDePessoas(file);
      setLinhas(linhas);
    } catch (e) {
      setErroArquivo(e instanceof Error ? e.message : "Não consegui ler a planilha.");
    } finally {
      setLendo(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function baixarModelo() {
    // BOM (\uFEFF): sem ele o Excel abre os acentos errados.
    const blob = new Blob(["\uFEFF" + csvModelo()], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "modelo-importacao-pessoas.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <Dialog open={aberto} onOpenChange={(v) => (v ? setAberto(true) : fechar())}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <FileSpreadsheet className="size-4" /> Importar planilha
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{groupId ? "Importar pessoas para o grupo" : "Importar pessoas"}</DialogTitle>
          <DialogDescription>
            Envie um Excel (.xlsx) ou CSV com uma linha por pessoa. Precisa ter uma coluna de{" "}
            <strong>Nome</strong> e outra de <strong>Email</strong>; telefone, profissão e cargo são opcionais.
            {!groupId && " As pessoas entram no seu cadastro; você pode agrupá-las depois."}
          </DialogDescription>
        </DialogHeader>

        <input
          ref={fileRef} type="file" accept=".xlsx,.csv,text/csv" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) escolher(f); }}
        />

        {!linhas && (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={lendo}
              className="flex w-full flex-col items-center gap-2 rounded-xl border border-dashed border-black/15 p-10 text-center transition hover:bg-muted/40"
            >
              {lendo ? <Loader2 className="size-8 animate-spin text-muted-foreground" /> : <Upload className="size-8 text-muted-foreground" />}
              <span className="text-sm font-medium">{lendo ? "Lendo a planilha…" : "Escolher arquivo"}</span>
              <span className="text-xs text-muted-foreground">.xlsx ou .csv</span>
            </button>

            {erroArquivo && (
              <div className="flex gap-3 rounded-lg bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200">
                <AlertCircle className="mt-0.5 size-5 shrink-0" />
                <p>{erroArquivo}</p>
              </div>
            )}

            <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">
                Não tem uma planilha pronta? Baixe o modelo, preencha e envie de volta.
              </p>
              <Button type="button" variant="ghost" size="sm" onClick={baixarModelo}>
                <Download className="size-3" /> Modelo
              </Button>
            </div>
          </div>
        )}

        {linhas && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm">
                <span className="font-medium">{nomeArquivo}</span> ·{" "}
                <span className="text-emerald-700">{validas.length} pronta(s) para importar</span>
                {invalidas.length > 0 && (
                  <span className="text-amber-700"> · {invalidas.length} com problema</span>
                )}
              </p>
              <Button variant="ghost" size="sm" onClick={() => { setLinhas(null); setNomeArquivo(""); }}>
                Trocar arquivo
              </Button>
            </div>

            {invalidas.length > 0 && (
              <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900 ring-1 ring-amber-200">
                As linhas com problema <strong>não serão importadas</strong> — o resto entra normalmente.
                Corrija na planilha e importe de novo se precisar; quem já entrou não é duplicado.
              </div>
            )}

            <div className="max-h-72 overflow-y-auto rounded-lg ring-1 ring-black/5">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-muted/80 backdrop-blur">
                  <tr>
                    <th className="px-3 py-2 font-medium text-muted-foreground">Linha</th>
                    <th className="px-3 py-2 font-medium text-muted-foreground">Nome</th>
                    <th className="px-3 py-2 font-medium text-muted-foreground">Email</th>
                    <th className="px-3 py-2 font-medium text-muted-foreground">Cargo</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5">
                  {linhas.map((l) => (
                    <tr key={l.linha} className={l.erro ? "bg-amber-50/60" : ""}>
                      <td className="px-3 py-2 tabular-nums text-muted-foreground">{l.linha}</td>
                      <td className="px-3 py-2">{l.full_name || <span className="text-muted-foreground">—</span>}</td>
                      <td className="px-3 py-2 text-muted-foreground">{l.email || "—"}</td>
                      <td className="px-3 py-2 text-muted-foreground">{l.role_at_company || "—"}</td>
                      <td className="px-3 py-2 text-right">
                        {l.erro && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] text-amber-800">{l.erro}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={fechar}>Cancelar</Button>
          <Button
            onClick={() => importar.mutate()}
            disabled={!linhas || validas.length === 0 || importar.isPending}
          >
            {importar.isPending
              ? "Importando…"
              : validas.length > 0
                ? `Importar ${validas.length} pessoa${validas.length === 1 ? "" : "s"}`
                : "Importar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
