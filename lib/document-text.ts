import JSZip from "jszip";

const MAX_CHARS = 15000;

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

export async function extractDocumentText(
  file: File,
): Promise<{ text: string; truncated: boolean } | { error: string }> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const nameLower = file.name.toLowerCase();

  try {
    if (nameLower.endsWith(".pdf") || file.type === "application/pdf") {
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: buffer });
      const result = await parser.getText();
      await parser.destroy();
      return truncate(result.text);
    }

    if (nameLower.endsWith(".docx") || file.type.includes("wordprocessingml")) {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      return truncate(result.value);
    }

    if (nameLower.endsWith(".pptx") || file.type.includes("presentationml")) {
      const text = await extractPptxText(buffer);
      return truncate(text);
    }

    return { error: "Format non pris en charge (PDF, DOCX ou PPTX uniquement — .doc/.ppt binaires anciens non supportés)." };
  } catch {
    return { error: "Impossible de lire ce document — il est peut-être corrompu ou protégé." };
  }
}
