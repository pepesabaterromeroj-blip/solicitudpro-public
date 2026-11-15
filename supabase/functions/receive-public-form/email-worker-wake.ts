type WakeEvent = {
  event: "email_worker_wake";
  outcome: "accepted" | "rejected" | "network_error" | "configuration_missing";
  status?: number;
};

type WakeDependencies = {
  getEnv: (name: string) => string | undefined;
  fetchImpl: (
    url: string,
    options: {
      method: "POST";
      headers: Record<string, string>;
      body: "{}";
    },
  ) => Promise<{ ok: boolean; status: number }>;
  waitUntil: (task: Promise<void>) => void;
  log: (event: WakeEvent) => void;
};

function defaultDependencies(): WakeDependencies {
  return {
    getEnv: (name) => {
      if (name === "N8N_EMAIL_WAKE_URL") return Deno.env.get("N8N_EMAIL_WAKE_URL");
      if (name === "N8N_EMAIL_WAKE_SECRET") return Deno.env.get("N8N_EMAIL_WAKE_SECRET");
      return undefined;
    },
    fetchImpl: (url, options) => fetch(url, options),
    waitUntil: (task) => EdgeRuntime.waitUntil(task),
    log: (event) => console.info(JSON.stringify(event)),
  };
}

async function sendEmailWorkerWake(
  url: string,
  secret: string,
  dependencies: WakeDependencies,
) {
  try {
    const result = await dependencies.fetchImpl(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-SolicitudPro-Wake-Secret": secret,
      },
      body: "{}",
    });
    dependencies.log({
      event: "email_worker_wake",
      outcome: result.ok ? "accepted" : "rejected",
      status: result.status,
    });
  } catch {
    dependencies.log({ event: "email_worker_wake", outcome: "network_error" });
  }
}

export function scheduleEmailWorkerWake(
  overrides: Partial<WakeDependencies> = {},
) {
  const dependencies = { ...defaultDependencies(), ...overrides };
  const url = dependencies.getEnv("N8N_EMAIL_WAKE_URL");
  const secret = dependencies.getEnv("N8N_EMAIL_WAKE_SECRET");

  if (!url || !secret) {
    dependencies.log({ event: "email_worker_wake", outcome: "configuration_missing" });
    return false;
  }

  dependencies.waitUntil(sendEmailWorkerWake(url, secret, dependencies));
  return true;
}
