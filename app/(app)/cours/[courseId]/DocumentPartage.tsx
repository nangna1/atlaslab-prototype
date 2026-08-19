"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  arreterPartage,
  changerPage,
  getLiveDocument,
  partagerDocument,
  subscribeLiveDocument,
  uploadLiveDocumentPage,
  type LiveDocument,
} from "@/lib/live-document";
import {
  MAX_LIVE_DOCUMENT_PAGES,
  MAX_LIVE_DOCUMENT_SIZE_BYTES,
  MAX_LIVE_DOCUMENT_SIZE_MB,
  formatLiveDocumentSize,
} from "@/lib/live-document-limits";

/** Document partage pendant une seance en direct (2026-08-19, demande
 * utilisateur : "permettre au professeur l'ajout d'un fichier PDF/image
 * pendant le direct, visible sur l'ecran de tous les apprenants, defilement
 * controle par le professeur"). PDF et images uniquement (voir
 * lib/live-document-limits.ts pour pourquoi Word/Excel/PowerPoint sont hors
 * perimetre). Rendu du PDF en pages-images entierement cote navigateur
 * (lib/render-document-pages.ts), synchronisation de la page affichee via
 * Supabase Realtime (lib/live-document.ts) - aucune Server Action Next.js
 * dans ce flux, tout se fait directement navigateur <-> Supabase. */
export default function DocumentPartage({
  liveSessionId,
  estProfesseurTitulaire,
  professeurId,
}: {
  liveSessionId: string;
  estProfesseurTitulaire: boolean;
  professeurId: string;
}) {
  const [doc, setDoc] = useState<LiveDocument | null>(null);
  const [chargement, setChargement] = useState(true);
  const [enCours, setEnCours] = useState(false);
  const [progression, setProgression] = useState<{ actuelle: number; total: number } | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let annule = false;
    getLiveDocument(supabase, liveSessionId).then((initial) => {
      if (!annule) {
        setDoc(initial);
        setChargement(false);
      }
    });
    const desabonner = subscribeLiveDocument(supabase, liveSessionId, (mise_a_jour) => setDoc(mise_a_jour));
    return () => {
      annule = true;
      desabonner();
    };
  }, [liveSessionId]);

  async function handleFichier(e: React.ChangeEvent<HTMLInputElement>) {
    const fichier = e.target.files?.[0];
    e.target.value = "";
    if (!fichier) return;
    setErreur(null);

    if (fichier.size > MAX_LIVE_DOCUMENT_SIZE_BYTES) {
      setErreur(`Document trop volumineux (${formatLiveDocumentSize(fichier.size)}) — ${MAX_LIVE_DOCUMENT_SIZE_MB} Mo maximum.`);
      return;
    }

    setEnCours(true);
    const supabase = createClient();
    const documentId = crypto.randomUUID();

    try {
      // Import dynamique : pdfjs-dist (import statique depuis
      // lib/render-document-pages.ts) est lourd et n'a besoin d'etre charge
      // que par un enseignant qui partage effectivement un document, jamais
      // par un eleve ni par un enseignant qui ne s'en sert pas cette
      // session-la.
      const { rendrePagesDepuisPdf, rendreImageUnique } = await import("@/lib/render-document-pages");
      const pages = fichier.type === "application/pdf"
        ? await rendrePagesDepuisPdf(fichier)
        : [await rendreImageUnique(fichier)];

      if (pages.length > MAX_LIVE_DOCUMENT_PAGES) {
        setErreur(`Document trop long (${pages.length} pages) — ${MAX_LIVE_DOCUMENT_PAGES} pages maximum.`);
        return;
      }

      const urls: string[] = [];
      for (let i = 0; i < pages.length; i++) {
        setProgression({ actuelle: i + 1, total: pages.length });
        const televerse = await uploadLiveDocumentPage(supabase, liveSessionId, documentId, i + 1, pages[i]);
        if ("error" in televerse) {
          setErreur(televerse.error);
          return;
        }
        urls.push(televerse.url);
      }

      const partage = await partagerDocument(supabase, liveSessionId, professeurId, fichier.name, urls);
      if (partage.error) setErreur(partage.error);
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Échec du traitement du document.");
    } finally {
      setEnCours(false);
      setProgression(null);
    }
  }

  async function allerPage(page: number) {
    if (!doc || page < 1 || page > doc.pages.length) return;
    await changerPage(createClient(), liveSessionId, page);
  }

  async function arreter() {
    await arreterPartage(createClient(), liveSessionId);
  }

  if (chargement) return null;

  if (!doc) {
    if (!estProfesseurTitulaire) return null;
    return (
      <div className="mt-3 rounded-lg border border-dashed p-4" style={{ borderColor: "var(--line)" }}>
        <label className="btn-secondary inline-block cursor-pointer">
          {enCours
            ? progression
              ? `Traitement... (${progression.actuelle}/${progression.total})`
              : "Traitement..."
            : "Partager un document (PDF ou image)"}
          <input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
            onChange={handleFichier}
            disabled={enCours}
            className="hidden"
          />
        </label>
        <p className="mt-1 text-xs text-gray-400">
          {MAX_LIVE_DOCUMENT_SIZE_MB} Mo et {MAX_LIVE_DOCUMENT_PAGES} pages maximum pour un PDF. Word/Excel/PowerPoint :
          convertissez en PDF avant de televerser.
        </p>
        {erreur && <p className="mt-1 text-sm text-red-600">{erreur}</p>}
      </div>
    );
  }

  const pageUrl = doc.pages[doc.pageCourante - 1];

  return (
    <div className="mt-3 overflow-hidden rounded-lg border" style={{ borderColor: "var(--line)" }}>
      <div className="flex items-center justify-between gap-2 border-b bg-gray-50 px-3 py-2" style={{ borderColor: "var(--line)" }}>
        <span className="truncate text-sm text-gray-700">{doc.nomFichier}</span>
        {estProfesseurTitulaire ? (
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => allerPage(doc.pageCourante - 1)}
              disabled={doc.pageCourante <= 1}
              className="btn-link text-sm disabled:opacity-30"
              aria-label="Page précédente"
            >
              ‹
            </button>
            <span className="text-xs text-gray-500">
              {doc.pageCourante} / {doc.pages.length}
            </span>
            <button
              type="button"
              onClick={() => allerPage(doc.pageCourante + 1)}
              disabled={doc.pageCourante >= doc.pages.length}
              className="btn-link text-sm disabled:opacity-30"
              aria-label="Page suivante"
            >
              ›
            </button>
            <button type="button" onClick={arreter} className="text-xs text-red-600 hover:underline">
              Arrêter le partage
            </button>
          </div>
        ) : (
          <span className="shrink-0 text-xs text-gray-400">
            Page {doc.pageCourante} / {doc.pages.length}
          </span>
        )}
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element -- image distante Supabase Storage, next/image demanderait un domaine configure a l'avance pour un bucket qui varie par tenant */}
      <img src={pageUrl} alt={`${doc.nomFichier} — page ${doc.pageCourante}`} className="w-full" />
      {estProfesseurTitulaire && erreur && <p className="px-3 py-2 text-sm text-red-600">{erreur}</p>}
    </div>
  );
}
