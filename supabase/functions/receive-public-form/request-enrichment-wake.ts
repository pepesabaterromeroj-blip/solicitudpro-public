type WakeEvent = {
  event: "request_enrichment_wake";
  outcome: "accepted" | "rejected" | "network_error" | "configuration_missing" | "invalid_request_id";
  status?: number;
};

type WakeDependencies = {
  getEnv: (name: string) => string | undefined;
  fetchImpl: (url: string, options: {
    method: "POST";
    headers: Record<string, string>;
    body: string;
  }) => Promise<{ ok: boolean; status: number }>;
  waitUntil: (task: Promise<void>) => void;
  log: (event: WakeEvent) => void;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function defaultDependencies(): WakeDependencies {
  return {
    getEnv: (name) => Deno.env.get(name),
    fetchImpl: (url, options) => fetch(url, options),
    waitUntil: (task) => EdgeRuntime.waitUntil(task),
    log: (event) => console.info(JSON.stringify(event)),
  };
}

async function sendWake(requestId: string, url: string, secret: string, dependencies: WakeDependencies) {
  try {
    const result = await dependencies.fetchImpl(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-SolicitudPro-Enrichment-Wake-Secret": secret,
      },
      body: JSON.stringify({ request_id: requestId }),
    });
    dependencies.log({
      event: "request_enrichment_wake",
      outcome: result.ok ? "accepted" : "rejected",
      status: result.status,
    });
  } catch {
    dependencies.log({ event: "request_enrichment_wake", outcome: "network_error" });
  }
}

export function scheduleRequestEnrichmentWake(requestId: unknown, overrides: Partial<WakeDependencies> = {}) {
  const dependencies = { ...defaultDependencies(), ...overrides };
  if (typeof requestId !== "string" || !UUID_PATTERN.test(requestId)) {
    dependencies.log({ event: "request_enrichment_wake", outcome: "invalid_request_id" });
    return false;
  }
  const url = dependencies.getEnv("N8N_REQUEST_ENRICHMENT_WAKE_URL");
  const secret = dependencies.getEnv("N8N_REQUEST_ENRICHMENT_WAKE_SECRET");
  if (!url || !secret) {
    dependencies.log({ event: "request_enrichment_wake", outcome: "configuration_missing" });
    return false;
  }
  dependencies.waitUntil(sendWake(requestId, url, secret, dependencies));
  return true;
}
