import type { SupabaseClient } from "@supabase/supabase-js";

export type CourseTemplateLesson = {
  titre: string;
  type: "contenu" | "labo" | "quiz" | "seance_directe";
  contenu_markdown?: string | null;
  labo_type?: "eecircuit" | "circuitverse" | null;
  labo_config?: { netlist?: string; embed_url?: string } | null;
  quiz_questions?: { question: string; options: string[]; correct: number }[] | null;
};

export type CourseTemplateModule = {
  titre: string;
  lessons: CourseTemplateLesson[];
};

export type CourseTemplate = {
  titre: string;
  filiere?: string | null;
  modules: CourseTemplateModule[];
};

const LESSON_TYPES = ["contenu", "labo", "quiz", "seance_directe"];
const LABO_TYPES = ["eecircuit", "circuitverse"];

function parseLesson(raw: unknown, path: string): CourseTemplateLesson | { error: string } {
  if (!raw || typeof raw !== "object") return { error: `${path} : leçon invalide.` };
  const l = raw as Record<string, unknown>;

  if (typeof l.titre !== "string" || !l.titre.trim()) {
    return { error: `${path} : titre de leçon requis.` };
  }
  if (typeof l.type !== "string" || !LESSON_TYPES.includes(l.type)) {
    return { error: `${path} : type de leçon invalide.` };
  }

  const lesson: CourseTemplateLesson = { titre: l.titre.trim(), type: l.type as CourseTemplateLesson["type"] };

  if (typeof l.contenu_markdown === "string") lesson.contenu_markdown = l.contenu_markdown;

  if (l.type === "labo") {
    if (typeof l.labo_type !== "string" || !LABO_TYPES.includes(l.labo_type)) {
      return { error: `${path} : labo_type doit être "eecircuit" ou "circuitverse".` };
    }
    const config = l.labo_config as Record<string, unknown> | undefined;
    if (l.labo_type === "eecircuit") {
      if (!config || typeof config.netlist !== "string" || !config.netlist.trim()) {
        return { error: `${path} : netlist requise pour un labo eecircuit.` };
      }
      lesson.labo_type = "eecircuit";
      lesson.labo_config = { netlist: config.netlist };
    } else {
      if (!config || typeof config.embed_url !== "string" || !config.embed_url.trim()) {
        return { error: `${path} : embed_url requise pour un labo circuitverse.` };
      }
      lesson.labo_type = "circuitverse";
      lesson.labo_config = { embed_url: config.embed_url };
    }
  }

  if (l.type === "quiz") {
    if (!Array.isArray(l.quiz_questions) || l.quiz_questions.length === 0) {
      return { error: `${path} : au moins une question de quiz requise.` };
    }
    const questions: { question: string; options: string[]; correct: number }[] = [];
    for (const [qi, rawQuestion] of l.quiz_questions.entries()) {
      const q = rawQuestion as Record<string, unknown>;
      if (
        !q ||
        typeof q.question !== "string" ||
        !q.question.trim() ||
        !Array.isArray(q.options)
      ) {
        return { error: `${path} : question ${qi + 1} invalide.` };
      }
      const options = q.options.filter((o: unknown): o is string => typeof o === "string" && o.trim() !== "");
      if (options.length < 2) {
        return { error: `${path} : question ${qi + 1} doit avoir au moins 2 options.` };
      }
      const correct = Number(q.correct);
      if (!Number.isInteger(correct) || correct < 0 || correct >= options.length) {
        return { error: `${path} : question ${qi + 1} a une bonne réponse invalide.` };
      }
      questions.push({ question: q.question.trim(), options, correct });
    }
    lesson.quiz_questions = questions;
  }

  return lesson;
}

export function parseCourseTemplate(raw: unknown): { data: CourseTemplate } | { error: string } {
  if (!raw || typeof raw !== "object") return { error: "Fichier invalide : JSON attendu." };
  const c = raw as Record<string, unknown>;

  if (typeof c.titre !== "string" || !c.titre.trim()) {
    return { error: "Fichier invalide : titre du cours requis." };
  }
  if (!Array.isArray(c.modules) || c.modules.length === 0) {
    return { error: "Fichier invalide : au moins un module requis." };
  }

  const modules: CourseTemplateModule[] = [];
  for (const [mi, rawModule] of c.modules.entries()) {
    const m = rawModule as Record<string, unknown>;
    if (!m || typeof m.titre !== "string" || !m.titre.trim()) {
      return { error: `Fichier invalide : module ${mi + 1} sans titre.` };
    }
    if (!Array.isArray(m.lessons) || m.lessons.length === 0) {
      return { error: `Fichier invalide : module "${m.titre}" sans leçon.` };
    }
    const lessons: CourseTemplateLesson[] = [];
    for (const [li, rawLesson] of m.lessons.entries()) {
      const parsed = parseLesson(rawLesson, `Module "${m.titre}", leçon ${li + 1}`);
      if ("error" in parsed) return parsed;
      lessons.push(parsed);
    }
    modules.push({ titre: m.titre.trim(), lessons });
  }

  return {
    data: {
      titre: c.titre.trim(),
      filiere: typeof c.filiere === "string" ? c.filiere.trim() : null,
      modules,
    },
  };
}

export async function insertCourseFromTemplate(
  supabase: SupabaseClient,
  tenantId: string,
  professeurId: string | null,
  template: CourseTemplate,
): Promise<{ courseId: string } | { error: string }> {
  const { data: course, error: courseError } = await supabase
    .from("courses")
    .insert({
      tenant_id: tenantId,
      titre: template.titre,
      filiere: template.filiere || null,
      professeur_id: professeurId,
    })
    .select("id")
    .single();

  if (courseError || !course) return { error: courseError?.message ?? "Impossible de créer le cours." };

  for (const [mi, module] of template.modules.entries()) {
    const { data: moduleRow, error: moduleError } = await supabase
      .from("modules")
      .insert({ course_id: course.id, titre: module.titre, ordre: mi + 1 })
      .select("id")
      .single();

    if (moduleError || !moduleRow) {
      return { error: moduleError?.message ?? "Impossible de créer un module." };
    }

    for (const [li, lesson] of module.lessons.entries()) {
      const { error: lessonError } = await supabase.from("lessons").insert({
        module_id: moduleRow.id,
        titre: lesson.titre,
        ordre: li + 1,
        type: lesson.type,
        contenu_markdown: lesson.contenu_markdown || null,
        labo_type: lesson.labo_type ?? null,
        labo_config: lesson.labo_config ?? null,
        quiz_questions: lesson.quiz_questions ?? null,
      });

      if (lessonError) return { error: lessonError.message };
    }
  }

  return { courseId: course.id };
}
