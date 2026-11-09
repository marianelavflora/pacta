// Un aviso por cada cambio de estado (PAC-42). Cada función busca los datos que necesita en la
// base, arma el link y le avisa a quien corresponde. Nunca tiran error: avisar es secundario.
import type { SupabaseClient } from "@supabase/supabase-js";

import { formatUnits } from "@/lib/amounts";
import { clientUrl, freelancerUrl, receiptUrl } from "@/lib/routes";
import { currencySymbol } from "@/lib/ui/currency";
import { notify, type NotifyOutcome, type Recipient } from "./index";
import type { NotifyEvent } from "./messages";

type Role = "client" | "freelancer";
type Row = Record<string, unknown>;

/** A quién le toca cada aviso. */
const AUDIENCE: Record<NotifyEvent, Role[]> = {
  deposit_received: ["client", "freelancer"],
  milestone_delivered: ["client"],
  review_reminder: ["client"],
  milestone_approved: ["freelancer"],
  auto_release: ["client", "freelancer"],
  milestone_paid: ["freelancer"],
};

/** Dirección pública de la web, para que los links de los mails abran la pantalla correcta. */
export function siteUrl(env: NodeJS.ProcessEnv = process.env): string {
  const explicit = env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  const vercel = env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  return vercel ? `https://${vercel}` : "http://localhost:3000";
}

function linkFor(event: NotifyEvent, role: Role, publicId: string, milestoneId?: string): string {
  const base = siteUrl();
  if (event === "milestone_paid" && milestoneId) return base + receiptUrl(milestoneId);
  return base + (role === "client" ? clientUrl(publicId) : freelancerUrl(publicId));
}

async function load(db: SupabaseClient, agreementId: string, milestoneId?: string) {
  const agreement = await db
    .from("agreements")
    .select("public_id, title, client_currency, client_contact, freelancer_id, total_amount::text")
    .eq("id", agreementId)
    .single();
  if (agreement.error) throw new Error(agreement.error.message);
  const a = agreement.data as unknown as Row;

  const user = await db.from("users").select("name, email").eq("id", a.freelancer_id).single();
  if (user.error) throw new Error(user.error.message);

  let milestone: Row | null = null;
  if (milestoneId) {
    const res = await db.from("milestones").select("title, amount::text").eq("id", milestoneId).single();
    if (res.error) throw new Error(res.error.message);
    milestone = res.data as unknown as Row;
  }
  return { agreement: a, freelancer: user.data as unknown as Row, milestone };
}

/**
 * Chats de Telegram de las dos partes, si se suscribieron al bot. Va aparte de `load` a propósito:
 * si la migración 0004 todavía no corrió, la columna no existe y los avisos siguen saliendo por mail.
 */
export async function loadTelegramChats(
  db: SupabaseClient,
  agreementId: string,
  freelancerId: unknown,
): Promise<Record<Role, string | null>> {
  const chats: Record<Role, string | null> = { client: null, freelancer: null };
  try {
    const a = await db.from("agreements").select("client_telegram_chat_id").eq("id", agreementId).maybeSingle();
    if (!a.error) chats.client = ((a.data as Row | null)?.client_telegram_chat_id as string | null) ?? null;
    const u = await db.from("users").select("telegram_chat_id").eq("id", freelancerId).maybeSingle();
    if (!u.error) chats.freelancer = ((u.data as Row | null)?.telegram_chat_id as string | null) ?? null;
  } catch {
    // Sin chats: el aviso sale por mail.
  }
  return chats;
}

export async function notifyEvent(
  db: SupabaseClient,
  event: NotifyEvent,
  agreementId: string,
  milestoneId?: string,
): Promise<NotifyOutcome[]> {
  try {
    const { agreement, freelancer, milestone } = await load(db, agreementId, milestoneId);
    const currency = agreement.client_currency as string;
    const rawAmount = milestone?.amount ?? agreement.total_amount;
    const amount = `${currencySymbol(currency)} ${formatUnits(BigInt(String(rawAmount)))}`;

    const chats = await loadTelegramChats(db, agreementId, agreement.freelancer_id);
    const recipients: Record<Role, Recipient> = {
      client: {
        name: "cliente",
        email: (agreement.client_contact as string | null) ?? null,
        telegramChatId: chats.client,
      },
      freelancer: {
        name: freelancer.name as string,
        email: (freelancer.email as string | null) ?? null,
        telegramChatId: chats.freelancer,
      },
    };
    return await Promise.all(
      AUDIENCE[event].map((role) =>
        notify(event, recipients[role], {
          agreementTitle: agreement.title as string,
          milestoneTitle: milestone ? (milestone.title as string) : undefined,
          amount,
          link: linkFor(event, role, agreement.public_id as string, milestoneId),
        }),
      ),
    );
  } catch (error) {
    console.error("[notify] no se pudo armar el aviso", event, error instanceof Error ? error.message : error);
    return [];
  }
}

export const onAgreementFunded = (db: SupabaseClient, agreementId: string) =>
  notifyEvent(db, "deposit_received", agreementId);
export const onMilestoneDelivered = (db: SupabaseClient, agreementId: string, milestoneId: string) =>
  notifyEvent(db, "milestone_delivered", agreementId, milestoneId);
export const onReviewReminder = (db: SupabaseClient, agreementId: string, milestoneId: string) =>
  notifyEvent(db, "review_reminder", agreementId, milestoneId);
export const onMilestoneApproved = (db: SupabaseClient, agreementId: string, milestoneId: string) =>
  notifyEvent(db, "milestone_approved", agreementId, milestoneId);
export const onAutoRelease = (db: SupabaseClient, agreementId: string, milestoneId: string) =>
  notifyEvent(db, "auto_release", agreementId, milestoneId);
export const onMilestonePaid = (db: SupabaseClient, agreementId: string, milestoneId: string) =>
  notifyEvent(db, "milestone_paid", agreementId, milestoneId);
