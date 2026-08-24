import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";

import { cn } from "@/lib/utils";

const Tabs = TabsPrimitive.Root;

/**
 * #279 F4 — a fileira de abas não rolava nem quebrava linha: quando a soma
 * das abas passava da largura da tela, as últimas simplesmente saíam para
 * fora, sem nenhuma pista de que existiam (causa nº 4 do diagnóstico
 * mobile). Agora rola de lado, com uma sombra na borda que só aparece
 * quando falta conteúdo pra ver — em telas onde tudo já cabe (a maioria
 * hoje, no computador) o comportamento visual não muda em nada.
 */
const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => {
  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  const [fade, setFade] = React.useState({ esquerda: false, direita: false });

  const atualizarFade = React.useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setFade({
      esquerda: el.scrollLeft > 2,
      direita: el.scrollLeft < el.scrollWidth - el.clientWidth - 2,
    });
  }, []);

  React.useEffect(() => {
    atualizarFade();
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(atualizarFade);
    ro.observe(el);
    return () => ro.disconnect();
  }, [atualizarFade]);

  // A aba ativa pode estar fora da parte visível da fileira (ex.: recarregou
  // a página numa aba que não é a primeira) — traz ela pro campo de visão
  // antes da primeira pintura, sem animação, pra não piscar.
  React.useLayoutEffect(() => {
    const el = scrollRef.current;
    const ativa = el?.querySelector<HTMLElement>('[data-state="active"]');
    ativa?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, []);

  return (
    <div className="relative inline-flex max-w-full">
      {fade.esquerda && (
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-6 rounded-l-lg bg-gradient-to-r from-muted to-transparent" />
      )}
      <TabsPrimitive.List
        ref={(node) => {
          scrollRef.current = node;
          if (typeof ref === "function") ref(node);
          else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
        }}
        onScroll={atualizarFade}
        className={cn(
          "inline-flex h-9 max-w-full items-center justify-start overflow-x-auto rounded-lg bg-muted p-1 text-muted-foreground",
          className,
        )}
        {...props}
      />
      {fade.direita && (
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-6 rounded-r-lg bg-gradient-to-l from-muted to-transparent" />
      )}
    </div>
  );
});
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-background cursor-pointer transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow",
      className,
    )}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className,
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
