const assert = require("node:assert/strict");
const test = require("node:test");

const {
  classifyFailure,
  runDevFixture,
  sanitizeOperationalError,
} = require("../scripts/c13b-dev-fixture.js");

const NOW = Date.parse("2026-09-25T08:00:00.000Z");

test("C13B DEV fixture classifies network and temporary HTTP failures as retryable", () => {
  const cases = [
    { message: "fetch failed", statusCode: 0 },
    { message: "HTTP 408", statusCode: 408 },
    { message: "HTTP 425", statusCode: 425 },
    { message: "HTTP 429", statusCode: 429 },
    { message: "HTTP 500", statusCode: 500 },
    { message: "HTTP 503", statusCode: 503 },
  ];

  for (const fixture of cases) {
    const result = classifyFailure({ ...fixture, attemptCount: 1, nowMs: NOW });
    assert.equal(result.retryable, true, JSON.stringify(fixture));
    assert.equal(result.outcome, "retry");
  }
});

test("C13B DEV fixture applies literal backoffs and stops after attempt five", () => {
  const expected = [
    [1, "2026-09-25T08:02:00.000Z"],
    [2, "2026-09-25T08:10:00.000Z"],
    [3, "2026-09-25T08:30:00.000Z"],
    [4, "2026-09-25T09:00:00.000Z"],
  ];

  for (const [attemptCount, retryAt] of expected) {
    const result = classifyFailure({
      attemptCount,
      statusCode: 503,
      message: "temporary",
      nowMs: NOW,
    });
    assert.equal(result.retryAt, retryAt);
  }

  const exhausted = classifyFailure({
    attemptCount: 5,
    statusCode: 503,
    message: "temporary",
    nowMs: NOW,
  });
  assert.deepEqual(exhausted, {
    attemptCount: 5,
    error: "temporary",
    outcome: "failed",
    retryable: false,
    retryAt: null,
    statusCode: 503,
  });
});

test("C13B DEV fixture treats HTTP 400 as terminal and sanitizes its error", () => {
  const result = classifyFailure({
    attemptCount: 1,
    statusCode: 400,
    message: "Rejected user@example.test Authorization=Bearer fake re_fake_token",
    nowMs: NOW,
  });

  assert.equal(result.outcome, "failed");
  assert.equal(result.retryable, false);
  assert.equal(result.retryAt, null);
  assert.doesNotMatch(result.error, /user@example\.test|fake_token|Bearer fake/);
  assert.equal(
    sanitizeOperationalError("user@example.test Authorization=Bearer fake re_fake_token"),
    "[email] Authorization=[redacted] re_[redacted]",
  );
});

test("C13B DEV fixture runs locally without network or environment access", () => {
  const originalFetch = global.fetch;
  let fetchCalled = false;
  global.fetch = () => {
    fetchCalled = true;
    throw new Error("network access is forbidden in the DEV fixture");
  };

  try {
    const report = runDevFixture({ nowMs: NOW });
    assert.equal(report.ok, true);
    assert.equal(report.total, 12);
    assert.equal(report.retryable, 10);
    assert.equal(report.terminal, 2);
    assert.equal(fetchCalled, false);
    assert.deepEqual(Object.keys(report).sort(), ["ok", "retryable", "terminal", "total"]);
  } finally {
    global.fetch = originalFetch;
  }
});
