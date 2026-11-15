const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const planModule = require(path.join(
  __dirname,
  "..",
  "docs",
  "archivo",
  "diario-aprendizaje-verano",
  "src",
  "learningPlan.js"
));

test("summer learning diary contains every weekday from 22 June to 31 August 2026", () => {
  const { learningPlan, STATUS_OPTIONS, PAUSE_REASONS } = planModule;

  assert.equal(learningPlan.length, 51);
  assert.equal(learningPlan[0].date, "2026-06-22");
  assert.equal(learningPlan.at(-1).date, "2026-08-31");

  const dates = new Set(learningPlan.map((day) => day.date));
  assert.equal(dates.size, learningPlan.length);
  assert.ok(learningPlan.every((day) => day.durationMinutes === 60));
  assert.ok(learningPlan.every((day) => day.platform && day.category && day.task));

  assert.ok(STATUS_OPTIONS.some((status) => status.id === "pending"));
  assert.ok(STATUS_OPTIONS.some((status) => status.id === "in-progress"));
  assert.ok(STATUS_OPTIONS.some((status) => status.id === "completed"));
  assert.ok(STATUS_OPTIONS.some((status) => status.id === "paused"));
  assert.ok(PAUSE_REASONS.includes("Vacaciones"));
  assert.ok(PAUSE_REASONS.includes("Otro motivo"));
});

test("summer learning diary includes the required platforms and project links", () => {
  const { platforms } = planModule;

  assert.equal(platforms.TryHackMe.url, "https://tryhackme.com/path/outline/presecurity");
  assert.equal(platforms.SQLBolt.url, "https://sqlbolt.com/");
  assert.equal(platforms.CodeCombat.url, "https://codecombat.com/play");
  assert.equal(platforms["Learn Prompting"].url, "https://learnprompting.org/");
  assert.equal(platforms.n8n.url, "https://docs.n8n.io/hosting/");
  assert.equal(platforms.Supabase.url, "https://supabase.com/pricing");
  assert.equal(platforms["Google Sheets"].url, "https://workspace.google.com/products/sheets/");
  assert.equal(platforms.Netlify.url, "https://www.netlify.com/pricing/");
});
