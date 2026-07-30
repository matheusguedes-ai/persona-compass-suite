export type TestCategory = "comportamental" | "psicometrico" | "cognitivo";
export type SendStatus = "pendente" | "em_andamento" | "concluido" | "expirado";
export type PersonRole = "cliente" | "aluno" | "colaborador";

export interface Instrument {
  id: string;
  name: string;
  shortName: string;
  category: TestCategory;
  durationMin: number;
  description: string;
  accent: string; // tailwind color name
}

export interface Person {
  id: string;
  name: string;
  email: string;
  role: PersonRole;
  createdAt: string;
  tags?: string[];
}

export interface Send {
  id: string;
  personId: string;
  instrumentId: string;
  status: SendStatus;
  channel: "email" | "link";
  sentAt: string;
  dueAt?: string;
}

// A lista fixa de instrumentos foi REMOVIDA em 30/07/2026.
//
// Ela era servida pela ferramenta MCP `list_instruments`, que por isso
// entregava o catálogo congelado no dia em que este arquivo foi escrito —
// sem o teste de Valores, criado depois, e sem chance de enxergar qualquer
// instrumento novo. O catálogo de verdade é a tabela `instruments`.
//
// Apagada e não deixada como "referência": lista de exemplo que ninguém usa
// é lista de exemplo esperando para ser usada de novo por engano.

export const PEOPLE: Person[] = [
  { id: "p1", name: "Ana Paula Oliveira", email: "ana.oliveira@example.com", role: "cliente", createdAt: "2025-10-02", tags: ["Executiva"] },
  { id: "p2", name: "Bruno Ferraz", email: "bruno.ferraz@example.com", role: "aluno", createdAt: "2025-10-05" },
  { id: "p3", name: "Carla Mendez", email: "carla.mendez@example.com", role: "colaborador", createdAt: "2025-09-28", tags: ["RH"] },
  { id: "p4", name: "Diego Ramalho", email: "diego.r@example.com", role: "cliente", createdAt: "2025-09-20" },
  { id: "p5", name: "Eduarda Silva", email: "eduarda.s@example.com", role: "aluno", createdAt: "2025-10-10" },
  { id: "p6", name: "Fábio Nogueira", email: "fabio.n@example.com", role: "colaborador", createdAt: "2025-10-11", tags: ["Vendas"] },
  { id: "p7", name: "Gabriela Torres", email: "gabi.torres@example.com", role: "cliente", createdAt: "2025-10-14" },
];

export const SENDS: Send[] = [
  { id: "s1", personId: "p1", instrumentId: "disc", status: "concluido", channel: "email", sentAt: "2025-10-20T14:20:00" },
  { id: "s2", personId: "p2", instrumentId: "bigfive", status: "em_andamento", channel: "email", sentAt: "2025-10-21T09:15:00", dueAt: "2025-10-28" },
  { id: "s3", personId: "p3", instrumentId: "vak", status: "pendente", channel: "link", sentAt: "2025-10-18T11:00:00", dueAt: "2025-10-25" },
  { id: "s4", personId: "p4", instrumentId: "mbti", status: "concluido", channel: "email", sentAt: "2025-10-15T16:40:00" },
  { id: "s5", personId: "p5", instrumentId: "qi", status: "expirado", channel: "email", sentAt: "2025-09-30T10:00:00", dueAt: "2025-10-10" },
  { id: "s6", personId: "p6", instrumentId: "temperamentos", status: "em_andamento", channel: "email", sentAt: "2025-10-22T08:30:00" },
  { id: "s7", personId: "p7", instrumentId: "disc", status: "pendente", channel: "link", sentAt: "2025-10-22T13:00:00", dueAt: "2025-10-30" },
];

export const ACTIVITY_LAST_20: number[] = [
  4, 7, 5, 9, 6, 12, 3, 8, 6, 10, 7, 14, 5, 9, 11, 6, 8, 15, 9, 12,
];

export const STATUS_LABEL: Record<SendStatus, string> = {
  pendente: "Pendente",
  em_andamento: "Em andamento",
  concluido: "Concluído",
  expirado: "Expirado",
};

export const ROLE_LABEL: Record<PersonRole, string> = {
  cliente: "Cliente",
  aluno: "Aluno",
  colaborador: "Colaborador",
};

export const CATEGORY_LABEL: Record<TestCategory, string> = {
  comportamental: "Comportamental",
  psicometrico: "Psicométrico",
  cognitivo: "Cognitivo",
};

// `personById` e `instrumentById` saíram com a lista: as duas só liam os
// arrays de exemplo, e nenhum arquivo do app as chamava.

export type GroupType = "turma" | "empresa" | "setor";

export interface Group {
  id: string;
  name: string;
  type: GroupType;
  peopleCount: number;
  createdAt: string;
  description?: string;
}

export const GROUP_TYPE_LABEL: Record<GroupType, string> = {
  turma: "Turma",
  empresa: "Empresa",
  setor: "Setor",
};

export const GROUPS: Group[] = [
  { id: "g1", name: "Turma Coaching Executivo 2025.2", type: "turma", peopleCount: 24, createdAt: "2025-08-10", description: "Alunos do programa de formação em coaching executivo." },
  { id: "g2", name: "Grupo Alfa — Indústrias Vega", type: "empresa", peopleCount: 58, createdAt: "2025-09-01", description: "Colaboradores mapeados no diagnóstico organizacional." },
  { id: "g3", name: "Setor Comercial — Vega SP", type: "setor", peopleCount: 12, createdAt: "2025-09-14" },
  { id: "g4", name: "Mentorados Q4/2025", type: "turma", peopleCount: 9, createdAt: "2025-10-02" },
];

export interface Mentor {
  id: string;
  name: string;
  email: string;
  specialty: string;
  activeSessions: number;
}

export const MENTORS: Mentor[] = [
  { id: "m1", name: "Dr. Ricardo Santos", email: "ricardo.santos@metrica.com", specialty: "Coaching Executivo", activeSessions: 12 },
  { id: "m2", name: "Juliana Prado", email: "juliana.prado@metrica.com", specialty: "Desenvolvimento de Liderança", activeSessions: 7 },
  { id: "m3", name: "Henrique Almeida", email: "henrique.a@metrica.com", specialty: "Psicologia Organizacional", activeSessions: 15 },
];