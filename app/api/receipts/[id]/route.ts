import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getReceiptByMilestoneId } from "@/lib/receipts";

/** GET /api/receipts/<milestoneId>: datos públicos del recibo de un hito. */
export async function GET(_request: Request, ctx: RouteContext<"/api/receipts/[id]">) {
  const { id } = await ctx.params;
  try {
    const receipt = await getReceiptByMilestoneId(getDb(), id);
    if (!receipt) {
      return NextResponse.json({ error: "No encontramos ese recibo." }, { status: 404 });
    }
    return NextResponse.json(receipt);
  } catch (error) {
    console.error("GET /api/receipts/[id]", error);
    return NextResponse.json(
      { error: "No pudimos leer el recibo. Probá de nuevo." },
      { status: 500 },
    );
  }
}
