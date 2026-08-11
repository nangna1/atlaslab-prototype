"use server";

import Anthropic from "@anthropic-ai/sdk";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parseCourseTemplate, insertCourseFromTemplate } from "@/lib/course-import";
import { COURSE_TEMPLATES } from "@/lib/course-templates";
import { extractDocumentText, buildNativeDocumentBlock, type NativeDocumentBlock } from "@/lib/document-text";

const anthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) : null;

export async function markNotificationRead(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const notificationId = String(formData.get("notification_id") ?? "");
  const lien = String(formData.get("lien") ?? "/cours");

  if (notificationId) {
    await supabase.from("notifications").update({ lu: true }).eq("id", notificationId);
  }

  redirect(lien);
}

export type CreateCourseState = { error?: string };

export async function createCourse(
  _prevState: CreateCourseState,
  formData: FormData,
): Promise<CreateCourseState> {
  const supabase = await createClient();
  const {
    data: { user: caller },
  } = await supabase.auth.getUser();
  if (!caller) return { error: "Non authentifié." };

  const { data: callerProfile } = await supabase
    .from("users")
    .select("role, tenant_id")
    .eq("id", caller.id)
    .single();

  if (!callerProfile || !["professeur", "admin_tenant", "super_admin"].includes(callerProfile.role)) {
    return { error: "Action réservée au staff." };
  }

  const titre = String(formData.get("titre") ?? "").trim();
  const filiere = String(formData.get("filiere") ?? "").trim();
  if (!titre) return { error: "Le titre est requis." };

  const { data: course, error } = await supabase
    .from("courses")
    .insert({
      tenant_id: callerProfile.tenant_id,
      titre,
      filiere: filiere || null,
      professeur_id: callerProfile.role === "professeur" ? caller.id : null,
    })
    .select("id")
    .single();

  if (error || !course) return { error: error?.message ?? "Impossible de créer le cours." };

  redirect(`/cours/${course.id}`);
}

export type ImportCourseState = { error?: string };

export async function importCourse(
  _prevState: ImportCourseState,
  formData: FormData,
): Promise<ImportCourseState> {
  const supabase = await createClient();
  const {
    data: { user: caller },
  } = await supabase.auth.getUser();
  if (!caller) return { error: "Non authentifié." };

  const { data: callerProfile } = await supabase
    .from("users")
    .select("role, tenant_id")
    .eq("id", caller.id)
    .single();

  if (!callerProfile || !["professeur", "admin_tenant", "super_admin"].includes(callerProfile.role)) {
    return { error: "Action réservée au staff." };
  }
  if (!callerProfile.tenant_id) {
    return { error: "Aucun établissement associé à ce compte." };
  }

  const templateId = String(formData.get("template_id") ?? "");
  const file = formData.get("file") as File | null;

  let raw: unknown;
  if (templateId) {
    const template = COURSE_TEMPLATES.find((t) => t.id === templateId);
    if (!template) return { error: "Modèle introuvable." };
    raw = template.data;
  } else if (file && file.size > 0) {
    const text = await file.text();
    try {
      raw = JSON.parse(text);
    } catch {
      return { error: "Fichier invalide : JSON mal formé." };
    }
  } else {
    return { error: "Choisissez un modèle ou un fichier à importer." };
  }

  const parsed = parseCourseTemplate(raw);
  if ("error" in parsed) return { error: parsed.error };

  const result = await insertCourseFromTemplate(
    supabase,
    callerProfile.tenant_id,
    callerProfile.role === "professeur" ? caller.id : null,
    parsed.data,
  );
  if ("error" in result) return { error: result.error };

  redirect(`/cours/${result.courseId}`);
}

const COURSE_STRUCTURE_TOOL = {
  name: "structurer_cours",
  description: "Structure un contenu pédagogique brut en cours AtlasLab (modules et leçons).",
  input_schema: {
    type: "object" as const,
    properties: {
      titre: { type: "string", description: "Titre du cours" },
      filiere: { type: "string", description: "Filière/domaine concerné, si identifiable" },
      modules: {
        type: "array",
        items: {
          type: "object",
          properties: {
            titre: { type: "string" },
            lessons: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  titre: { type: "string" },
                  type: { type: "string", enum: ["contenu", "quiz"] },
                  contenu_markdown: {
                    type: "string",
                    description: "Résumé pédagogique clair du contenu de cette leçon (pas une copie verbatim du document)",
                  },
                  quiz_questions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        question: { type: "string" },
                        options: { type: "array", items: { type: "string" } },
                        correct: { type: "integer", description: "Index (0-based) de la bonne réponse dans options" },
                      },
                      required: ["question", "options", "correct"],
                    },
                  },
                },
                required: ["titre", "type"],
              },
            },
          },
          required: ["titre", "lessons"],
        },
      },
    },
    required: ["titre", "modules"],
  },
};

export type GenerateCourseState = { error?: string };

export async function generateCourseFromDocument(
  _prevState: GenerateCourseState,
  formData: FormData,
): Promise<GenerateCourseState> {
  const supabase = await createClient();
  const {
    data: { user: caller },
  } = await supabase.auth.getUser();
  if (!caller) return { error: "Non authentifié." };

  const { data: callerProfile } = await supabase
    .from("users")
    .select("role, tenant_id")
    .eq("id", caller.id)
    .single();

  if (!callerProfile || !["professeur", "admin_tenant", "super_admin"].includes(callerProfile.role)) {
    return { error: "Action réservée au staff." };
  }
  if (!callerProfile.tenant_id) {
    return { error: "Aucun établissement associé à ce compte." };
  }
  if (!anthropic) {
    return { error: "Génération IA non configurée sur cette plateforme (clé API manquante)." };
  }

  const file = formData.get("document") as File | null;
  if (!file || file.size === 0) return { error: "Choisissez un document (PDF, image, DOCX ou PPTX)." };

  const instructions =
    `Structure ce document pédagogique{NOM} en cours AtlasLab : découpe-le en modules cohérents puis en ` +
    `leçons, en respectant l'ordre du document. Pour chaque leçon de type "contenu", écris un résumé ` +
    `pédagogique clair (pas une copie verbatim). Ajoute une leçon de type "quiz" (2 à 4 questions) à la fin ` +
    `d'un module seulement si le contenu s'y prête clairement (faits/définitions vérifiables) — sinon n'en ` +
    `ajoute pas.`;

  // PDF et images : lus nativement par Claude (le modele les "regarde"),
  // pas d'extraction de texte prealable - fonctionne aussi bien sur un PDF
  // scanne/photographie que sur un PDF texte, voir buildNativeDocumentBlock.
  // DOCX/PPTX : pas de blocs "document"/"image" natifs pour ces formats
  // cote API Claude, extraction de texte via extractDocumentText (mammoth/
  // XML) comme avant, avec un plafond de troncature releve.
  const nameLower = file.name.toLowerCase();
  const isNativelyReadable = [".pdf", ".jpg", ".jpeg", ".png", ".webp"].some((ext) => nameLower.endsWith(ext));

  let userContent: string | (NativeDocumentBlock | { type: "text"; text: string })[];

  if (isNativelyReadable) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const block = buildNativeDocumentBlock(file, buffer);
    if ("error" in block) return { error: block.error };
    userContent = [block, { type: "text", text: instructions.replace("{NOM}", ` (${file.name})`) }];
  } else {
    const extracted = await extractDocumentText(file);
    if ("error" in extracted) return { error: extracted.error };
    if (!extracted.text) return { error: "Aucun texte exploitable trouvé dans ce document." };
    userContent =
      instructions.replace("{NOM}", ` (${file.name})`) +
      (extracted.truncated ? "\n\n(Document tronqué : seul le début a été fourni.)" : "") +
      `\n\n---\n\n${extracted.text}`;
  }

  let response;
  try {
    response = await anthropic.messages.create({
      model: "claude-sonnet-5",
      // Vrai bug trouve en testant sur un document reel (2026-08-11,
      // "COURS DE DESSIN 1ERE ANNEE.pdf", 87 pages) : a 4096, la reponse
      // s'arretait a stop_reason "max_tokens" en plein milieu du JSON de
      // structuration (seul le champ "filiere" avait ete ecrit, ni titre ni
      // modules) - un vrai cours de plusieurs dizaines de pages a largement
      // besoin de plus de place que ca pour ses resumes de lecon. Reteste a
      // 16000 : succes (stop_reason "tool_use", JSON complet) mais deja a
      // 15582 tokens de sortie sur ce document, tres proche du plafond.
      // 24000 laisse une vraie marge pour des cours encore plus longs/denses.
      max_tokens: 24000,
      tools: [COURSE_STRUCTURE_TOOL],
      tool_choice: { type: "tool", name: "structurer_cours" },
      messages: [{ role: "user", content: userContent }],
    });
  } catch {
    return { error: "Erreur lors de la génération IA — réessayez." };
  }

  const toolUse = response.content.find((c) => c.type === "tool_use");
  if (!toolUse) return { error: "La génération IA n'a produit aucun résultat exploitable." };

  if (response.stop_reason === "max_tokens") {
    // Toujours possible sur un document exceptionnellement dense meme a
    // 16000 - un JSON tronque ici produirait un objet incomplet que
    // parseCourseTemplate rejetterait de toute facon avec un message
    // generique ("titre requis"), trompeur sur la vraie cause. Message
    // explicite a la place.
    return {
      error:
        "Le document est trop dense pour être structuré en un seul passage (réponse de l'IA coupée). " +
        "Essayez avec un document plus court, ou scindez-le en plusieurs parties.",
    };
  }

  const parsed = parseCourseTemplate(toolUse.input);
  if ("error" in parsed) return { error: `Résultat IA invalide : ${parsed.error}` };

  const result = await insertCourseFromTemplate(
    supabase,
    callerProfile.tenant_id,
    callerProfile.role === "professeur" ? caller.id : null,
    parsed.data,
  );
  if ("error" in result) return { error: result.error };

  redirect(`/cours/${result.courseId}`);
}

async function requireStaff() {
  const supabase = await createClient();
  const {
    data: { user: caller },
  } = await supabase.auth.getUser();
  if (!caller) return { supabase, error: "Non authentifié." } as const;

  const { data: callerProfile } = await supabase
    .from("users")
    .select("role")
    .eq("id", caller.id)
    .single();

  if (!callerProfile || !["professeur", "admin_tenant", "super_admin"].includes(callerProfile.role)) {
    return { supabase, error: "Action réservée au staff." } as const;
  }

  return { supabase, error: null } as const;
}

export type UpdateCourseState = { error?: string; success?: boolean };

export async function updateCourse(
  _prevState: UpdateCourseState,
  formData: FormData,
): Promise<UpdateCourseState> {
  const { supabase, error: authError } = await requireStaff();
  if (authError) return { error: authError };

  const courseId = String(formData.get("course_id") ?? "");
  const titre = String(formData.get("titre") ?? "").trim();
  const filiere = String(formData.get("filiere") ?? "").trim();
  if (!courseId || !titre) return { error: "Le titre est requis." };

  const { error } = await supabase
    .from("courses")
    .update({ titre, filiere: filiere || null })
    .eq("id", courseId);

  if (error) return { error: error.message };

  revalidatePath(`/cours/${courseId}`);
  return { success: true };
}

export async function deleteCourse(formData: FormData): Promise<void> {
  const { supabase, error: authError } = await requireStaff();
  if (authError) return;

  const courseId = String(formData.get("course_id") ?? "");
  if (!courseId) return;

  await supabase.from("courses").delete().eq("id", courseId);

  redirect("/cours");
}
