/**
 * O que o grupo libera no painel do aluno.
 *
 * Serve o passo 4 da criação e o cartão da ficha do grupo. Tudo marcado é o
 * padrão e vale como "sem restrição": um grupo novo não deve nascer cortando
 * nada, e área NOVA da plataforma entra liberada sozinha nesses grupos.
 *
 * "Meu perfil" não aparece aqui de propósito — é onde a pessoa troca a própria
 * senha e os próprios dados.
 *
 * "Biblioteca" (#315) aparece na MESMA lista, mas por baixo é outra coisa: ela não é um valor de
 * `groups.areas_aluno` (o banco recusaria — o CHECK só aceita as áreas de sempre) e não nasce aberta
 * como as outras. Quem vê o item de verdade é `bib_visiveis`/`biblioteca_menu_grupos` (#313, "nasce
 * fechada"); aqui é só ONDE se liga e desliga, unificado com o resto — por isso vem com prop própria
 * (`biblioteca`), em vez de entrar no array `areas`.
 */
import { AREAS_DO_ALUNO } from "@/lib/data.functions";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Info, Library } from "lucide-react";

export function AreasDoAluno({
  areas, setAreas, titulo = "O que este grupo acessa", biblioteca,
}: {
  /** `null` = sem restrição, tudo liberado. */
  areas: string[] | null;
  setAreas: (v: string[] | null) => void;
  titulo?: string;
  /** Omitido = não mostra a linha da Biblioteca (ex.: telas fora do contexto de grupo). */
  biblioteca?: { ligado: boolean; onChange: (v: boolean) => void };
}) {
  const todas = AREAS_DO_ALUNO.map((a) => a.valor as string);
  const marcadas = areas ?? todas;
  const semRestricao = areas === null || areas.length >= todas.length;
  const totalComBiblioteca = todas.length + (biblioteca ? 1 : 0);
  const marcadasComBiblioteca = marcadas.length + (biblioteca?.ligado ? 1 : 0);

  function alternar(v: string) {
    const nova = marcadas.includes(v) ? marcadas.filter((x) => x !== v) : [...marcadas, v];
    setAreas(nova.length >= todas.length ? null : nova);
  }

  return (
    <div className="space-y-3">
      <div>
        <Label>{titulo}</Label>
        <p className="mt-1 text-xs text-muted-foreground">
          Desmarque o que este grupo <strong>não</strong> deve ver no painel do aluno. Quem está em
          mais de um grupo soma os acessos — basta um grupo liberar.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {AREAS_DO_ALUNO.map((a) => (
          <label
            key={a.valor}
            className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition ${
              marcadas.includes(a.valor)
                ? "border-black/10 hover:bg-muted/40"
                : "border-dashed border-black/10 bg-muted/30 opacity-70"
            }`}
          >
            <Checkbox
              className="mt-0.5"
              checked={marcadas.includes(a.valor)}
              onCheckedChange={() => alternar(a.valor)}
            />
            <div>
              <p className="text-sm font-medium">{a.titulo}</p>
              <p className="text-[11px] text-muted-foreground">{a.ajuda}</p>
            </div>
          </label>
        ))}
        {biblioteca && (
          <label
            className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition ${
              biblioteca.ligado
                ? "border-black/10 hover:bg-muted/40"
                : "border-dashed border-black/10 bg-muted/30 opacity-70"
            }`}
          >
            <Checkbox
              className="mt-0.5"
              checked={biblioteca.ligado}
              onCheckedChange={(v) => biblioteca.onChange(!!v)}
            />
            <div>
              <p className="flex items-center gap-1.5 text-sm font-medium">
                <Library className="size-3.5 text-muted-foreground" /> Biblioteca
              </p>
              <p className="text-[11px] text-muted-foreground">
                Materiais, PDFs e links organizados em pastas. Diferente das outras: nasce FECHADA — marque para liberar.
              </p>
            </div>
          </label>
        )}
      </div>

      <p className="flex items-start gap-2 rounded-lg bg-muted/50 px-3 py-2 text-[11px] text-muted-foreground">
        <Info className="mt-px size-3.5 shrink-0" />
        <span>
          {semRestricao && (!biblioteca || biblioteca.ligado)
            ? "Sem restrição: este grupo vê o painel inteiro."
            : marcadasComBiblioteca === 0
              ? "Nada marcado: sobra só “Meu perfil”, onde ele troca a própria senha."
              : `${marcadasComBiblioteca} de ${totalComBiblioteca} áreas liberadas. O item some do menu e a rota também para de responder.`}
        </span>
      </p>
    </div>
  );
}
