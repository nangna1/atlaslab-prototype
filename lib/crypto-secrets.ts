import crypto from "node:crypto";

// Chiffrement au repos des identifiants marchand par etablissement (voir
// lib/tenant-cinetpay.ts) -- contrairement au reste du projet ("config
// absente = warn + no-op", voir lib/whatsapp.ts/lib/jaas.ts), une cle de
// chiffrement absente ou mal formee doit faire echouer bruyamment : un
// echec silencieux masquerait un vrai risque (stockage en clair par erreur,
// ou impossibilite de dechiffrer des identifiants deja enregistres).
function getKey(): Buffer {
  // .trim() : un espace ou saut de ligne parasite est facile a introduire en
  // collant cette valeur dans un champ de secret (GitHub Actions, Vercel...),
  // sans consequence sur la securite du chiffrement lui-meme.
  const hex = process.env.TENANT_SECRETS_ENCRYPTION_KEY?.trim();
  if (!hex || hex.length !== 64) {
    throw new Error(
      "TENANT_SECRETS_ENCRYPTION_KEY manquante ou invalide (attendu : 64 caractères hex, 32 octets).",
    );
  }
  return Buffer.from(hex, "hex");
}

/** Format stocke : iv.authTag.ciphertext (chaque segment en base64). */
export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv, authTag, encrypted].map((b) => b.toString("base64")).join(".");
}

export function decryptSecret(stored: string): string {
  const [ivB64, tagB64, dataB64] = stored.split(".");
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error("Valeur chiffrée mal formée.");
  }
  const decipher = crypto.createDecipheriv("aes-256-gcm", getKey(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]).toString("utf8");
}
