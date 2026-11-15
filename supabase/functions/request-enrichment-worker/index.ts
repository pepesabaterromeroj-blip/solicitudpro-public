import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { createClient } from "npm:@supabase/supabase-js@2";
import { handleRequestEnrichmentWorkerRequest } from "./worker-contract.ts";

function safeLog(event: Record<string, unknown>) {
  console.info(JSON.stringify(event));
}

Deno.serve(async (request) => {
  const workerSecret = Deno.env.get("REQUEST_ENRICHMENT_WORKER_SECRET") ?? "";
  const projectUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!workerSecret || !projectUrl || !serviceRoleKey) {
    safeLog({ event: "request_enrichment_worker", outcome: "configuration_error" });
    return Response.json({ error: "No se pudo completar la operación." }, { status: 500 });
  }
  const supabase = createClient(projectUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return handleRequestEnrichmentWorkerRequest(request, {
    workerSecret,
    now: () => new Date(),
    rpc: async (name, params) => await supabase.rpc(name, params),
    log: safeLog,
  });
});
