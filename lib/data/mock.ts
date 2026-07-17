// Données simulées, structurées exactement comme le schéma Supabase réel
// (supabase/migrations/20260717000000_init.sql). Permettent de construire
// et vérifier visuellement les pages avant qu'un projet Supabase existe.
// À remplacer par de vraies requêtes lib/supabase/{client,server}.ts une
// fois le compte Supabase créé (voir README.md).

export type Lesson = {
  id: string;
  titre: string;
  ordre: number;
  type: "contenu" | "labo" | "quiz" | "seance_directe";
  contenu_markdown?: string;
  labo_type?: "circuitverse" | "eecircuit";
  labo_config?: { embed_url?: string; netlist?: string };
};

export type Module = {
  id: string;
  titre: string;
  ordre: number;
  lessons: Lesson[];
};

export type Course = {
  id: string;
  titre: string;
  filiere: string;
  tenant: string;
  modules: Module[];
};

export const MOCK_TENANT = {
  id: "tenant-iba",
  nom: "Institut Booster Afrique",
  slug: "iba",
};

export const MOCK_COURSES: Course[] = [
  {
    id: "electronique-base",
    titre: "Électronique — Bases des circuits",
    filiere: "Génie Électrique",
    tenant: MOCK_TENANT.nom,
    modules: [
      {
        id: "module-1",
        titre: "Module 1 — Loi d'Ohm et circuits résistifs",
        ordre: 1,
        lessons: [
          {
            id: "lecon-1",
            titre: "Introduction : tension, courant, résistance",
            ordre: 1,
            type: "contenu",
            contenu_markdown:
              "La loi d'Ohm relie tension (U), courant (I) et résistance (R) : **U = R × I**. " +
              "Dans ce module, vous allez vérifier cette loi directement sur un circuit simulé, " +
              "sans matériel physique.",
          },
          {
            id: "lecon-2",
            titre: "Simulation : circuit RC (pratique)",
            ordre: 2,
            type: "labo",
            labo_type: "eecircuit",
            contenu_markdown:
              "Observez la charge et décharge du condensateur sur ce circuit RC. " +
              "Modifiez le netlist pour changer la valeur de R ou C et observez l'effet sur le temps de charge.",
            labo_config: {
              netlist:
                "Circuit RC - Module 1 IBA\nv1 in 0 pulse(0 5 0 1m 1m 10m 20m)\nr1 in out 1k\nc1 out 0 1u\n.tran 0.1m 20m\n.end",
            },
          },
        ],
      },
      {
        id: "module-2",
        titre: "Module 2 — Logique numérique",
        ordre: 2,
        lessons: [
          {
            id: "lecon-3",
            titre: "Portes logiques de base (pratique)",
            ordre: 1,
            type: "labo",
            labo_type: "circuitverse",
            contenu_markdown:
              "Testez les portes NOT, AND, OR, XOR, NAND, NOR en changeant les entrées A et B " +
              "et observez les sorties calculées en direct.",
            labo_config: {
              embed_url: "https://circuitverse.org/simulator/embed/sample-embed",
            },
          },
        ],
      },
    ],
  },
];

export function getCourse(id: string): Course | undefined {
  return MOCK_COURSES.find((c) => c.id === id);
}

export function getLesson(
  courseId: string,
  lessonId: string,
): { course: Course; module: Module; lesson: Lesson } | undefined {
  const course = getCourse(courseId);
  if (!course) return undefined;
  for (const module of course.modules) {
    const lesson = module.lessons.find((l) => l.id === lessonId);
    if (lesson) return { course, module, lesson };
  }
  return undefined;
}
