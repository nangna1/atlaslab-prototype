import JSZip from "jszip";
import { PDFParse } from "pdf-parse";

// 100 000 caracteres (~25k tokens) : releve de 15 000 (2026-08-11), verifie
// insuffisant sur un echantillon reel de 30 supports de cours fournis par
// l'utilisateur (institut booster) - plusieurs documents texte depassaient
// deja largement 15 000 caracteres a eux seuls (ex: 48 241 caracteres pour
// un cours de beton arme de 72 pages, 266 375 pour un cours d'OGC de 152
// pages), ce qui coupait la tres grande majorite du contenu avant meme
// d'atteindre l'IA. Toujours un plafond (pas illimite) pour rester
// raisonnable en cout/latence d'appel Claude - documents plus longs encore
// tronques avec l'avertissement `truncated` existant.
const MAX_CHARS = 100000;

function truncate(text: string): { text: string; truncated: boolean } {
  const trimmed = text.trim();
  if (trimmed.length <= MAX_CHARS) return { text: trimmed, truncated: false };
  return { text: trimmed.slice(0, MAX_CHARS), truncated: true };
}

async function extractPptxText(buffer: Buffer): Promise<string> {
  // Une pptx est une archive zip OOXML : le texte de chaque diapositive vit
  // dans des balises <a:t> au sein de ppt/slides/slideN.xml. Extraction
  // legere par regex plutot qu'un parseur XML complet -- suffisant pour du
  // texte brut, pas besoin de mise en forme.
  const zip = await JSZip.loadAsync(buffer);
  const slideFiles = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => {
      const na = Number(a.match(/slide(\d+)\.xml/)?.[1] ?? 0);
      const nb = Number(b.match(/slide(\d+)\.xml/)?.[1] ?? 0);
      return na - nb;
    });

  const slideTexts: string[] = [];
  for (const name of slideFiles) {
    const xml = await zip.files[name].async("string");
    const matches = [...xml.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => m[1]);
    if (matches.length > 0) slideTexts.push(matches.join(" "));
  }
  return slideTexts.map((t, i) => `--- Diapositive ${i + 1} ---\n${t}`).join("\n\n");
}

// DOCX et PPTX uniquement (formats bureautiques texte/XML) - PDF et images
// passent desormais par buildNativeDocumentBlock ci-dessous plutot que par
// extraction de texte (voir sa doc pour le pourquoi : beaucoup de vrais
// supports de cours sont des PDF scannes, ou l'extraction de texte ne
// recupere presque rien).
export async function extractDocumentText(
  file: File,
): Promise<{ text: string; truncated: boolean } | { error: string }> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const nameLower = file.name.toLowerCase();

  try {
    if (nameLower.endsWith(".docx") || file.type.includes("wordprocessingml")) {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      return truncate(result.value);
    }

    if (nameLower.endsWith(".pptx") || file.type.includes("presentationml")) {
      const text = await extractPptxText(buffer);
      return truncate(text);
    }

    return { error: "Format non pris en charge par l'extraction de texte (DOCX ou PPTX uniquement)." };
  } catch (err) {
    console.error("Échec extraction texte document :", err);
    return { error: "Impossible de lire ce document — il est peut-être corrompu ou protégé." };
  }
}

// Compte les pages d'un PDF sans en extraire le texte (metadonnee
// structurelle, fiable meme sur un PDF scanne/photographie sans texte
// exploitable - contrairement a l'extraction abandonnee plus haut). Sert
// uniquement a la validation MAX_PDF_PAGES avant l'appel a Claude - un
// echec de comptage ne doit pas bloquer l'import (retourne null, l'appelant
// laisse alors passer et compte sur le controle de l'API Claude elle-meme).
export async function countPdfPages(buffer: Buffer): Promise<number | null> {
  try {
    const parser = new PDFParse({ data: buffer });
    const info = await parser.getInfo();
    await parser.destroy();
    return info.total ?? null;
  } catch (err) {
    console.error("Échec comptage des pages PDF :", err);
    return null;
  }
}

type ImageMediaType = "image/jpeg" | "image/png" | "image/webp";

const IMAGE_MEDIA_TYPES: Record<string, ImageMediaType> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

export type NativeDocumentBlock =
  | { type: "document"; source: { type: "base64"; media_type: "application/pdf"; data: string } }
  | { type: "image"; source: { type: "base64"; media_type: ImageMediaType; data: string } };

// PDF et images (2026-08-11, demande utilisateur : accepter les vrais
// supports de cours, dont plusieurs PDF scannes/photographies - verifie
// reellement sur un echantillon de 30 documents, ex. "COURS MAGISTRAL DE
// BARRAGES L3.pdf" : 87 pages mais seulement 1849 caracteres de texte
// extractible via pdf-parse, le reste etant des images de diapositives
// scannees). Plutot que d'extraire du texte (qui echoue silencieusement sur
// ce genre de document), le fichier est envoye tel quel a Claude comme bloc
// "document"/"image" natif : le modele le LIT visuellement (comme un humain
// feuilletterait un PDF scanne), ce qui fonctionne aussi bien sur du texte
// natif que sur du contenu scanne/photographie. Limite Claude documentee :
// 32 Mo par document - le plafond de taille de Server Action (voir
// next.config.ts, 20mb) est deja plus bas, donc jamais atteinte ici.
export function buildNativeDocumentBlock(file: File, buffer: Buffer): NativeDocumentBlock | { error: string } {
  const nameLower = file.name.toLowerCase();
  const data = buffer.toString("base64");

  if (nameLower.endsWith(".pdf") || file.type === "application/pdf") {
    return { type: "document", source: { type: "base64", media_type: "application/pdf", data } };
  }

  const ext = Object.keys(IMAGE_MEDIA_TYPES).find((e) => nameLower.endsWith(e));
  if (ext) {
    return { type: "image", source: { type: "base64", media_type: IMAGE_MEDIA_TYPES[ext], data } };
  }

  return { error: "Format non pris en charge pour la lecture native (PDF, JPG, PNG ou WEBP)." };
}
