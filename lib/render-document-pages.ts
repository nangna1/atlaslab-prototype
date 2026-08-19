// Rendu de document en pages-images, ENTIEREMENT cote navigateur - jamais
// importe depuis un composant serveur (utilise document/canvas/Image, des
// API navigateur). pdfjs-dist tourne ici dans le vrai navigateur de
// l'enseignant, qui fournit nativement DOMMatrix/Canvas - aucun rapport
// avec l'echec deja rencontre de ce meme paquet cote SERVEUR (Node
// serverless, sans ces API navigateur, voir lib/document-text.ts) : ce
// n'est pas le meme risque, le meme paquet ne se comporte pas pareil selon
// l'environnement d'execution.
import * as pdfjsLib from "pdfjs-dist";
import { RENDU_LARGEUR_MAX_PX, RENDU_QUALITE_JPEG } from "./live-document-limits";

// Copie manuelle depuis node_modules/pdfjs-dist/build/pdf.worker.min.mjs
// vers public/ (voir ce fichier) - a resynchroniser si pdfjs-dist est mis a
// jour un jour (la version du worker doit toujours matcher exactement la
// version du paquet, sinon pdfjs-dist refuse de charger le document).
pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

function canvasVersBlobJpeg(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Échec de l'encodage de la page en image."))),
      "image/jpeg",
      RENDU_QUALITE_JPEG,
    );
  });
}

// Rend chaque page d'un PDF en image JPEG, mise a l'echelle a
// RENDU_LARGEUR_MAX_PX de large (jamais la resolution native du PDF,
// souvent bien plus lourde) - retourne les blobs dans l'ordre des pages.
export async function rendrePagesDepuisPdf(fichier: File): Promise<Blob[]> {
  const buffer = await fichier.arrayBuffer();
  // .destroy() vit sur la tache de chargement (valeur de retour de
  // getDocument avant d'attendre .promise), pas sur le PDFDocumentProxy
  // resolu - garder les deux references separement.
  const tache = pdfjsLib.getDocument({ data: buffer });
  const pdf = await tache.promise;
  const pages: Blob[] = [];

  try {
    for (let numero = 1; numero <= pdf.numPages; numero++) {
      const page = await pdf.getPage(numero);
      const viewportBase = page.getViewport({ scale: 1 });
      const echelle = RENDU_LARGEUR_MAX_PX / viewportBase.width;
      const viewport = page.getViewport({ scale: echelle });

      const canvas = document.createElement("canvas");
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);

      await page.render({ canvas, viewport }).promise;
      pages.push(await canvasVersBlobJpeg(canvas));
      page.cleanup();
    }
  } finally {
    await tache.destroy();
  }

  return pages;
}

// Meme traitement qu'une page de PDF (redimensionnement + reencodage JPEG)
// pour qu'une image televersee directement suive exactement les memes
// contraintes de poids/coherence qu'une page rendue depuis un PDF.
export async function rendreImageUnique(fichier: File): Promise<Blob> {
  const bitmap = await createImageBitmap(fichier);
  const echelle = Math.min(1, RENDU_LARGEUR_MAX_PX / bitmap.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * echelle);
  canvas.height = Math.round(bitmap.height * echelle);
  const contexte = canvas.getContext("2d");
  if (!contexte) throw new Error("Rendu impossible : canvas 2D non disponible sur ce navigateur.");
  contexte.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvasVersBlobJpeg(canvas);
}
