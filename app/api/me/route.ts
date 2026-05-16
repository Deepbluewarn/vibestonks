import { auth } from "@/auth";
import { getMyState } from "@/lib/queries";

export async function GET() {
  const session = await auth();
  if (!session?.user?.traderId) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const state = getMyState(session.user.traderId);
  if (!state) return Response.json({ error: "no active week" }, { status: 409 });
  return Response.json(state);
}
