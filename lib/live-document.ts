import type { SupabaseClient } from "@supabase/supabase-js";

// Partage de document pendant une seance en direct - voir la migration
// 20260819000000_live_session_documents.sql pour le schema/RLS complets et
// DocumentPartage.tsx pour l'UI (upload+rendu cote enseignant, affichage
// synchronise cote eleve). Une seule ligne par seance (upsert sur
// live_session_id) : "le document actuellement partage", pas un historique.

export type LiveDocument = {
  liveSessionId: string;
  professeurId: string;
  nomFichier: string;
  pages: string[];
  pageCourante: number;
  updatedAt: string;
};

type LiveDocumentRow = {
  live_session_id: string;
  professeur_id: string;
  nom_fichier: string;
  pages: unknown;
  page_courante: number;
  updated_at: string;
};

function fromRow(row: LiveDocumentRow): LiveDocument {
  return {
    liveSessionId: row.live_session_id,
    professeurId: row.professeur_id,
    nomFichier: row.nom_fichier,
    pages: Array.isArray(row.pages) ? (row.pages as string[]) : [],
    pageCourante: row.page_courante,
    updatedAt: row.updated_at,
  };
}

export async function getLiveDocument(supabase: SupabaseClient, liveSessionId: string): Promise<LiveDocument | null> {
  const { data } = await supabase
    .from("live_session_documents")
    .select("live_session_id, professeur_id, nom_fichier, pages, page_courante, updated_at")
    .eq("live_session_id", liveSessionId)
    .maybeSingle();
  return data ? fromRow(data as LiveDocumentRow) : null;
}

// Une page rendue (voir lib/render-document-pages.ts) televersee directement
// du navigateur de l'enseignant vers Supabase Storage - jamais via une
// Server Action Next.js, donc aucun plafond de body/plateforme applicable
// ici (voir lib/live-document-limits.ts). Chemin
// "{live_session_id}/{document_id}/page-{n}.jpg" : le premier segment doit
// matcher l'id de la seance pour la policy RLS de storage.objects (voir la
// migration).
export async function uploadLiveDocumentPage(
  supabase: SupabaseClient,
  liveSessionId: string,
  documentId: string,
  numeroPage: number,
  page: Blob,
): Promise<{ url: string } | { error: string }> {
  const chemin = `${liveSessionId}/${documentId}/page-${numeroPage}.jpg`;
  const { error } = await supabase.storage
    .from("seance-documents")
    .upload(chemin, page, { contentType: "image/jpeg", upsert: true });
  if (error) return { error: error.message };
  const { data } = supabase.storage.from("seance-documents").getPublicUrl(chemin);
  return { url: data.publicUrl };
}

// Partage un nouveau document (ou remplace celui deja partage) - toujours
// remis a la page 1, jamais de reprise sur l'ancienne position d'un
// document different.
export async function partagerDocument(
  supabase: SupabaseClient,
  liveSessionId: string,
  professeurId: string,
  nomFichier: string,
  pages: string[],
): Promise<{ error: string } | { error?: undefined }> {
  const { error } = await supabase.from("live_session_documents").upsert({
    live_session_id: liveSessionId,
    professeur_id: professeurId,
    nom_fichier: nomFichier,
    pages,
    page_courante: 1,
    updated_at: new Date().toISOString(),
  });
  return error ? { error: error.message } : {};
}

export async function changerPage(
  supabase: SupabaseClient,
  liveSessionId: string,
  page: number,
): Promise<{ error: string } | { error?: undefined }> {
  const { error } = await supabase
    .from("live_session_documents")
    .update({ page_courante: page, updated_at: new Date().toISOString() })
    .eq("live_session_id", liveSessionId);
  return error ? { error: error.message } : {};
}

// N'efface QUE la ligne de suivi (page courante/document actif) - les
// fichiers deja televerses restent en Storage (meme simplification que
// lecons-documents/photos-reception : jamais de nettoyage retroactif quand
// une reference est retiree, cout de complexite pas justifie a cette
// echelle). Un nouveau partage ecrasera de toute facon les references
// suivies au prochain upsert.
export async function arreterPartage(supabase: SupabaseClient, liveSessionId: string): Promise<{ error: string } | { error?: undefined }> {
  const { error } = await supabase.from("live_session_documents").delete().eq("live_session_id", liveSessionId);
  return error ? { error: error.message } : {};
}

// Abonnement temps reel : un eleve qui a deja la page ouverte voit le
// document partage, le changement de page, et l'arret du partage sans
// recharger. Suffixe aleatoire par abonnement (meme necessite que
// Madrasa CI/AtlasLab ailleurs dans ce projet) : si jamais deux composants
// s'abonnaient au meme nom de canal, Supabase Realtime refuse d'ajouter un
// second callback postgres_changes apres le premier subscribe().
export function subscribeLiveDocument(
  supabase: SupabaseClient,
  liveSessionId: string,
  onChange: (doc: LiveDocument | null) => void,
): () => void {
  const suffixe = Math.random().toString(36).slice(2);
  const channel = supabase
    .channel(`live-document-${liveSessionId}-${suffixe}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "live_session_documents", filter: `live_session_id=eq.${liveSessionId}` },
      (payload) => {
        if (payload.eventType === "DELETE") {
          onChange(null);
        } else {
          onChange(fromRow(payload.new as LiveDocumentRow));
        }
      },
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
