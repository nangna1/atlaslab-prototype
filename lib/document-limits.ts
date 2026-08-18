// Limites de televersement pour la generation de cours par IA
// (app/(app)/cours/ImportCourseForm.tsx cote client + actions.ts:
// generateCourseFromDocument cote serveur). Fichier volontairement sans
// dependance lourde pour rester importable des deux cotes.
//
// Deux vraies limites techniques :
// - Taille : plafond de "body" des Server Actions Next.js, fixe a 20 Mo
//   dans next.config.ts (experimental.serverActions.bodySizeLimit). Un
//   fichier au-dela de ce plafond ne produit pas une erreur propre cote
//   serveur (le corps de la requete est rejete par le framework avant
//   d'atteindre generateCourseFromDocument) mais un ecran generique
//   "Application error: a client-side exception has occurred" cote
//   client - constate reellement le 2026-08-18 sur un cours de dessin
//   volumineux. La seule parade fiable est d'empecher l'envoi en amont,
//   cote client, avant que la requete ne parte.
// - Pages (PDF) : l'API Claude (Anthropic) refuse un document PDF natif de
//   plus de 100 pages.
//
// On annonce et on applique volontairement 20% en dessous de ces vraies
// limites plutot qu'un seuil colle a la vraie limite : marge de securite
// pour qu'un fichier juste "dans les clous" cote utilisateur (poids
// arrondi affiche par l'OS, export PDF qui ajoute une page de garde, etc.)
// ne tombe jamais pile sur le point de rupture reel.
const REAL_MAX_FILE_SIZE_MB = 20;
const REAL_MAX_PDF_PAGES = 100;
const SAFETY_MARGIN = 0.8;

export const MAX_FILE_SIZE_MB = Math.floor(REAL_MAX_FILE_SIZE_MB * SAFETY_MARGIN); // 16 Mo
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
export const MAX_PDF_PAGES = Math.floor(REAL_MAX_PDF_PAGES * SAFETY_MARGIN); // 80 pages

export function formatFileSize(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(mb < 10 ? 1 : 0)} Mo`;
}
