import { getRepo } from '@/lib/server/get-repo';
import { listRecent } from '@/lib/server/results-service';

export async function GET(request: Request): Promise<Response> {
  const { status, body } = await listRecent(
    request.headers.get('authorization'),
    process.env.ADMIN_TOKEN,
    new URL(request.url).searchParams.get('limit'),
    getRepo(),
  );
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}
