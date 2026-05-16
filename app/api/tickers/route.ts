import { getCurrentTickers } from "@/lib/queries";

export async function GET() {
  return Response.json(getCurrentTickers());
}
