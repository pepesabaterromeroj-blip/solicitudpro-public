"use strict";

const RETRY_MINUTES = Object.freeze({
  1: 2,
  2: 10,
  3: 30,
  4: 60,
});

function sanitizeOperationalError(value) {
  return String(value || "Error desconocido al enviar con Resend")
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[email]")
    .replace(/\bAuthorization\s*[:=]\s*(?:Bearer\s+)?[^\s,;]+/gi, "Authorization=[redacted]")
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]")
    .replace(/\bre_[A-Za-z0-9_-]+/gi, "re_[redacted]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);
}

function classifyFailure({ attemptCount, statusCode, message, nowMs = Date.now() }) {
  const normalizedAttempt = Math.max(1, Number(attemptCount || 1));
  const normalizedStatus = Number(statusCode || 0);
  const error = sanitizeOperationalError(message);
  const networkError = normalizedStatus === 0
    && /timeout|timed out|econnreset|econnrefused|enotfound|network|socket|fetch failed/i.test(error);
  const temporaryHttpError = normalizedStatus === 408
    || normalizedStatus === 425
    || normalizedStatus === 429
    || normalizedStatus >= 500;
  const retryable = normalizedAttempt < 5 && (networkError || temporaryHttpError);
  const retryMinutes = retryable ? (RETRY_MINUTES[normalizedAttempt] ?? 60) : null;

  return {
    attemptCount: normalizedAttempt,
    error,
    outcome: retryable ? "retry" : "failed",
    retryable,
    retryAt: retryable
      ? new Date(nowMs + retryMinutes * 60 * 1000).toISOString()
      : null,
    statusCode: normalizedStatus || null,
  };
}

function runDevFixture({ nowMs = Date.now() } = {}) {
  const cases = [
    { attemptCount: 1, statusCode: 0, message: "fetch failed" },
    { attemptCount: 1, statusCode: 408, message: "HTTP 408" },
    { attemptCount: 1, statusCode: 425, message: "HTTP 425" },
    { attemptCount: 1, statusCode: 429, message: "HTTP 429" },
    { attemptCount: 1, statusCode: 500, message: "HTTP 500" },
    { attemptCount: 1, statusCode: 503, message: "HTTP 503" },
    { attemptCount: 2, statusCode: 503, message: "HTTP 503" },
    { attemptCount: 3, statusCode: 503, message: "HTTP 503" },
    { attemptCount: 4, statusCode: 503, message: "HTTP 503" },
    { attemptCount: 4, statusCode: 0, message: "network timeout" },
    { attemptCount: 5, statusCode: 503, message: "HTTP 503" },
    { attemptCount: 1, statusCode: 400, message: "HTTP 400" },
  ];
  const results = cases.map((fixture) => classifyFailure({ ...fixture, nowMs }));
  const retryable = results.filter((result) => result.outcome === "retry").length;
  const terminal = results.filter((result) => result.outcome === "failed").length;

  return {
    ok: retryable === 10 && terminal === 2,
    retryable,
    terminal,
    total: results.length,
  };
}

if (require.main === module) {
  if (!process.argv.includes("--dev-fixture")) {
    console.error("Fixture inactivo. Usa --dev-fixture para ejecutarlo explícitamente en DEV.");
    process.exitCode = 2;
  } else {
    const report = runDevFixture();
    console.log(JSON.stringify(report));
    if (!report.ok) process.exitCode = 1;
  }
}

module.exports = {
  classifyFailure,
  runDevFixture,
  sanitizeOperationalError,
};
