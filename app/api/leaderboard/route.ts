import { getRepo } from '@/lib/server/get-repo';
import { getLeaderboard } from '@/lib/server/results-service';

export async function GET(request: Request): Promise<Response> {
  const { status, body } = await getLeaderboard(new URL(request.url).searchParams, getRepo());
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}
