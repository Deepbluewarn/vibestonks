import { auth } from "@/auth";
import { getLeaderboard } from "@/lib/queries";

export async function GET() {
  const session = await auth();
  return Response.json(getLeaderboard(session?.user?.traderId));
}
