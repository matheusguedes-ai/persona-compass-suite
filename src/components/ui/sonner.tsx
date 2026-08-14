import { Toaster as Sonner } from "sonner";
import { toast } from "@/lib/toast";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    // #275 — o sonner não descarta um aviso com um clique simples por padrão
    // (só arrasto ou um botão de fechar visível, que mudaria a aparência).
    // Delega pro toast mais próximo do clique; sem nenhum na pilha o clique
    // não faz nada.
    <div onClick={(e) => { if ((e.target as HTMLElement).closest("[data-sonner-toast]")) toast.dismiss(); }}>
      <Sonner
        className="toaster group"
        duration={5000}
        visibleToasts={3}
        // A pilha nasce no canto superior direito — mesmo canto do sino, do
        // "Ver como aluno" e do "Sair" no cabeçalho (~64px). Sem esse
        // afastamento o aviso nasce embaixo do cabeçalho: cobre os botões E
        // o sonner pausa a contagem enquanto o mouse estiver ali (pra dar
        // tempo de ler), então o mouse indo em direção aos botões nunca
        // deixa a contagem retomar — o aviso parece eterno.
        offset={{ top: 80 }}
        toastOptions={{
          classNames: {
            toast:
              "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg group-[.toaster]:cursor-pointer",
            description: "group-[.toast]:text-muted-foreground",
            actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
            cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          },
        }}
        {...props}
      />
    </div>
  );
};

export { Toaster };
