import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  if (!resend) {
    console.warn("RESEND_API_KEY non configuré — email ignoré :", subject, "->", to);
    return;
  }
  try {
    const { error } = await resend.emails.send({
      from: "AtlasLab <onboarding@resend.dev>",
      to,
      subject,
      html,
    });
    if (error) console.error("Échec envoi email :", error.message, "->", to);
  } catch (err) {
    console.error("Échec envoi email :", err);
  }
}
