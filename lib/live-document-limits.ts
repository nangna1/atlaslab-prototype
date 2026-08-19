// Limites du partage de document en direct (2026-08-19, voir DocumentPartage.tsx
// et la migration 20260819000000_live_session_documents.sql pour le contexte
// complet). Contrairement a lib/document-limits.ts (import de cours par IA,
// vrai plafond de la plateforme Vercel a respecter), ici le PDF original
// n'est JAMAIS transmis au serveur - il est lu et rendu entierement dans le
// navigateur de l'enseignant (pdfjs-dist cote client, jamais cote Node -
// voir lib/document-text.ts pour pourquoi ce meme paquet cote serveur avait
// pose probleme). Seules les pages deja rendues en image sont televersees,
// une par une, directement du navigateur vers Supabase Storage (jamais via
// une Server Action Next.js). Ces limites protegent donc le navigateur et
// l'experience des eleves (temps de chargement mobile), pas un plafond de
// plateforme.

// Fichier source (PDF/image) avant rendu - genereux (pas de contrainte de
// body Vercel ici) mais borne quand meme : un PDF de plusieurs centaines de
// Mo bloquerait l'onglet de l'enseignant le temps du rendu.
export const MAX_LIVE_DOCUMENT_SIZE_MB = 40;
export const MAX_LIVE_DOCUMENT_SIZE_BYTES = MAX_LIVE_DOCUMENT_SIZE_MB * 1024 * 1024;

// Nombre de pages rendues - performance de rendu cote navigateur enseignant,
// pas une contrainte d'API externe (contrairement a MAX_PDF_PAGES de
// lib/document-limits.ts, limite reelle de l'API Claude) : valeur choisie
// pour rester coherente avec ce que l'app affiche deja ailleurs.
export const MAX_LIVE_DOCUMENT_PAGES = 80;

// Chaque page est re-encodee en JPEG a cette largeur/qualite maximales avant
// televersement (jamais la resolution native du PDF, souvent bien plus
// lourde) - garde chaque page a quelques centaines de Ko, pour un
// chargement rapide cote eleve meme sur une connexion mobile limitee.
export const RENDU_LARGEUR_MAX_PX = 1600;
export const RENDU_QUALITE_JPEG = 0.82;

export function formatLiveDocumentSize(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(mb < 10 ? 1 : 0)} Mo`;
}
