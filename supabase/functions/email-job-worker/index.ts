import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { createClient } from "npm:@supabase/supabase-js@2";
import { handleWorkerRequest } from "./worker-contract.ts";

function safeLog(event: Record<string, unknown>) {
  console.info(JSON.stringify(event));
}

Deno.serve(async (request) => {
  const workerSecret = Deno.env.get("EMAIL_WORKER_SECRET") ?? "";
  const projectUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!workerSecret || !projectUrl || !serviceRoleKey) {
    safeLog({ event: "email_job_worker", outcome: "configuration_error" });
    return Response.json(
      { error: "No se pudo completar la operación." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }

  const supabase = createClient(projectUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  return handleWorkerRequest(request, {
    workerSecret,
    now: () => new Date(),
    rpc: async (name, params) => await supabase.rpc(name, params),
    log: safeLog,
  });
});
