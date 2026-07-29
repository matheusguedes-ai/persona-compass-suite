/**
 * Menu Gestão — o quadro de devolutivas.
 *
 * Duas abas: Agenda (o mês, com os compromissos) e Kanban (em que pé está cada
 * pessoa). A Agenda vem primeiro porque responde à pergunta mais frequente —
 * "o que tenho hoje" —; o Kanban responde à mais importante, que é "quem está
 * esperando há tempo demais".
 */
import { createFileRoute } from "@tanstack/react-router";
import { QuadroGestao } from "@/components/quadro-gestao";
import { Agenda } from "@/components/agenda";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_app/gestao")({
  head: () => ({ meta: [{ title: "Gestão — Métrica Humana" }] }),
  component: () => (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Gestão</h1>
      </div>
      <Tabs defaultValue="agenda">
        <TabsList>
          <TabsTrigger value="agenda">Agenda</TabsTrigger>
          <TabsTrigger value="quadro">Kanban</TabsTrigger>
        </TabsList>
        <TabsContent value="agenda" className="mt-5">
          <Agenda podeCriar />
        </TabsContent>
        <TabsContent value="quadro" className="mt-5">
          <QuadroGestao />
        </TabsContent>
      </Tabs>
    </div>
  ),
});
