// Crear (PAC-14) y leer (PAC-15) acuerdos con sus hitos en Supabase.
// Recibe el cliente de la base por parámetro para poder probarlo sin red.
import type { SupabaseClient } from "@supabase/supabase-js";
import { customAlphabet } from "nanoid";
import { sumMilestoneAmounts, type CreateAgreementInput } from "@/lib/validation/agreement";

// Link corto para el cliente: 8 letras y números, sin caracteres que se confunden (0/O, 1/l/I).
const PUBLIC_ID_ALPHABET = "23456789abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ";
export const newPublicId = customAlphabet(PUBLIC_ID_ALPHABET, 8);

// Código de Postgres para "ya existe un valor igual en una columna única".
const UNIQUE_VIOLATION = "23505";
const PUBLIC_ID_ATTEMPTS = 3;

export type CreatedAgreement = {
  id: string;
  publicId: string;
  clientUrl: string;
  totalAmount: bigint;
};

type DbError = { code?: string; message: string } | null;

function fail(step: string, error: NonNullable<DbError>): never {
  throw new Error(`No se pudo ${step}: ${error.message}`);
}

// Busca la usuaria por wallet; si no existe, la crea.
async function findOrCreateUser(
  db: SupabaseClient,
  wallet: string,
  name: string | undefined,
): Promise<string> {
  const found = await db.from("users").select("id").eq("wallet", wallet).maybeSingle();
  if (found.error) fail("buscar a la freelancer", found.error);
  if (found.data) return found.data.id as string;

  const created = await db
    .from("users")
    // name es obligatorio en la base; si no vino, usamos la wallet hasta que lo complete.
    .insert({ wallet, name: name || wallet })
    .select("id")
    .single();
  if (!created.error) return created.data.id as string;

  // Si otro pedido la creó al mismo tiempo, la volvemos a buscar.
  if (created.error.code === UNIQUE_VIOLATION) {
    const again = await db.from("users").select("id").eq("wallet", wallet).single();
    if (again.error) fail("buscar a la freelancer", again.error);
    return again.data.id as string;
  }
  fail("crear a la freelancer", created.error);
}

export async function createAgreement(
  db: SupabaseClient,
  input: CreateAgreementInput,
): Promise<CreatedAgreement> {
  const totalAmount = sumMilestoneAmounts(input.milestones);
  const freelancerId = await findOrCreateUser(db, input.freelancerWallet, input.freelancerName);

  // Guardamos el acuerdo. Si el public_id justo ya existe (muy raro), probamos con otro.
  let agreement: { id: string; public_id: string } | undefined;
  for (let attempt = 1; !agreement; attempt++) {
    const inserted = await db
      .from("agreements")
      .insert({
        public_id: newPublicId(),
        freelancer_id: freelancerId,
        client_contact: input.clientContact,
        title: input.title,
        description: input.description,
        client_currency: input.clientCurrency,
        payout_currency: input.payoutCurrency,
        // numeric(78, 0): va como texto para no perder precisión.
        total_amount: totalAmount.toString(),
      })
      .select("id, public_id")
      .single();
    if (!inserted.error) {
      agreement = inserted.data as { id: string; public_id: string };
    } else if (inserted.error.code !== UNIQUE_VIOLATION || attempt >= PUBLIC_ID_ATTEMPTS) {
      fail("guardar el acuerdo", inserted.error);
    }
  }

  const milestones = await db.from("milestones").insert(
    input.milestones.map((milestone, index) => ({
      agreement_id: agreement.id,
      position: index + 1,
      title: milestone.title,
      amount: milestone.amount.toString(),
      review_days: milestone.reviewDays,
    })),
  );
  if (milestones.error) {
    // Supabase no tiene transacciones desde el cliente: si fallan los hitos,
    // borramos el acuerdo para no dejarlo a medias.
    await db.from("agreements").delete().eq("id", agreement.id);
    fail("guardar los hitos", milestones.error);
  }

  return {
    id: agreement.id,
    publicId: agreement.public_id,
    clientUrl: `/a/${agreement.public_id}`,
    totalAmount,
  };
}

// ---------- Leer un acuerdo (PAC-15) ----------

// Formato del public_id que va en el link. Es más amplio que el alfabeto de
// newPublicId a propósito: un id con buena forma que no existe da 404, no 400.
export const PUBLIC_ID_PATTERN = /^[0-9a-zA-Z]{8}$/;

export function isValidPublicId(value: string): boolean {
  return PUBLIC_ID_PATTERN.test(value);
}

// Lo que ven el cliente y la freelancer. No lleva teléfonos, mails ni el
// contacto del cliente: el link es público. Los montos van como texto.
export type PublicMilestone = {
  id: string;
  position: number;
  title: string;
  amount: string;
  reviewDays: number;
  status: string;
  deliveryUrl: string | null;
  deliveryNote: string | null;
  deliveredAt: string | null;
  approvedAt: string | null;
  paidAt: string | null;
};

export type PublicAgreement = {
  id: string;
  publicId: string;
  title: string;
  description: string | null;
  clientCurrency: string;
  payoutCurrency: string;
  totalAmount: string;
  status: string;
  freelancer: { name: string; wallet: string };
  milestones: PublicMilestone[];
};

// Columnas pedidas a mano (nunca "*"), así no se cuela un dato privado.
const AGREEMENT_COLUMNS =
  "id, public_id, freelancer_id, title, description, client_currency, payout_currency, total_amount, status";
const MILESTONE_COLUMNS =
  "id, position, title, amount, review_days, status, delivery_url, delivery_note, delivered_at, approved_at, paid_at";

// Supabase devuelve numeric como texto. Pasarlo por BigInt confirma que es un
// entero válido; si la base devolviera algo raro, falla en vez de mostrarlo.
function amountText(value: unknown, what: string): string {
  if (typeof value === "string" && /^\d{1,78}$/.test(value)) return BigInt(value).toString();
  if (typeof value === "bigint" && value >= BigInt(0)) return value.toString();
  throw new Error(`El monto ${what} no es válido`);
}

const textOrNull = (value: unknown) => (typeof value === "string" ? value : null);

// Devuelve el acuerdo con sus hitos en orden, o null si no existe.
export async function getAgreementByPublicId(
  db: SupabaseClient,
  publicId: string,
): Promise<PublicAgreement | null> {
  const found = await db
    .from("agreements")
    .select(AGREEMENT_COLUMNS)
    .eq("public_id", publicId)
    .maybeSingle();
  if (found.error) fail("buscar el acuerdo", found.error);
  if (!found.data) return null;
  const agreement = found.data as Record<string, unknown>;

  const freelancer = await db
    .from("users")
    .select("name, wallet")
    .eq("id", agreement.freelancer_id)
    .single();
  if (freelancer.error) fail("buscar a la freelancer", freelancer.error);

  const milestones = await db
    .from("milestones")
    .select(MILESTONE_COLUMNS)
    .eq("agreement_id", agreement.id)
    .order("position", { ascending: true });
  if (milestones.error) fail("buscar los hitos", milestones.error);

  // La base ya los ordena; los volvemos a ordenar por si acaso.
  const rows = [...((milestones.data ?? []) as Record<string, unknown>[])].sort(
    (a, b) => Number(a.position) - Number(b.position),
  );

  return {
    id: agreement.id as string,
    publicId: agreement.public_id as string,
    title: agreement.title as string,
    description: textOrNull(agreement.description),
    clientCurrency: agreement.client_currency as string,
    payoutCurrency: agreement.payout_currency as string,
    totalAmount: amountText(agreement.total_amount, "del acuerdo"),
    status: agreement.status as string,
    freelancer: {
      name: freelancer.data.name as string,
      wallet: freelancer.data.wallet as string,
    },
    milestones: rows.map((m) => ({
      id: m.id as string,
      position: Number(m.position),
      title: m.title as string,
      amount: amountText(m.amount, `del hito ${m.position}`),
      reviewDays: Number(m.review_days),
      status: m.status as string,
      deliveryUrl: textOrNull(m.delivery_url),
      deliveryNote: textOrNull(m.delivery_note),
      deliveredAt: textOrNull(m.delivered_at),
      approvedAt: textOrNull(m.approved_at),
      paidAt: textOrNull(m.paid_at),
    })),
  };
}
