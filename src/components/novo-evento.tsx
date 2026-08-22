/**
 * Criar um evento e escolher quem vê.
 *
 * Só o master abre isto. O mentor não publica evento para os grupos dele —
 * quem publica novidade na conta é o master, por decisão do Matheus.
 *
 * A data e a hora são montadas AQUI, no navegador, e enviadas em ISO com fuso.
 * Um `datetime-local` devolve "2026-07-30T14:00" sem fuso nenhum; mandar essa
 * string crua faria o servidor (UTC) ler 14:00 como horário de Londres e o
 * evento apareceria às 11h no Brasil.
 */
import { mensagemDeErro } from "@/lib/erro-legivel";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { criarEvento } from "@/lib/gestao.functions";
import { meusGrupos } from "@/lib/comunidade.functions";
import { listarPessoasParaEscolher } from "@/lib/data.functions";
import { assinarMeuEnvio } from "@/lib/preview-upload.functions";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ImagePlus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { erroDeUpload } from "@/lib/erro-de-upload";

/**
 * O diálogo é controlado de fora: desde a #251, o gatilho é um item dentro
 * do menu "Criar" da Agenda, não mais um botão próprio aqui.
 */
export function NovoEvento({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient();
  const criar = useServerFn(criarEvento);
  const gruposFn = useServerFn(meusGrupos);
  const pessoasFn = useServerFn(listarPessoasParaEscolher);
  const previaFn = useServerFn(assinarMeuEnvio);

  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [quando, setQuando] = useState("");
  const [terminaEm, setTerminaEm] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [imagemUrl, setImagemUrl] = useState<string | null>(null);
  // O bucket 'eventos' é privado: imagemUrl guarda o IDENTIFICADOR (o que
  // salva). Isto guarda a versão ASSINADA do upload desta sessão, só para o
  // <img> ter o que mostrar antes de salvar.
  const [imagemPreview, setImagemPreview] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviarImagem(f: File) {
    // O limite existe para o celular: banner de 8 MB trava a agenda de quem
    // abre no 4G, e ninguém liga a lentidão à imagem que subiu semana passada.
    if (f.size > 3 * 1024 * 1024) return toast.error("Imagem muito grande (máximo 3 MB).");
    setEnviando(true);
    try {
      const { data: sessao } = await supabase.auth.getUser();
      const ext = f.name.split(".").pop() ?? "jpg";
      const caminho = `${sessao.user?.id}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("eventos").upload(caminho, f);
      if (error) throw new Error(erroDeUpload(error, "eventos"));
      const { data: pub } = supabase.storage.from("eventos").getPublicUrl(caminho);
      // Pede ao servidor a versão assinada deste MESMO arquivo que acabei de
      // enviar, só para o preview — o bucket privado não deixa o navegador
      // assinar sozinho. Se falhar, ainda salva certo; só o preview imediato
      // fica sem imagem até recarregar.
      try {
        setImagemPreview((await previaFn({ data: { url: pub.publicUrl } })).url);
      } catch { /* sem preview agora — não impede salvar */ }
      setImagemUrl(pub.publicUrl);
    } catch (e) {
      toast.error(mensagemDeErro(e));
    } finally {
      setEnviando(false);
    }
  }
  const [grupos, setGrupos] = useState<string[]>([]);
  const [pessoas, setPessoas] = useState<string[]>([]);

  const { data: dg } = useQuery({ queryKey: ["grupos"], queryFn: () => gruposFn(), enabled: open });
  const { data: dp } = useQuery({
    queryKey: ["pessoas-evento"], queryFn: () => pessoasFn(), enabled: open,
  });

  const alternar = (lista: string[], set: (v: string[]) => void, id: string) =>
    set(lista.includes(id) ? lista.filter((x) => x !== id) : [...lista, id]);

  const salvar = useMutation({
    mutationFn: () =>
      criar({
        data: {
          titulo,
          descricao: descricao || undefined,
          // `new Date("2026-07-30T14:00")` é interpretado como horário LOCAL —
          // é o que queremos. `toISOString()` converte para UTC com o fuso
          // correto embutido.
          quando: new Date(quando).toISOString(),
          termina_em: terminaEm ? new Date(terminaEm).toISOString() : null,
          imagem_url: imagemUrl,
          link_url: linkUrl.trim() || null,
          group_ids: grupos,
          person_ids: pessoas,
        },
      }),
    onSuccess: () => {
      toast.success("Evento criado.");
      qc.invalidateQueries({ queryKey: ["agenda"] });
      onOpenChange(false);
      setTitulo(""); setDescricao(""); setQuando(""); setTerminaEm("");
      setLinkUrl(""); setImagemUrl(null); setImagemPreview(null); setGrupos([]); setPessoas([]);
    },
    onError: (e: Error) => toast.error(mensagemDeErro(e)),
  });

  const semDestino = grupos.length + pessoas.length === 0;
  // O banco também barra, mas avisar aqui evita o erro feio depois de preencher
  // o formulário inteiro.
  const fimInvalido = !!terminaEm && !!quando && new Date(terminaEm) <= new Date(quando);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo evento na agenda</DialogTitle>
          <DialogDescription>
            Escolha quem vê. O evento aparece na agenda de quem você marcar, e essas pessoas
            recebem uma notificação.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label htmlFor="ev-titulo">Título</Label>
            <Input
              id="ev-titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)}
              placeholder="Encontro do grupo, prazo, live…"
            />
          </div>
          <div>
            <Label htmlFor="ev-quando">Quando</Label>
            <Input
              id="ev-quando" type="datetime-local" value={quando}
              onChange={(e) => setQuando(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="ev-fim">Termina em (opcional)</Label>
            <Input
              id="ev-fim" type="datetime-local" value={terminaEm}
              onChange={(e) => setTerminaEm(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="ev-link">Link externo (opcional)</Label>
            <Input
              id="ev-link" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://…"
            />
          </div>
          <div>
            <Label>Imagem (opcional)</Label>
            {imagemUrl ? (
              <div className="relative mt-1 overflow-hidden rounded-lg">
                <img src={imagemPreview ?? imagemUrl} alt="" className="h-28 w-full object-cover" />
                <button
                  onClick={() => { setImagemUrl(null); setImagemPreview(null); }}
                  className="absolute right-2 top-2 rounded-full bg-black/60 p-1 text-white"
                  title="Remover imagem"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ) : (
              <label className="mt-1 flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-black/15 px-3 py-3 text-sm text-muted-foreground hover:bg-muted/50">
                <ImagePlus className="size-4" />
                {enviando ? "Enviando…" : "Escolher JPG ou PNG (até 3 MB)"}
                <input
                  type="file" accept="image/jpeg,image/png" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) enviarImagem(f); }}
                />
              </label>
            )}
          </div>
          <div>
            <Label htmlFor="ev-desc">Descrição (opcional)</Label>
            <Textarea
              id="ev-desc" rows={2} value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
            />
          </div>

          <div className="max-h-56 space-y-3 overflow-y-auto rounded-lg border border-black/5 p-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Grupos</p>
              {(dg?.grupos ?? []).length === 0 ? (
                <p className="mt-1 text-xs text-muted-foreground">Nenhum grupo.</p>
              ) : (
                <ul className="mt-1.5 space-y-1.5">
                  {(dg?.grupos ?? []).map((g) => (
                    <li key={g.id}>
                      <label className="flex cursor-pointer items-center gap-2 text-sm">
                        <Checkbox
                          checked={grupos.includes(g.id)}
                          onCheckedChange={() => alternar(grupos, setGrupos, g.id)}
                        />
                        {g.name}
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Pessoas</p>
              <ul className="mt-1.5 space-y-1.5">
                {(dp?.pessoas ?? []).map((p) => (
                  <li key={p.id}>
                    <label className="flex cursor-pointer items-center gap-2 text-sm">
                      <Checkbox
                        checked={pessoas.includes(p.id)}
                        onCheckedChange={() => alternar(pessoas, setPessoas, p.id)}
                      />
                      {p.full_name}
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <DialogFooter className="items-center gap-3">
          {(semDestino || fimInvalido) && (
            <span className="mr-auto text-xs text-muted-foreground">
              {fimInvalido ? "O fim precisa ser depois do início." : "Escolha ao menos um grupo ou pessoa."}
            </span>
          )}
          <Button
            onClick={() => salvar.mutate()}
            disabled={!titulo.trim() || !quando || semDestino || salvar.isPending || fimInvalido || enviando}
          >
            {salvar.isPending ? "Criando…" : "Criar evento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
