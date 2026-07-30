/**
 * Foto de perfil: exibição e troca.
 *
 * O arquivo vai direto para o armazenamento do Supabase, na pasta do próprio
 * usuário (`avatares/<user_id>/…`). O nome carrega a hora para o navegador não
 * insistir no arquivo antigo depois da troca.
 */
import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ImageUp, Loader2, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";

/** Iniciais do nome, para quando não há foto. */
function iniciais(nome: string | null | undefined) {
  const partes = (nome ?? "").trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

export function Avatar({
  url, nome, size = 40, className = "",
}: { url?: string | null; nome?: string | null; size?: number; className?: string }) {
  const txt = iniciais(nome);
  return (
    <span
      className={`inline-grid shrink-0 place-items-center overflow-hidden rounded-full bg-muted text-muted-foreground ring-1 ring-black/5 ${className}`}
      style={{ width: size, height: size, fontSize: Math.max(10, size * 0.36) }}
      title={nome ?? undefined}
    >
      {url ? (
        <img src={url} alt={nome ?? "Foto de perfil"} className="size-full object-cover" />
      ) : txt ? (
        <span className="font-medium">{txt}</span>
      ) : (
        <UserRound style={{ width: size * 0.55, height: size * 0.55 }} />
      )}
    </span>
  );
}

export function AvatarUpload({
  url, nome, userId, onChange, size = 72,
}: {
  url: string | null;
  nome: string | null;
  /** Pasta de destino — precisa ser o id de quem está logado. */
  userId: string | undefined;
  onChange: (novaUrl: string | null) => void;
  size?: number;
}) {
  const [enviando, setEnviando] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  async function enviar(file: File) {
    if (!userId) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("A imagem precisa ter no máximo 2 MB.");
      return;
    }
    setEnviando(true);
    try {
      const ext = (file.name.split(".").pop() || "png").toLowerCase();
      // UUID, e não `Date.now()`. O bucket `avatares` é público — quem tem a URL
      // vê a foto sem passar por RLS. Com o carimbo de tempo, o caminho inteiro
      // era DERIVÁVEL: `{user_id}/foto-{timestamp}.png`, e user_id não é
      // segredo. Bastava varrer alguns milhões de milissegundos para achar a
      // foto de qualquer pessoa cujo id se conhecesse.
      //
      // Com 122 bits aleatórios não há o que varrer. As fotos JÁ enviadas
      // mantêm o caminho antigo — quem trocar a foto sai do alcance; as demais
      // continuam como estavam, e trocar o esquema não as move de lugar.
      const caminho = `${userId}/foto-${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("avatares").upload(caminho, file, {
        cacheControl: "3600",
        upsert: true,
      });
      if (error) throw new Error(error.message);
      const { data } = supabase.storage.from("avatares").getPublicUrl(caminho);
      onChange(data.publicUrl);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao enviar a imagem.");
    } finally {
      setEnviando(false);
      if (ref.current) ref.current.value = "";
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      <Avatar url={url} nome={nome} size={size} />
      <input
        ref={ref} type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) enviar(f); }}
      />
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" disabled={enviando} onClick={() => ref.current?.click()}>
          {enviando
            ? <><Loader2 className="size-4 animate-spin" /> Enviando…</>
            : <><ImageUp className="size-4" /> {url ? "Trocar foto" : "Escolher foto"}</>}
        </Button>
        {url && (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
            <Trash2 className="size-4" /> Remover
          </Button>
        )}
      </div>
    </div>
  );
}
