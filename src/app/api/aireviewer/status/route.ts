import { refuseAi } from '@/lib/ai';
import { checkAiStatus } from '@/lib/aiStatus';

/** Is the AI reachable right now? Add ?fresh=1 to look again instead of using the last result. */
export async function GET(req: Request) {
  const refused = await refuseAi();
  if (refused) return refused;
  const fresh = new URL(req.url).searchParams.get('fresh') === '1';
  return Response.json(await checkAiStatus(fresh), { headers: { 'Cache-Control': 'no-store' } });
}
