// Crear un acuerdo con sus hitos en Supabase (PAC-14).
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
