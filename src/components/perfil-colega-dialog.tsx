/**
 * O cartão de perfil de um colega — extraído de comunidade-lado.tsx (#55)
 * para ser o MESMO cartão que abre tanto pela aba Membros quanto ao clicar
 * numa menção com @ no feed. Um componente só: se o conteúdo do cartão mudar
 * um dia, muda nos dois lugares de uma vez.
 */
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { perfilDoColega } from "@/lib/comunidade.functions";
import { Avatar } from "@/components/avatar-upload";
import { Mail, Phone, Briefcase, Lock, Linkedin, Instagram, Globe } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function PerfilColegaDialog({
  personId,
  onOpenChange,
}: {
  personId: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  const perfilFn = useServerFn(perfilDoColega);
  const { data: perfil } = useQuery({
    queryKey: ["perfil-colega", personId],
    queryFn: () => perfilFn({ data: { person_id: personId! } }),
    enabled: !!personId,
  });

  return (
    <Dialog open={!!personId} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        {perfil && !perfil.perfil && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Não foi possível abrir este perfil.
          </p>
        )}
        {perfil?.perfil && (
          <>
            {/* Sangra até a borda do diálogo (p-6 no DialogContent) — sem
                banner, fica só o fundo neutro no lugar. */}
            <div className="-mx-6 -mt-6 mb-1 h-20 w-[calc(100%+3rem)] overflow-hidden bg-gradient-to-r from-muted to-muted/60">
              {perfil.perfil.banner_url && (
                <img src={perfil.perfil.banner_url} alt="" className="size-full object-cover" />
              )}
            </div>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                <Avatar
                  url={perfil.perfil.avatar_url} nome={perfil.perfil.full_name}
                  className="size-10"
                />
                <span>{perfil.perfil.full_name}</span>
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-2 text-sm">
              {(perfil.perfil.role_at_company || perfil.perfil.company_name) && (
                <p className="text-muted-foreground">
                  {[perfil.perfil.role_at_company, perfil.perfil.company_name].filter(Boolean).join(" · ")}
                </p>
              )}

              {perfil.perfil.autorizou ? (
                <>
                  {perfil.perfil.profession && (
                    <p className="flex items-center gap-2">
                      <Briefcase className="size-4 shrink-0 text-muted-foreground" />
                      {perfil.perfil.profession}
                    </p>
                  )}
                  {perfil.perfil.email && (
                    <p className="flex items-center gap-2">
                      <Mail className="size-4 shrink-0 text-muted-foreground" />
                      {perfil.perfil.email}
                    </p>
                  )}
                  {perfil.perfil.phone && (
                    <p className="flex items-center gap-2">
                      <Phone className="size-4 shrink-0 text-muted-foreground" />
                      {perfil.perfil.phone}
                    </p>
                  )}
                  {(perfil.perfil.linkedin_url || perfil.perfil.instagram_url || perfil.perfil.site_url) && (
                    <div className="flex items-center gap-3 pt-1">
                      {perfil.perfil.linkedin_url && (
                        <a href={perfil.perfil.linkedin_url} target="_blank" rel="noopener noreferrer"
                           className="text-muted-foreground hover:text-foreground" title="LinkedIn">
                          <Linkedin className="size-4" />
                        </a>
                      )}
                      {perfil.perfil.instagram_url && (
                        <a href={perfil.perfil.instagram_url} target="_blank" rel="noopener noreferrer"
                           className="text-muted-foreground hover:text-foreground" title="Instagram">
                          <Instagram className="size-4" />
                        </a>
                      )}
                      {perfil.perfil.site_url && (
                        <a href={perfil.perfil.site_url} target="_blank" rel="noopener noreferrer"
                           className="text-muted-foreground hover:text-foreground" title="Site pessoal">
                          <Globe className="size-4" />
                        </a>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <p className="flex items-start gap-2 rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
                  <Lock className="mt-0.5 size-3.5 shrink-0" />
                  Esta pessoa preferiu não compartilhar os dados de contato com o grupo.
                </p>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
