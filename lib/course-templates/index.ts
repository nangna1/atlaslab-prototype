import type { CourseTemplate } from "@/lib/course-import";
import electriciteBases from "./electricite-bases.json";
import logiqueNumerique from "./logique-numerique.json";

export type CourseTemplateEntry = {
  id: string;
  titre: string;
  description: string;
  data: CourseTemplate;
};

export const COURSE_TEMPLATES: CourseTemplateEntry[] = [
  {
    id: "electricite-bases",
    titre: "Bases de l'électricité",
    description: "Grandeurs électriques (U, I, R) et un labo de simulation résistif.",
    data: electriciteBases as CourseTemplate,
  },
  {
    id: "logique-numerique",
    titre: "Introduction à la logique numérique",
    description: "Portes logiques, un labo CircuitVerse et un quiz de validation.",
    data: logiqueNumerique as CourseTemplate,
  },
];
