import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rate-limit";
import { buildSystemPrompt } from "@/lib/assistant-knowledge";
import { isValidLocale, DEFAULT_LOCALE } from "@/lib/i18n/config";

// Assistant IA d'aide a l'utilisation d'AtlasLab (bouton flottant, tous
// roles connectes -- voir app/AiAssistant.tsx). Reponse en streaming texte
// brut (pas de SSE : le client lit directement le corps de la reponse).
//
// Historique persiste dans assistant_messages (20260809000000), un par
// utilisateur -- GET le recupere, POST y ajoute la question et la reponse,
// DELETE l'efface ("Effacer la conversation" cote client). Les inserts
// passent par le client Supabase de l'utilisateur (pas l'admin) pour rester
// couverts par la RLS de la table comme le reste du code d'ecriture.

const anthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) : null;

const MAX_MESSAGES_PAR_REQUETE = 20;
const MAX_CARACTERES_PAR_MESSAGE = 4000;
const MAX_HISTORIQUE_CHARGE = 50;

type ChatMessage = { role: "user" | "assistant"; content: string };

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

async function getAuthedContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase.from("users").select("role, tenant_id").eq("id", user.id).single();
  if (!profile) return null;

  return { supabase, user, profile };
}

export async function GET() {
  const ctx = await getAuthedContext();
  if (!ctx) return jsonError("Non authentifie.", 401);

  const { data, error } = await ctx.supabase
    .from("assistant_messages")
    .select("id, role, content, created_at")
    .eq("user_id", ctx.user.id)
    .order("created_at", { ascending: true })
    .limit(MAX_HISTORIQUE_CHARGE);

  if (error) return jsonError("Impossible de charger l'historique.", 500);
  return Response.json({ messages: data });
}

export async function DELETE() {
  const ctx = await getAuthedContext();
  if (!ctx) return jsonError("Non authentifie.", 401);

  const { error } = await ctx.supabase.from("assistant_messages").delete().eq("user_id", ctx.user.id);
  if (error) return jsonError("Impossible d'effacer l'historique.", 500);
  return Response.json({ ok: true });
}

export async function POST(request: Request) {
  const ctx = await getAuthedContext();
  if (!ctx) return jsonError("Non authentifie.", 401);
  const { supabase, user, profile } = ctx;

  if (!anthropic) return jsonError("Assistant IA non configure sur cette plateforme (cle API manquante).", 503);

  const admin = createAdminClient();
  const dansLaLimite = await checkRateLimit(admin, `assistant:${user.id}`, { max: 30, fenetreMinutes: 60 });
  if (!dansLaLimite) {
    return jsonError("Trop de messages envoyes a l'assistant en une heure. Reessayez plus tard.", 429);
  }

  let body: { messages?: unknown; moduleTitle?: unknown; moduleDescription?: unknown; locale?: unknown };
  try {
    body = await request.json();
  } catch {
    return jsonError("Requete invalide.", 400);
  }

  const rawMessages = Array.isArray(body.messages) ? body.messages : [];
  if (rawMessages.length === 0 || rawMessages.length > MAX_MESSAGES_PAR_REQUETE) {
    return jsonError("Nombre de messages invalide.", 400);
  }

  const messages: ChatMessage[] = [];
  for (const m of rawMessages) {
    const roleOk =
      !!m &&
      typeof m === "object" &&
      ((m as { role?: unknown }).role === "user" || (m as { role?: unknown }).role === "assistant");
    const contentOk = roleOk && typeof (m as { content?: unknown }).content === "string";
    if (!contentOk) return jsonError("Message invalide.", 400);
    const content = (m as { content: string }).content.slice(0, MAX_CARACTERES_PAR_MESSAGE);
    messages.push({ role: (m as { role: "user" | "assistant" }).role, content });
  }
  const dernierMessage = messages[messages.length - 1];
  if (dernierMessage.role !== "user") {
    return jsonError("Le dernier message doit venir de l'utilisateur.", 400);
  }

  const moduleTitle = typeof body.moduleTitle === "string" ? body.moduleTitle.slice(0, 200) : "AtlasLab";
  const moduleDescription =
    typeof body.moduleDescription === "string" ? body.moduleDescription.slice(0, 500) : "";
  const locale = isValidLocale(typeof body.locale === "string" ? body.locale : undefined)
    ? (body.locale as string)
    : DEFAULT_LOCALE;

  // Sauvegarde la question avant d'appeler Anthropic : meme si le streaming
  // echoue ensuite, la question de l'utilisateur reste dans son historique.
  // Non bloquant pour la conversation elle-meme : une erreur d'ecriture ne
  // doit pas empecher l'assistant de repondre.
  const { error: saveUserErr } = await supabase.from("assistant_messages").insert({
    tenant_id: profile.tenant_id,
    user_id: user.id,
    role: "user",
    content: dernierMessage.content,
    module_title: moduleTitle,
  });
  if (saveUserErr) console.error("assistant: echec sauvegarde message utilisateur", saveUserErr);

  const system = buildSystemPrompt({ role: profile.role, moduleTitle, moduleDescription, locale });

  const encoder = new TextEncoder();
  let accumulated = "";
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const messageStream = anthropic!.messages.stream({
        model: "claude-sonnet-5",
        max_tokens: 700,
        system,
        messages,
      });
      messageStream.on("text", (delta) => {
        accumulated += delta;
        controller.enqueue(encoder.encode(delta));
      });
      messageStream.on("end", () => {
        void (async () => {
          if (accumulated) {
            const { error: saveAssistantErr } = await supabase.from("assistant_messages").insert({
              tenant_id: profile.tenant_id,
              user_id: user.id,
              role: "assistant",
              content: accumulated,
              module_title: moduleTitle,
            });
            if (saveAssistantErr) console.error("assistant: echec sauvegarde reponse", saveAssistantErr);
          }
          controller.close();
        })();
      });
      messageStream.on("error", (err) => {
        console.error("assistant stream error", err);
        controller.error(err);
      });
    },
    cancel() {
      // rien a nettoyer : la requete Anthropic sous-jacente se termine
      // naturellement, pas de handle explicite a fermer ici.
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
