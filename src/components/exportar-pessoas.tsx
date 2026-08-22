/**
 * Exportar o cadastro das pessoas, em XLSX ou PDF.
 *
 * SÓ CADASTRO, por decisão do Matheus: nada de resultado de teste. É o que faz
 * este arquivo ser dado comum de RH em vez de perfil comportamental solto.
 *
 * O PDF sai pela impressão do navegador ("Salvar como PDF") em vez de uma
 * biblioteca. Duas razões: não engorda a plataforma com mais um pacote, e o
 * resultado sai com a fonte e o acento certos — gerador de PDF em JavaScript
 * costuma tropeçar em "ç" e "ã", que é metade dos nomes daqui.
 */
import { mensagemDeErro } from "@/lib/erro-legivel";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { dadosParaExportar } from "@/lib/exportar.functions";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { toast } from "sonner";

type Pessoa = { id: string; full_name: string };

function baixar(nome: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = nome;
  a.click();
  URL.revokeObjectURL(url);
}

export function ExportarPessoas({ pessoas }: { pessoas: Pessoa[] }) {
  const fn = useServerFn(dadosParaExportar);
  const [aberto, setAberto] = useState(false);
  const [selecionadas, setSelecionadas] = useState<string[]>([]);
  const [formato, setFormato] = useState<"xlsx" | "pdf">("xlsx");

  const todas = selecionadas.length === 0;

  const exportar = useMutation({
    mutationFn: async () => {
      const r = await fn({ data: { ids: todas ? undefined : selecionadas, formato } });
      if (r.linhas.length === 0) throw new Error("Nenhuma pessoa para exportar.");

      if (formato === "xlsx") {
        // Carregado só no clique: a biblioteca é pesada e a maioria das visitas
        // a Pessoas nunca exporta nada.
        const XLSX = await import("xlsx");
        const aba = XLSX.utils.json_to_sheet(r.linhas);
        const livro = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(livro, aba, "Pessoas");
        const buf = XLSX.write(livro, { bookType: "xlsx", type: "array" });
        baixar("pessoas.xlsx", new Blob([buf], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }));
      } else {
        const cols = Object.keys(r.linhas[0]);
        const html = `<!doctype html><meta charset="utf-8"><title>Pessoas</title>
<style>
 body{font:12px system-ui;padding:24px;color:#111}
 h1{font-size:18px;margin:0 0 4px}
 p.rodape{color:#666;font-size:11px;margin:0 0 16px}
 table{border-collapse:collapse;width:100%}
 th,td{border:1px solid #ddd;padding:6px 8px;text-align:left}
 th{background:#f4f4f5}
 @media print{@page{size:landscape;margin:12mm}}
</style>
<h1>Pessoas</h1>
<p class="rodape">${r.rodape}</p>
<table><thead><tr>${cols.map((c) => `<th>${c}</th>`).join("")}</tr></thead><tbody>
${r.linhas.map((l) => `<tr>${cols.map((c) => `<td>${String((l as Record<string, unknown>)[c] ?? "")}</td>`).join("")}</tr>`).join("")}
</tbody></table>`;
        const w = window.open("", "_blank");
        if (!w) throw new Error("O navegador bloqueou a janela. Libere os pop-ups e tente de novo.");
        w.document.write(html);
        w.document.close();
        w.focus();
        w.print();
      }
      return r.linhas.length;
    },
    onSuccess: (n) => {
      toast.success(`${n} ${n === 1 ? "pessoa exportada" : "pessoas exportadas"}.`);
      setAberto(false);
    },
    onError: (e: Error) => toast.error(mensagemDeErro(e)),
  });

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Download className="size-4" /> Exportar dados
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Exportar dados</DialogTitle>
          <DialogDescription>
            Sai o cadastro — nome, contato, cargo e grupos. Resultados de teste não vão no arquivo.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          <Button
            variant={formato === "xlsx" ? "default" : "outline"} size="sm"
            onClick={() => setFormato("xlsx")}
          >
            <FileSpreadsheet className="size-4" /> Excel
          </Button>
          <Button
            variant={formato === "pdf" ? "default" : "outline"} size="sm"
            onClick={() => setFormato("pdf")}
          >
            <FileText className="size-4" /> PDF
          </Button>
        </div>

        <div className="rounded-lg border border-black/5">
          <label className="flex cursor-pointer items-center gap-2.5 border-b border-black/5 p-3 text-sm font-medium">
            <Checkbox
              checked={todas}
              onCheckedChange={() => setSelecionadas([])}
            />
            Todas ({pessoas.length})
          </label>
          <ul className="max-h-56 space-y-1 overflow-y-auto p-2">
            {pessoas.map((p) => (
              <li key={p.id}>
                <label className="flex cursor-pointer items-center gap-2.5 rounded px-1.5 py-1 text-sm hover:bg-muted">
                  <Checkbox
                    checked={selecionadas.includes(p.id)}
                    onCheckedChange={() =>
                      setSelecionadas((v) =>
                        v.includes(p.id) ? v.filter((x) => x !== p.id) : [...v, p.id],
                      )
                    }
                  />
                  {p.full_name}
                </label>
              </li>
            ))}
          </ul>
        </div>

        <DialogFooter className="items-center gap-3">
          <span className="mr-auto text-xs text-muted-foreground">
            {todas ? "Todas as pessoas" : `${selecionadas.length} selecionada${selecionadas.length === 1 ? "" : "s"}`}
          </span>
          <Button onClick={() => exportar.mutate()} disabled={exportar.isPending}>
            {exportar.isPending ? "Preparando…" : "Exportar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
