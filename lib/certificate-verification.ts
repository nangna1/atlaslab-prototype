import crypto from "node:crypto";

const SECRET = process.env.CERT_VERIFICATION_SECRET;

// Code opaque et infalsifiable (HMAC), pas de table dediee : l'authenticite
// tient a la signature, l'etat "termine" reste toujours recalcule en direct
// a la verification (voir app/verifier/[code]/page.tsx) -- si les donnees
// sous-jacentes changent depuis (progres supprime, etc.), le certificat
// redevient automatiquement invalide sans rien a synchroniser.
export function signCertificate(userId: string, courseId: string): string | null {
  if (!SECRET) return null;
  const payload = `${userId}:${courseId}`;
  const sig = crypto.createHmac("sha256", SECRET).update(payload).digest("base64url").slice(0, 16);
  return `${Buffer.from(payload, "utf8").toString("base64url")}.${sig}`;
}

export function verifyCertificateCode(code: string): { userId: string; courseId: string } | null {
  if (!SECRET) return null;
  const [payloadB64, sig] = code.split(".");
  if (!payloadB64 || !sig) return null;

  let payload: string;
  try {
    payload = Buffer.from(payloadB64, "base64url").toString("utf8");
  } catch {
    return null;
  }

  const expectedSig = crypto.createHmac("sha256", SECRET).update(payload).digest("base64url").slice(0, 16);
  if (sig.length !== expectedSig.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) return null;

  const [userId, courseId] = payload.split(":");
  if (!userId || !courseId) return null;
  return { userId, courseId };
}
