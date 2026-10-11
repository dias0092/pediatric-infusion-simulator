import { getRepo } from '@/lib/server/get-repo';
import { submitResult } from '@/lib/server/results-service';

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }
  const { status, body: payload } = await submitResult(body, getRepo());
  return Response.json(payload, { status });
}
