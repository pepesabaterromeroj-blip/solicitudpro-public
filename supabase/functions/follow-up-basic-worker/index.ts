import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { handleFollowUpBasicRequest } from './worker-contract.ts';

function safeLog(entry: Record<string, unknown>) {
  console.info(JSON.stringify(entry));
}

Deno.serve((request) => {
  const projectUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const secret = Deno.env.get('C15A_WORKER_SECRET');
  if (!projectUrl || !serviceRoleKey || !secret) {
    safeLog({ event: 'follow_up_basic_worker', outcome: 'configuration_error' });
    return new Response(JSON.stringify({ error: 'configuration_error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(projectUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return handleFollowUpBasicRequest(request, {
    secret,
    invokeRpc: (name, args) => supabase.rpc(name, args),
    log: safeLog,
  });
});
