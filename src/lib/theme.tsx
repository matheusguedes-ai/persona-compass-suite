import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Check, Monitor, Moon, Sun } from "lucide-react";

/**
 * Tema claro/escuro.
 *
 * O CSS já trazia o bloco `.dark`; o que faltava era alguém ligar a classe no
 * `<html>`. A preferência fica no navegador de quem usa (não na conta), porque
 * é uma escolha do aparelho: a mesma pessoa pode querer escuro no notebook à
 * noite e claro no celular de dia.
 */
export type Tema = "claro" | "escuro" | "sistema";

const CHAVE = "tema";

export const TEMAS: Array<{ valor: Tema; titulo: string; icone: typeof Sun }> = [
  { valor: "claro", titulo: "Claro", icone: Sun },
  { valor: "escuro", titulo: "Escuro", icone: Moon },
  { valor: "sistema", titulo: "Igual ao sistema", icone: Monitor },
];

/** Script mínimo injetado no <head>: evita a "piscada" de tema errado antes do React subir. */
export const SCRIPT_ANTI_PISCADA = `(function(){try{var t=localStorage.getItem("${CHAVE}")||"sistema";var e=t==="escuro"||(t==="sistema"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",e);}catch(_){}})();`;

function aplicar(tema: Tema) {
  if (typeof document === "undefined") return;
  const escuro =
    tema === "escuro" ||
    (tema === "sistema" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", escuro);
}

type Ctx = { tema: Tema; setTema: (t: Tema) => void };
const ThemeContext = createContext<Ctx>({ tema: "sistema", setTema: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [tema, setTemaState] = useState<Tema>("sistema");

  useEffect(() => {
    const salvo = (localStorage.getItem(CHAVE) as Tema | null) ?? "sistema";
    setTemaState(salvo);
    aplicar(salvo);
  }, []);

  // Em "sistema", acompanha o aparelho mudando sozinho (modo noturno automático).
  useEffect(() => {
    if (tema !== "sistema") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const aoMudar = () => aplicar("sistema");
    mq.addEventListener("change", aoMudar);
    return () => mq.removeEventListener("change", aoMudar);
  }, [tema]);

  const setTema = useCallback((t: Tema) => {
    setTemaState(t);
    localStorage.setItem(CHAVE, t);
    aplicar(t);
  }, []);

  return <ThemeContext.Provider value={{ tema, setTema }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemeToggle() {
  const { tema, setTema } = useTheme();
  const [escuroAgora, setEscuroAgora] = useState(false);

  // Qual ícone mostrar: em "sistema" depende do que o aparelho está fazendo.
  useEffect(() => {
    setEscuroAgora(document.documentElement.classList.contains("dark"));
  }, [tema]);

  const Icone = escuroAgora ? Moon : Sun;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" title="Aparência" aria-label="Mudar entre claro e escuro">
          <Icone className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {TEMAS.map((t) => {
          const I = t.icone;
          return (
            <DropdownMenuItem key={t.valor} onClick={() => setTema(t.valor)}>
              <I className="size-4" />
              <span className="flex-1">{t.titulo}</span>
              {tema === t.valor && <Check className="size-3.5" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
