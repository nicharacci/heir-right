import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { IntakeCommand, ProcessConflictError, ProcessRepository, ProcessTransitionError } from "@ple/docprep-core";

export type ApiConfig = { serviceToken: string; repository: ProcessRepository; now?: () => number };
const jsonError = (error: unknown) => ({ ok: false, error: error instanceof Error ? error.message : "The document-prep request could not be completed." });
const actorEmail = (request: Request) => String(request.headers.get("x-heirright-actor-email") || "").trim().toLowerCase();
const validActor = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 320;

export const createApp = ({ serviceToken, repository, now = () => Date.now() }: ApiConfig) => {
  const app = new Hono();
  app.use("/v1/*", async (context, next) => {
    const authorization = context.req.header("authorization") || "";
    if (!serviceToken || authorization !== `Bearer ${serviceToken}`) return context.json({ ok: false, error: "unauthorized" }, 401);
    const actor = actorEmail(context.req.raw);
    if (!validActor(actor)) return context.json({ ok: false, error: "trusted_actor_required" }, 400);
    await next();
  });
  app.get("/healthz", (context) => context.json({ ok: true, status: "live" }));
  app.get("/readyz", async (context) => { try { await repository.events("00000000-0000-0000-0000-000000000000"); } catch (error) { if (error instanceof ProcessConflictError) return context.json({ ok: true, status: "ready" }); return context.json({ ok: false, error: "database_not_ready" }, 503); } return context.json({ ok: true, status: "ready" }); });
  app.post("/v1/doc-prep/cases", async (context) => {
    const idempotencyKey = context.req.header("idempotency-key") || "";
    try { const body = IntakeCommand.parse(await context.req.json()); const result = await repository.intake(body, idempotencyKey); return context.json({ ok: true, cases: result }, result.every((entry) => entry.created && !entry.idempotent) ? 201 : 200); }
    catch (error) { return context.json(jsonError(error), error instanceof ProcessConflictError ? 409 : 400); }
  });
  app.get("/v1/doc-prep/cases", async (context) => { const estateId = context.req.query("estateId"); if (!estateId) return context.json({ ok: false, error: "estate_id_required" }, 400); const processCase = await repository.findByEstate(estateId); return processCase ? context.json({ ok: true, case: processCase }) : context.json({ ok: false, error: "not_found" }, 404); });
  app.get("/v1/doc-prep/cases/:caseId", async (context) => { const processCase = await repository.get(context.req.param("caseId")); return processCase ? context.json({ ok: true, case: processCase }) : context.json({ ok: false, error: "not_found" }, 404); });
  app.get("/v1/doc-prep/cases/:caseId/events", async (context) => {
    const lastEventId = Number(context.req.header("last-event-id") || context.req.query("after") || 0);
    const events = await repository.events(context.req.param("caseId"), Number.isSafeInteger(lastEventId) && lastEventId > 0 ? lastEventId : 0);
    return streamSSE(context, async (stream) => { for (const event of events) await stream.writeSSE({ id: String(event.id), event: "case", data: JSON.stringify(event) }); await stream.writeSSE({ event: "heartbeat", data: JSON.stringify({ at: now() }) }); });
  });
  app.post("/v1/doc-prep/cases/:caseId/actions/:action", async (context) => {
    const body = await context.req.json().catch(() => ({})) as { revision?: unknown }; const revision = Number(body.revision); if (!Number.isInteger(revision) || revision < 1) return context.json({ ok: false, error: "revision_required" }, 400);
    try { const processCase = context.req.param("action") === "retry" ? await repository.retry(context.req.param("caseId"), revision, actorEmail(context.req.raw)) : context.req.param("action") === "cancel" ? await repository.cancel(context.req.param("caseId"), revision, actorEmail(context.req.raw)) : null; if (!processCase) return context.json({ ok: false, error: "unknown_action" }, 404); return context.json({ ok: true, case: processCase }); }
    catch (error) { return context.json(jsonError(error), error instanceof ProcessConflictError ? 409 : error instanceof ProcessTransitionError ? 422 : 500); }
  });
  return app;
};
