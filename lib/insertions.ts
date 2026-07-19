export const INSERTION_STATUTS = [
  "en_recherche",
  "stage",
  "emploi",
  "entrepreneuriat",
  "poursuite_etudes",
  "sans_nouvelles",
] as const;

export type InsertionStatut = (typeof INSERTION_STATUTS)[number];

export const INSERTION_STATUT_LABELS: Record<InsertionStatut, string> = {
  en_recherche: "En recherche d'emploi",
  stage: "En stage",
  emploi: "En emploi",
  entrepreneuriat: "Entrepreneuriat",
  poursuite_etudes: "Poursuite d'études",
  sans_nouvelles: "Sans nouvelles",
};

// Pas une valeur en base — represente l'absence de toute ligne
// insertions_professionnelles pour ce diplome, cote affichage uniquement.
export const NON_RENSEIGNE = "non_renseigne" as const;
export const NON_RENSEIGNE_LABEL = "Non renseigné";

export function isValidInsertionStatut(value: string): value is InsertionStatut {
  return (INSERTION_STATUTS as readonly string[]).includes(value);
}
