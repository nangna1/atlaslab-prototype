import crypto from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendWhatsAppText, downloadWhatsAppMedia, normalizePhone } from "@/lib/whatsapp";
import { getPendingAssignments, formatAssignmentList } from "@/lib/whatsapp-devoirs";
import { logAudit } from "@/lib/audit";

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;
const APP_SECRET = process.env.WHATSAPP_APP_SECRET;

// Verification d'abonnement du webhook (une fois, lors de la configuration
// dans Meta App Dashboard).
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token && VERIFY_TOKEN && token === VERIFY_TOKEN) {
    return new NextResponse(challenge ?? "", { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

function verifySignature(rawBody: string, signatureHeader: string | null): boolean {
  if (!APP_SECRET || !signatureHeader) return false;
  const expected = "sha256=" + crypto.createHmac("sha256", APP_SECRET).update(rawBody).digest("hex");
  if (expected.length !== signatureHeader.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader));
}

type IncomingMessage = {
  from: string;
  type: string;
  text?: { body: string };
  image?: { id: string; mime_type?: string };
};

export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  // Meta desactive un webhook qui ne repond pas 200 rapidement et de facon
  // fiable -- on repond toujours 200, meme sur une signature invalide (pas de
  // detail qui pourrait aider un tiers a deviner le secret), et on ne laisse
  // jamais une erreur de traitement remonter en non-200.
  if (!verifySignature(rawBody, request.headers.get("x-hub-signature-256"))) {
    return NextResponse.json({ ok: true });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: true });
  }

  try {
    await handleWebhookPayload(payload);
  } catch (err) {
    console.error("Erreur traitement webhook WhatsApp devoirs :", err);
  }

  return NextResponse.json({ ok: true });
}

async function handleWebhookPayload(payload: unknown) {
  const entry = (payload as { entry?: unknown[] })?.entry;
  if (!Array.isArray(entry)) return;

  for (const e of entry) {
    const changes = (e as { changes?: unknown[] })?.changes;
    if (!Array.isArray(changes)) continue;

    for (const change of changes) {
      const messages = (change as { value?: { messages?: IncomingMessage[] } })?.value?.messages;
      if (!Array.isArray(messages)) continue;

      for (const message of messages) {
        await handleMessage(message);
      }
    }
  }
}

async function handleMessage(message: IncomingMessage) {
  const admin = createAdminClient();
  const phone = normalizePhone(message.from);

  const { data: candidates } = await admin
    .from("users")
    .select("id, nom, tenant_id, telephone")
    .eq("role", "apprenant");
  const student = (candidates ?? []).find((c) => c.telephone && normalizePhone(c.telephone) === phone);

  if (!student) {
    await sendWhatsAppText({
      to: phone,
      text: "Numéro non reconnu par AtlasLab. Ajoutez ce numéro dans votre profil (menu \"Mon profil\" une fois connecté) pour pouvoir envoyer vos devoirs par WhatsApp.",
    });
    return;
  }

  const { data: attente } = await admin
    .from("whatsapp_devoir_attente")
    .select("assignment_ids, selected_assignment_id")
    .eq("telephone", phone)
    .maybeSingle();

  if (message.type === "image" && message.image) {
    await handleImageMessage(admin, student, phone, message.image, attente);
    return;
  }

  if (message.type === "text" && message.text) {
    await handleTextMessage(admin, student, phone, message.text.body, attente);
    return;
  }

  await sendWhatsAppText({
    to: phone,
    text: "Envoyez le numéro du devoir souhaité (texte) puis la photo de votre devoir (image).",
  });
}

type Student = { id: string; nom: string; tenant_id: string | null };
type Attente = { assignment_ids: string[]; selected_assignment_id: string | null } | null;

async function handleTextMessage(
  admin: ReturnType<typeof createAdminClient>,
  student: Student,
  phone: string,
  text: string,
  attente: Attente,
) {
  const asNumber = Number(text.trim());
  if (attente && Number.isInteger(asNumber) && asNumber >= 1 && asNumber <= attente.assignment_ids.length) {
    const chosenId = attente.assignment_ids[asNumber - 1];
    await admin
      .from("whatsapp_devoir_attente")
      .upsert({ telephone: phone, user_id: student.id, assignment_ids: attente.assignment_ids, selected_assignment_id: chosenId, updated_at: new Date().toISOString() });
    await sendWhatsAppText({ to: phone, text: "Envoyez maintenant la photo de votre devoir." });
    return;
  }

  const pending = await getPendingAssignments(admin, student.id);
  if (pending.length === 0) {
    await sendWhatsAppText({ to: phone, text: "Vous n'avez aucun devoir en attente pour le moment." });
    return;
  }
  if (pending.length === 1) {
    await sendWhatsAppText({
      to: phone,
      text: `Vous avez un devoir en attente : "${pending[0].titre}" (${pending[0].courseTitre}). Envoyez directement la photo.`,
    });
    return;
  }

  await admin.from("whatsapp_devoir_attente").upsert({
    telephone: phone,
    user_id: student.id,
    assignment_ids: pending.map((a) => a.id),
    selected_assignment_id: null,
    updated_at: new Date().toISOString(),
  });
  await sendWhatsAppText({
    to: phone,
    text: `Plusieurs devoirs sont en attente. Répondez avec le numéro correspondant :\n${formatAssignmentList(pending)}`,
  });
}

async function handleImageMessage(
  admin: ReturnType<typeof createAdminClient>,
  student: Student,
  phone: string,
  image: { id: string; mime_type?: string },
  attente: Attente,
) {
  let assignmentId = attente?.selected_assignment_id ?? null;
  let assignmentTitre = "";
  let courseTitre = "";

  const pending = await getPendingAssignments(admin, student.id);

  if (assignmentId) {
    const match = pending.find((a) => a.id === assignmentId);
    if (!match) {
      // Deja soumis entre-temps (ex. depuis l'appli) ou devoir invalide.
      assignmentId = null;
    } else {
      assignmentTitre = match.titre;
      courseTitre = match.courseTitre;
    }
  }

  if (!assignmentId) {
    if (pending.length === 0) {
      await sendWhatsAppText({ to: phone, text: "Vous n'avez aucun devoir en attente pour le moment." });
      return;
    }
    if (pending.length > 1) {
      await admin.from("whatsapp_devoir_attente").upsert({
        telephone: phone,
        user_id: student.id,
        assignment_ids: pending.map((a) => a.id),
        selected_assignment_id: null,
        updated_at: new Date().toISOString(),
      });
      await sendWhatsAppText({
        to: phone,
        text: `Plusieurs devoirs sont en attente. Répondez d'abord avec le numéro correspondant :\n${formatAssignmentList(pending)}`,
      });
      return;
    }
    assignmentId = pending[0].id;
    assignmentTitre = pending[0].titre;
    courseTitre = pending[0].courseTitre;
  }

  const media = await downloadWhatsAppMedia(image.id);
  if (!media) {
    await sendWhatsAppText({ to: phone, text: "Échec de réception de la photo, réessayez." });
    return;
  }

  const ext = media.mimeType.includes("png") ? "png" : "jpg";
  const path = `${student.tenant_id}/${assignmentId}/${student.id}-${Date.now()}.${ext}`;
  const { error: uploadError } = await admin.storage
    .from("devoirs-soumissions")
    .upload(path, Buffer.from(media.bytes), { contentType: media.mimeType });

  if (uploadError) {
    await sendWhatsAppText({ to: phone, text: "Échec de l'enregistrement de la photo, réessayez." });
    return;
  }

  const { data: publicUrlData } = admin.storage.from("devoirs-soumissions").getPublicUrl(path);

  await admin.from("submissions").upsert(
    {
      assignment_id: assignmentId,
      user_id: student.id,
      contenu: "Envoyé via WhatsApp",
      fichier_url: publicUrlData.publicUrl,
      submitted_at: new Date().toISOString(),
    },
    { onConflict: "assignment_id,user_id" },
  );

  await admin.from("whatsapp_devoir_attente").delete().eq("telephone", phone);

  await logAudit(admin, {
    acteurId: student.id,
    tenantId: student.tenant_id,
    action: "devoir_soumis_whatsapp",
    cibleType: "submission",
    cibleId: assignmentId,
    details: { devoir: assignmentTitre },
  });

  await sendWhatsAppText({
    to: phone,
    text: `✅ Devoir envoyé pour "${assignmentTitre}" (${courseTitre}). Votre professeur pourra le consulter et le noter.`,
  });
}
