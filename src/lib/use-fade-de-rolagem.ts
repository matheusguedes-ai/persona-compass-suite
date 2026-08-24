import { useCallback, useEffect, useRef, useState } from "react";

/**
 * #279 F4 — para as fileiras de abas feitas à mão (não usam ui/tabs.tsx):
 * mesma pista visual da fileira compartilhada (sombra na borda, só quando
 * falta conteúdo pra ver) sem herdar o padding/altura do componente
 * pronto, que é diferente do de cada uma dessas telas — migrar de verdade
 * mudaria o tamanho no computador, que é justamente o que não pode.
 */
export function useFadeDeRolagem<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [fade, setFade] = useState({ esquerda: false, direita: false });

  const atualizar = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setFade({
      esquerda: el.scrollLeft > 2,
      direita: el.scrollLeft < el.scrollWidth - el.clientWidth - 2,
    });
  }, []);

  useEffect(() => {
    atualizar();
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(atualizar);
    ro.observe(el);
    return () => ro.disconnect();
  }, [atualizar]);

  return { ref, fade, atualizar };
}
