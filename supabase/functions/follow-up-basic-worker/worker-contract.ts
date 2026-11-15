type RpcResult = { data: unknown; error: { message?: string } | null };

export type FollowUpBasicDependencies = {
  secret: string | undefined;
  invokeRpc: (name: string, args: Record<string, unknown>) => Promise<RpcResult>;
  log: (entry: Record<string, unknown>) => void;
};

function json(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function validBearer(request: Request, expected: string | undefined) {
  if (!expected) return false;
  const supplied = request.headers.get('Authorization') ?? '';
  const expectedHeader = `Bearer ${expected}`;
  const left = new TextEncoder().encode(supplied);
  const right = new TextEncoder().encode(expectedHeader);
  let mismatch = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    mismatch |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }
  return mismatch === 0;
}

function parseLimit(value: unknown) {
  if (value === undefined) return 100;
  return Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 500
    ? Number(value)
    : null;
}

export async function handleFollowUpBasicRequest(
  request: Request,
  dependencies: FollowUpBasicDependencies,
) {
  const url = new URL(request.url);
  if (request.method !== 'POST' || !url.pathname.endsWith('/process')) {
    return json({ error: 'not_found' }, 404);
  }
  if (!validBearer(request, dependencies.secret)) {
    dependencies.log({ event: 'follow_up_basic_worker', outcome: 'unauthorized' });
    return json({ error: 'unauthorized' }, 401);
  }

  let body: Record<string, unknown> = {};
  try {
    const parsed = await request.json();
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('invalid');
    body = parsed as Record<string, unknown>;
  } catch {
    return json({ error: 'invalid_request' }, 400);
  }
  if (Object.keys(body).some((key) => key !== 'limit')) {
    return json({ error: 'invalid_request' }, 400);
  }
  const limit = parseLimit(body.limit);
  if (limit === null) return json({ error: 'invalid_request' }, 400);

  const { data, error } = await dependencies.invokeRpc('process_basic_follow_up_milestones', {
    p_limit: limit,
  });
  if (error) {
    dependencies.log({ event: 'follow_up_basic_worker', outcome: 'rpc_error' });
    return json({ error: 'backend_error' }, 500);
  }

  const row = Array.isArray(data) ? data[0] : data;
  const summary = {
    processed_count: Number((row as Record<string, unknown> | null)?.processed_count ?? 0),
    milestone_24h_count: Number((row as Record<string, unknown> | null)?.milestone_24h_count ?? 0),
    milestone_48h_count: Number((row as Record<string, unknown> | null)?.milestone_48h_count ?? 0),
    milestone_72h_count: Number((row as Record<string, unknown> | null)?.milestone_72h_count ?? 0),
  };
  dependencies.log({
    event: 'follow_up_basic_worker',
    outcome: 'processed',
    processed_count: summary.processed_count,
  });
  return json(summary, 200);
}
