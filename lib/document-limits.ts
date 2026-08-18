// Limites de televersement pour la generation de cours par IA
// (app/(app)/cours/ImportCourseForm.tsx cote client + actions.ts:
// generateCourseFromDocument cote serveur). Fichier volontairement sans
// dependance lourde pour rester importable des deux cotes.
//
// Deux vraies limites techniques :
// - Taille : PAS le bodySizeLimit Next.js (20 Mo, next.config.ts) comme
//   suppose au premier correctif (2026-08-18 matin) - Vercel impose sa
//   propre limite de plateforme sur le corps d'une requete vers une
//   fonction serverless, 4,5 Mo, **au-dessus de laquelle le body size
//   limit de Next.js n'a plus aucun effet** (voir
//   https://vercel.com/docs/functions/limitations#request-body-size). Un
//   fichier au-dela produit la meme classe de panne cote client
//   ("NetworkError when attempting to fetch resource" en pratique, ou
//   l'ecran generique "Application error" selon le navigateur) - constate
//   reellement en prod (2026-08-18 soir) malgre le premier correctif a
//   16 Mo, qui restait sous le plafond Next.js mais au-dessus du vrai
//   plafond Vercel. La vraie limite est donc 4,5 Mo, pas 20.
// - Pages (PDF) : l'API Claude (Anthropic) refuse un document PDF natif de
//   plus de 100 pages.
//
// On annonce et on applique volontairement 20% en dessous de ces vraies
// limites plutot qu'un seuil colle a la vraie limite : marge de securite
// pour qu'un fichier juste "dans les clous" cote utilisateur (poids
// arrondi affiche par l'OS, export PDF qui ajoute une page de garde, etc.)
// ne tombe jamais pile sur le point de rupture reel.
const REAL_MAX_FILE_SIZE_MB = 4.5;
const REAL_MAX_PDF_PAGES = 100;
const SAFETY_MARGIN = 0.8;

export const MAX_FILE_SIZE_MB = Math.floor(REAL_MAX_FILE_SIZE_MB * SAFETY_MARGIN * 10) / 10; // 3.6 Mo
export const MAX_FILE_SIZE_BYTES = Math.floor(MAX_FILE_SIZE_MB * 1024 * 1024);
export const MAX_PDF_PAGES = Math.floor(REAL_MAX_PDF_PAGES * SAFETY_MARGIN); // 80 pages

export function formatFileSize(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(mb < 10 ? 1 : 0)} Mo`;
}
