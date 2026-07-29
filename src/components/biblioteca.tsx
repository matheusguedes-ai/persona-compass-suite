/**
 * A biblioteca da Academy.
 *
 * O mesmo componente serve o dono e o aluno: `podeEditar` decide se aparecem
 * os botões de adicionar e remover. Quem barra de verdade é a RLS — se um dia
 * a prop vier errada, o banco recusa a escrita do mesmo jeito.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listarBiblioteca, salvarMaterial, excluirMaterial, TIPOS,
} from "@/lib/biblioteca.functions";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  FileText, FileSpreadsheet, Video, Music, Link as LinkIcon, Paperclip, Plus, Trash2, Search,
  Upload, Image as ImageIcon, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const ICONE = {
  pdf: FileText, planilha: FileSpreadsheet, video: Video,
  audio: Music, link: LinkIcon, outro: Paperclip,
} as const;

export function Biblioteca({ podeEditar = false }: { podeEditar?: boolean }) {
  const qc = useQueryClient();
  const listaFn = useServerFn(listarBiblioteca);
  const salvarFn = useServerFn(salvarMaterial);
  const excluirFn = useServerFn(excluirMaterial);

  const [busca, setBusca] = useState("");
  const [categoria, setCategoria] = useState<string | null>(null);
  const [aberto, setAberto] = useState(false);
  const [form, setForm] = useState({
    titulo: "", descricao: "", url: "", kind: "link", categoria: "", capa_url: "",
  });
  // "link" ou "arquivo". Era o que faltava: escolher o tipo "pdf" não adiantava
  // nada, porque o formulário só aceitava colar URL.
  const [origem, setOrigem] = useState<"link" | "arquivo">("link");
  const [enviando, setEnviando] = useState<null | "arquivo" | "capa">(null);

  async function enviar(f: File, alvo: "arquivo" | "capa") {
    const limite = alvo === "capa" ? 3 : 25;
    if (f.size > limite * 1024 * 1024) {
      return toast.error(`Arquivo muito grande (máximo ${limite} MB).`);
    }
    setEnviando(alvo);
    try {
      const { data: sessao } = await supabase.auth.getUser();
      const ext = f.name.split(".").pop() ?? "bin";
      const caminho = `${sessao.user?.id}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("biblioteca").upload(caminho, f);
      if (error) throw new Error(error.message);
      const { data: pub } = supabase.storage.from("biblioteca").getPublicUrl(caminho);
      if (alvo === "capa") {
        setForm((v) => ({ ...v, capa_url: pub.publicUrl }));
      } else {
        // O título vem do nome do arquivo quando ainda está vazio: poupa
        // digitação e evita material sem nome.
        setForm((v) => ({
          ...v,
          url: pub.publicUrl,
          titulo: v.titulo || f.name.replace(/\.[^.]+$/, ""),
        }));
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setEnviando(null);
    }
  }

  const { data, isLoading } = useQuery({ queryKey: ["biblioteca"], queryFn: () => listaFn() });

  const salvar = useMutation({
    mutationFn: () =>
      salvarFn({
        data: {
          titulo: form.titulo,
          descricao: form.descricao || undefined,
          url: form.url,
          kind: form.kind as (typeof TIPOS)[number],
          categoria: form.categoria || undefined,
          capa_url: form.capa_url || null,
        },
      }),
    onSuccess: () => {
      toast.success("Material adicionado.");
      qc.invalidateQueries({ queryKey: ["biblioteca"] });
      setAberto(false);
      setForm({ titulo: "", descricao: "", url: "", kind: "link", categoria: "", capa_url: "" });
      setOrigem("link");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const excluir = useMutation({
    mutationFn: (id: string) => excluirFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Material removido.");
      qc.invalidateQueries({ queryKey: ["biblioteca"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const todos = data?.materiais ?? [];
  const termo = busca.trim().toLowerCase();
  const lista = todos.filter(
    (m) =>
      (!categoria || m.categoria === categoria) &&
      (!termo ||
        m.titulo.toLowerCase().includes(termo) ||
        (m.descricao ?? "").toLowerCase().includes(termo)),
  );

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h2 className="text-lg font-semibold">Biblioteca</h2>
          <p className="text-sm text-muted-foreground">
            Material que fica disponível independente das aulas.
          </p>
        </div>
        {podeEditar && (
          <Dialog open={aberto} onOpenChange={setAberto}>
            <DialogTrigger asChild>
              <Button size="sm" className="ml-auto">
                <Plus className="size-4" /> Adicionar material
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Novo material</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="b-tit">Título</Label>
                  <Input id="b-tit" value={form.titulo}
                    onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
                </div>
                <div>
                  <Label>Conteúdo</Label>
                  <div className="mt-1 inline-flex rounded-lg bg-muted p-1">
                    {(["link", "arquivo"] as const).map((o) => (
                      <button
                        key={o} type="button" onClick={() => setOrigem(o)}
                        className={cn(
                          "rounded-md px-3 py-1 text-xs font-medium",
                          origem === o ? "bg-background shadow-sm" : "text-muted-foreground",
                        )}
                      >
                        {o === "link" ? "Colar link" : "Enviar arquivo"}
                      </button>
                    ))}
                  </div>

                  {origem === "link" ? (
                    <Input className="mt-2" value={form.url} placeholder="https://…"
                      onChange={(e) => setForm({ ...form, url: e.target.value })} />
                  ) : form.url ? (
                    <div className="mt-2 flex items-center gap-2 rounded-lg bg-muted/60 p-2.5 text-sm">
                      <Paperclip className="size-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate">Arquivo enviado</span>
                      <button type="button" onClick={() => setForm({ ...form, url: "" })}
                        title="Remover">
                        <X className="size-3.5 text-muted-foreground" />
                      </button>
                    </div>
                  ) : (
                    <label className="mt-2 flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-black/15 px-3 py-3 text-sm text-muted-foreground hover:bg-muted/50">
                      <Upload className="size-4" />
                      {enviando === "arquivo" ? "Enviando…" : "Escolher arquivo (até 25 MB)"}
                      <input type="file" className="hidden"
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) enviar(f, "arquivo"); }} />
                    </label>
                  )}
                </div>

                <div>
                  <Label>Capa (opcional)</Label>
                  {form.capa_url ? (
                    <div className="relative mt-1 overflow-hidden rounded-lg">
                      <img src={form.capa_url} alt="" className="h-24 w-full object-cover" />
                      <button type="button" onClick={() => setForm({ ...form, capa_url: "" })}
                        className="absolute right-2 top-2 rounded-full bg-black/60 p-1 text-white"
                        title="Remover capa">
                        <X className="size-3.5" />
                      </button>
                    </div>
                  ) : (
                    <label className="mt-1 flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-black/15 px-3 py-3 text-sm text-muted-foreground hover:bg-muted/50">
                      <ImageIcon className="size-4" />
                      {enviando === "capa" ? "Enviando…" : "JPG ou PNG (até 3 MB)"}
                      <input type="file" accept="image/jpeg,image/png" className="hidden"
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) enviar(f, "capa"); }} />
                    </label>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="b-tipo">Tipo</Label>
                    <select
                      id="b-tipo" value={form.kind}
                      onChange={(e) => setForm({ ...form, kind: e.target.value })}
                      className="mt-1 h-9 w-full rounded-md border border-black/10 bg-background px-2 text-sm"
                    >
                      {TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="b-cat">Categoria (opcional)</Label>
                    <Input id="b-cat" value={form.categoria} placeholder="Liderança, Vendas…"
                      onChange={(e) => setForm({ ...form, categoria: e.target.value })} />
                  </div>
                </div>
                <div>
                  <Label htmlFor="b-desc">Descrição (opcional)</Label>
                  <Textarea id="b-desc" rows={2} value={form.descricao}
                    onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => salvar.mutate()}
                  disabled={!form.titulo.trim() || !form.url.trim() || salvar.isPending || !!enviando}>
                  {salvar.isPending ? "Salvando…" : "Adicionar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {todos.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input value={busca} onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar material" className="pl-8" />
          </div>
          {(data?.categorias ?? []).map((c) => (
            <button
              key={c}
              onClick={() => setCategoria(categoria === c ? null : c)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                categoria === c ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground",
              )}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}

      {!isLoading && todos.length === 0 && (
        <div className="rounded-xl border border-dashed border-black/10 p-10 text-center">
          <Paperclip className="mx-auto size-7 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            {podeEditar
              ? "Nada aqui ainda. Adicione um material e ele fica disponível para todo mundo."
              : "Seu mentor ainda não publicou material aqui."}
          </p>
        </div>
      )}

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {lista.map((m) => {
          const Icone = ICONE[m.kind as keyof typeof ICONE] ?? Paperclip;
          return (
            <li key={m.id} className="group relative rounded-xl bg-card p-4 ring-1 ring-black/5">
              <a href={m.url} target="_blank" rel="noopener noreferrer" className="block">
                {m.capa_url && (
                  <img src={m.capa_url} alt=""
                    className="mb-3 -mt-1 h-28 w-full rounded-lg object-cover" />
                )}
                <Icone className="size-5 text-muted-foreground" />
                <p className="mt-2 text-sm font-medium leading-snug">{m.titulo}</p>
                {m.descricao && (
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{m.descricao}</p>
                )}
                {m.categoria && (
                  <span className="mt-2 inline-block rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                    {m.categoria}
                  </span>
                )}
              </a>
              {podeEditar && (
                <button
                  onClick={() => excluir.mutate(m.id)}
                  className="absolute right-2 top-2 rounded p-1 text-muted-foreground opacity-0 transition hover:text-destructive group-hover:opacity-100"
                  title="Remover"
                >
                  <Trash2 className="size-3.5" />
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {!isLoading && todos.length > 0 && lista.length === 0 && (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Nada encontrado com esse filtro.
        </p>
      )}
    </section>
  );
}
