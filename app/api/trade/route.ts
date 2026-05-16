import { auth } from "@/auth";
import { TradeError, executeTrade, type TradeSide } from "@/lib/trade";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.traderId) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { tickerId?: number; shares?: number; side?: TradeSide };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }

  const { tickerId, shares, side } = body;
  if (
    !Number.isInteger(tickerId) ||
    !Number.isInteger(shares) ||
    (shares as number) <= 0 ||
    (side !== "buy" && side !== "sell")
  ) {
    return Response.json({ error: "invalid input" }, { status: 400 });
  }

  try {
    const r = executeTrade({
      traderId: session.user.traderId,
      tickerId: tickerId as number,
      shares: shares as number,
      side,
    });
    return Response.json(r);
  } catch (e) {
    if (e instanceof TradeError) {
      return Response.json(
        { error: e.code, message: e.message },
        { status: 400 },
      );
    }
    throw e;
  }
}
