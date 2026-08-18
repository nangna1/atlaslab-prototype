import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { MAX_FILE_SIZE_MB, MAX_FILE_SIZE_BYTES, formatFileSize } from "@/lib/document-limits";

// Piece jointe de lecon (PDF/Word/PPT deja prepares par le professeur, ou
// document source d'un cours genere par l'IA - voir
// app/(app)/cours/actions.ts:generateCourseFromDocument) -- aucune
// tentative de parsing/structuration, juste un fichier stocke tel quel et
// consultable depuis la lecon. Chemin non lie a l'id de la lecon (peut
// etre televerse avant sa creation) : dossier tenant_id + nom aleatoire.
//
// Extrait de app/(app)/cours/[courseId]/actions.ts (2026-08-18) vers lib/
// pour etre reutilisable depuis app/(app)/cours/actions.ts sans import
// croise entre deux fichiers "use server" de segments de route differents.
export async function uploadLessonDocument(
  supabase: SupabaseClient,
  tenantId: string,
  file: File,
): Promise<{ url: string; nom: string } | { error: string }> {
  // Meme risque que generateCourseFromDocument (voir lib/document-limits.ts)
  // : un fichier au-dela du plafond reel de corps de requete Vercel produit
  // un crash generique cote client plutot qu'une erreur propre. Filet de
  // securite serveur ; AddLessonForm/LessonRow bloquent deja l'envoi en
  // amont cote client (voir handleDocumentChange).
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { error: `Document trop volumineux (${formatFileSize(file.size)}) — ${MAX_FILE_SIZE_MB} Mo maximum.` };
  }

  const ext = file.name.split(".").pop() || "bin";
  const path = `${tenantId}/${randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from("lecons-documents")
    .upload(path, file, { contentType: file.type });
  if (error) return { error: error.message };
  const { data } = supabase.storage.from("lecons-documents").getPublicUrl(path);
  return { url: data.publicUrl, nom: file.name };
}
