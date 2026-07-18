// Calcule le contraste WCAG d'une couleur hex face au blanc (#ffffff), utilise pour
// valider la couleur de marque d'un etablissement (fond de .btn-primary / texte de .btn-link).
function relativeLuminance(hex: string): number | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  const int = parseInt(match[1], 16);
  const channels = [(int >> 16) & 255, (int >> 8) & 255, int & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

export function contrastRatioWithWhite(hex: string): number | null {
  const luminance = relativeLuminance(hex);
  if (luminance === null) return null;
  return 1.05 / (luminance + 0.05);
}

// Seuil WCAG AA pour du texte normal (boutons/liens utilisant cette couleur comme fond ou texte).
export const MIN_CONTRAST_RATIO = 4.5;

export function hasSufficientContrast(hex: string): boolean {
  const ratio = contrastRatioWithWhite(hex);
  return ratio !== null && ratio >= MIN_CONTRAST_RATIO;
}
