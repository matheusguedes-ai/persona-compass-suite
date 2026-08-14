import { toast as sonnerToast } from "sonner";

/**
 * #275 — o sonner não tem, na configuração do Toaster, um jeito de dar uma
 * duração diferente por tipo (sucesso vs erro); só um valor único pra todos.
 * Em vez de tocar as ~130 chamadas de toast.error(...) espalhadas pelo app,
 * sobrescrevemos aqui o método .error do objeto exportado pelo sonner — é o
 * mesmo objeto que todo `import { toast } from "sonner"` recebe (módulo é
 * singleton), então o patch vale pra tudo. Precisa ser importado uma vez,
 * cedo, por isso o import "para efeito colateral" em ui/sonner.tsx.
 */
const DURACAO_ERRO_MS = 7500;
const erroOriginal = sonnerToast.error;

Object.assign(sonnerToast, {
  error: (
    message: Parameters<typeof sonnerToast.error>[0],
    data?: Parameters<typeof sonnerToast.error>[1],
  ) => erroOriginal(message, { duration: DURACAO_ERRO_MS, ...data }),
});

export const toast = sonnerToast;
