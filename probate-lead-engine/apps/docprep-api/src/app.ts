import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { createHash } from "node:crypto";
import { DriveExport, IntakeCommand, ProcessConflictError, ProcessRepository, ProcessTransitionError } from "@ple/docprep-core";
import { GoogleDriveCredentialProvider, GoogleDriveCredentials } from "./google-drive.js";

export type ApiConfig = {
  serviceToken: string;
  repository: ProcessRepository;
  artifactStore?: { get(objectKey: string): Promise<Uint8Array> };
  now?: () => number;
  fetcher?: typeof fetch;
  googleDrive?: { getCredentials?: GoogleDriveCredentialProvider };
};
const jsonError = (error: unknown) => ({ ok: false, error: error instanceof Error ? error.message : "The document-prep request could not be completed." });
const actorEmail = (request: Request) => String(request.headers.get("x-heirright-actor-email") || "").trim().toLowerCase();
const actorName = (request: Request) => String(request.headers.get("x-heirright-actor-name") || "").trim();
const validActor = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 320;
const publicCase = (processCase: NonNullable<Awaited<ReturnType<ProcessRepository["get"]>>>) => ({
  ...processCase,
  artifact: processCase.artifact ? { ...processCase.artifact, url: undefined } : undefined,
});

const newYorkDate = (at: Date) => new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", month: "2-digit", day: "2-digit", year: "numeric" }).format(at).replaceAll("/", "-");
const cleanEstateName = (value: string) => value.replace(/^\s*(?:estate|est)\s+of\s+/i, "").replace(/[^a-z0-9 .'-]/gi, " ").replace(/\s+/g, " ").trim().slice(0, 120) || "Estate";
const cleanOperatorName = (value: string) => value.replace(/[^a-z .'-]/gi, " ").replace(/\s+/g, " ").trim().slice(0, 120);
const driveFolderMimeType = "application/vnd.google-apps.folder";
const driveQueryLiteral = (value: string) => value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
export const estatePdfFileName = (estateName: string, at = new Date()) => `EST of ${cleanEstateName(estateName)} (${newYorkDate(at)}).pdf`;
export const operatorDriveFolderName = (name: string) => {
  const parts = cleanOperatorName(name).split(" ").filter(Boolean);
  if (parts.length < 2) throw new Error("A signed-in operator first and last name is required for the Google Drive team folder.");
  return `${parts[0][0].toUpperCase()} ${parts.at(-1)}`;
};
const pdfHash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const pdfMd5 = (bytes: Uint8Array) => createHash("md5").update(bytes).digest("hex");

async function verifiedArtifactBytes(processCase: Awaited<ReturnType<ProcessRepository["get"]>>, artifactStore?: ApiConfig["artifactStore"]): Promise<{ bytes: Uint8Array; filename: string } | null> {
  const artifact = processCase?.artifact;
  if (!processCase || processCase.state !== "packet_ready" || artifact?.contentType !== "application/pdf" || artifact.readbackStatus !== "verified" || !artifact.objectKey || !/^[a-f0-9]{64}$/i.test(artifact.sha256) || !artifactStore) return null;
  const bytes = await artifactStore.get(artifact.objectKey);
  if (bytes.byteLength < 5 || bytes[0] !== 0x25 || bytes[1] !== 0x50 || bytes[2] !== 0x44 || bytes[3] !== 0x46 || bytes[4] !== 0x2d || pdfHash(bytes) !== artifact.sha256) return null;
  return { bytes, filename: estatePdfFileName(processCase.estate.name) };
}

class GoogleDriveUnauthorizedError extends Error {
  constructor() {
    super("Google Drive authorization expired.");
  }
}

type DriveFile = { id?: string; name?: string; mimeType?: string; parents?: string[]; md5Checksum?: string; webViewLink?: string; appProperties?: Record<string, string> };

async function ensureOperatorDriveFolder({ credentials, operatorName, fetcher }: {
  credentials: GoogleDriveCredentials;
  operatorName: string;
  fetcher: typeof fetch;
}): Promise<{ id: string; name: string }> {
  const rootFolderId = String(credentials.parentFolderId || "").trim();
  if (!rootFolderId) throw new Error("The shared Google Drive root folder is not configured.");
  const name = operatorDriveFolderName(operatorName);
  const headers = { authorization: `Bearer ${credentials.accessToken}` };
  const query = `name = '${driveQueryLiteral(name)}' and mimeType = '${driveFolderMimeType}' and '${driveQueryLiteral(rootFolderId)}' in parents and trashed = false`;
  const existingResponse = await fetcher(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&spaces=drive&fields=files(id,name,mimeType,parents)&supportsAllDrives=true&includeItemsFromAllDrives=true`, { headers });
  if (existingResponse.status === 401) throw new GoogleDriveUnauthorizedError();
  if (!existingResponse.ok) throw new Error(`Google Drive team-folder lookup failed (${existingResponse.status}).`);
  const existing = await existingResponse.json().catch(() => ({})) as { files?: DriveFile[] };
  const matching = (existing.files || []).filter((folder) => folder.id && folder.name === name && folder.mimeType === driveFolderMimeType && folder.parents?.includes(rootFolderId));
  if (matching.length > 1) throw new Error(`Google Drive has more than one '${name}' team folder under the shared root.`);
  if (matching[0]?.id) return { id: matching[0].id, name };

  const createdResponse = await fetcher("https://www.googleapis.com/drive/v3/files?fields=id,name,mimeType,parents&supportsAllDrives=true", {
    method: "POST",
    headers: { ...headers, "content-type": "application/json" },
    body: JSON.stringify({ name, mimeType: driveFolderMimeType, parents: [rootFolderId], appProperties: { heirrightDocprepOperatorFolder: name } }),
  });
  if (createdResponse.status === 401) throw new GoogleDriveUnauthorizedError();
  const created = await createdResponse.json().catch(() => ({})) as DriveFile;
  if (!createdResponse.ok || !created.id) throw new Error(`Google Drive team-folder creation failed (${createdResponse.status}).`);
  const readback = await fetcher(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(created.id)}?fields=id,name,mimeType,parents&supportsAllDrives=true`, { headers });
  if (readback.status === 401) throw new GoogleDriveUnauthorizedError();
  const stored = await readback.json().catch(() => ({})) as DriveFile;
  if (!readback.ok || stored.id !== created.id || stored.name !== name || stored.mimeType !== driveFolderMimeType || !stored.parents?.includes(rootFolderId)) throw new Error(`Google Drive team-folder readback failed (${readback.status}).`);
  return { id: stored.id, name };
}

async function uploadVerifiedPdfToGoogleDrive({ processCase, verified, credentials, operatorName, fetcher }: {
  processCase: NonNullable<Awaited<ReturnType<ProcessRepository["get"]>>>;
  verified: { bytes: Uint8Array; filename: string };
  credentials: GoogleDriveCredentials;
  operatorName: string;
  fetcher: typeof fetch;
}): Promise<DriveExport> {
  const sourceSha256 = processCase.artifact?.sha256 || "";
  const sourceMd5 = pdfMd5(verified.bytes);
  const teamFolder = await ensureOperatorDriveFolder({ credentials, operatorName, fetcher });
  const metadata = {
    name: verified.filename,
    mimeType: "application/pdf",
    parents: [teamFolder.id],
    appProperties: { heirrightDocprepCaseId: processCase.id, heirrightPdfSha256: sourceSha256, heirrightDocprepOperatorFolder: teamFolder.name },
  };
  const driveHeaders = { authorization: `Bearer ${credentials.accessToken}` };
  const query = `appProperties has { key='heirrightDocprepCaseId' and value='${processCase.id}' } and appProperties has { key='heirrightPdfSha256' and value='${sourceSha256}' } and '${driveQueryLiteral(teamFolder.id)}' in parents and trashed = false`;
  const existingResponse = await fetcher(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&spaces=drive&fields=files(id,name,mimeType,md5Checksum,webViewLink,appProperties)&supportsAllDrives=true&includeItemsFromAllDrives=true`, { headers: driveHeaders });
  if (existingResponse.status === 401) throw new GoogleDriveUnauthorizedError();
  if (!existingResponse.ok) throw new Error(`Google Drive PDF lookup failed (${existingResponse.status}).`);
  const existing = await existingResponse.json().catch(() => ({})) as { files?: DriveFile[] };
  const prior = existing.files?.find((file) => file.id && file.name === verified.filename && file.mimeType === "application/pdf" && file.md5Checksum === sourceMd5 && file.appProperties?.heirrightDocprepCaseId === processCase.id && file.appProperties?.heirrightPdfSha256 === sourceSha256);
  if (prior?.id) return { caseId: processCase.id, estateId: processCase.estate.estateId, name: prior.name || verified.filename, url: prior.webViewLink || "", readbackStatus: "verified", idempotent: true };
  const boundary = `heirright-${processCase.id.replace(/[^a-z0-9]/gi, "")}`;
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Type: application/pdf\r\n\r\n`),
    Buffer.from(verified.bytes),
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  const upload = await fetcher("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,webViewLink&supportsAllDrives=true", {
    method: "POST",
    headers: { ...driveHeaders, "content-type": `multipart/related; boundary=${boundary}` },
    body,
  });
  if (upload.status === 401) throw new GoogleDriveUnauthorizedError();
  const created = await upload.json().catch(() => ({})) as { id?: string; name?: string; mimeType?: string; md5Checksum?: string; webViewLink?: string; appProperties?: Record<string, string> };
  if (!upload.ok || !created.id) throw new Error(`Google Drive PDF upload failed (${upload.status}).`);
  const readback = await fetcher(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(created.id)}?fields=id,name,mimeType,md5Checksum,webViewLink,appProperties&supportsAllDrives=true`, { headers: driveHeaders });
  if (readback.status === 401) throw new GoogleDriveUnauthorizedError();
  const stored = await readback.json().catch(() => ({})) as typeof created;
  if (!readback.ok || stored.id !== created.id || stored.name !== verified.filename || stored.mimeType !== "application/pdf" || stored.md5Checksum !== sourceMd5 || stored.appProperties?.heirrightDocprepCaseId !== processCase.id || stored.appProperties?.heirrightPdfSha256 !== sourceSha256) throw new Error(`Google Drive PDF readback failed (${readback.status}).`);
  return { caseId: processCase.id, estateId: processCase.estate.estateId, name: stored.name, url: stored.webViewLink || created.webViewLink || "", readbackStatus: "verified", idempotent: false };
}

async function exportVerifiedPdfToGoogleDrive({
  processCase,
  verified,
  credentialProvider,
  operatorName,
  fetcher,
}: {
  processCase: NonNullable<Awaited<ReturnType<ProcessRepository["get"]>>>;
  verified: { bytes: Uint8Array; filename: string };
  credentialProvider: GoogleDriveCredentialProvider;
  operatorName: string;
  fetcher: typeof fetch;
}): Promise<DriveExport> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const credentials = await credentialProvider({ forceRefresh: attempt === 1 });
    try {
      return await uploadVerifiedPdfToGoogleDrive({ processCase, verified, credentials, operatorName, fetcher });
    } catch (error) {
      if (error instanceof GoogleDriveUnauthorizedError && attempt === 0) continue;
      throw error;
    }
  }
  throw new Error("Google Drive authorization could not be refreshed.");
}

export const createApp = ({ serviceToken, repository, artifactStore, now = () => Date.now(), fetcher = fetch, googleDrive = {} }: ApiConfig) => {
  const app = new Hono();
  app.use("/v1/*", async (context, next) => {
    if (Number(context.req.header("content-length") || 0) > 1_000_000) return context.json({ ok: false, error: "request_too_large" }, 413);
    const authorization = context.req.header("authorization") || "";
    if (!serviceToken || authorization !== `Bearer ${serviceToken}`) return context.json({ ok: false, error: "unauthorized" }, 401);
    const actor = actorEmail(context.req.raw);
    if (!validActor(actor)) return context.json({ ok: false, error: "trusted_actor_required" }, 400);
    await next();
  });
  app.get("/healthz", (context) => context.json({ ok: true, status: "live" }));
  app.get("/readyz", async (context) => { try { await repository.ready(); return context.json({ ok: true, status: "ready" }); } catch { return context.json({ ok: false, error: "database_not_ready" }, 503); } });
  app.post("/v1/doc-prep/cases", async (context) => {
    const idempotencyKey = context.req.header("idempotency-key") || "";
    try {
      const body = IntakeCommand.parse(await context.req.json());
      const trustedActor = actorEmail(context.req.raw);
      const command = { ...body, estates: body.estates.map((estate) => ({ ...estate, actor: { email: trustedActor } })) };
      const result = await repository.intake(command, idempotencyKey);
      return context.json({ ok: true, cases: result.map((entry) => ({ ...entry, case: publicCase(entry.case) })) }, result.every((entry) => entry.created && !entry.idempotent) ? 201 : 200);
    }
    catch (error) { return context.json(jsonError(error), error instanceof ProcessConflictError ? 409 : 400); }
  });
  app.get("/v1/doc-prep/cases", async (context) => { const estateId = context.req.query("estateId"); if (!estateId) return context.json({ ok: false, error: "estate_id_required" }, 400); const processCase = await repository.findByEstate(estateId); return processCase ? context.json({ ok: true, case: publicCase(processCase) }) : context.json({ ok: false, error: "not_found" }, 404); });
  app.get("/v1/doc-prep/cases/:caseId", async (context) => { const processCase = await repository.get(context.req.param("caseId")); return processCase ? context.json({ ok: true, case: publicCase(processCase) }) : context.json({ ok: false, error: "not_found" }, 404); });
  app.get("/v1/doc-prep/cases/:caseId/:artifactAction", async (context) => {
    const artifactAction = context.req.param("artifactAction");
    if (artifactAction !== "download" && artifactAction !== "view") return context.json({ ok: false, error: "not_found" }, 404);
    const processCase = await repository.get(context.req.param("caseId"));
    const verified = await verifiedArtifactBytes(processCase, artifactStore).catch(() => null);
    if (!verified) return context.json({ ok: false, error: "verified_pdf_not_available" }, 409);
    const disposition = artifactAction === "view" ? "inline" : "attachment";
    return new Response(verified.bytes as unknown as BodyInit, { headers: { "content-type": "application/pdf", "content-disposition": `${disposition}; filename="${verified.filename.replace(/"/g, "")}"`, "cache-control": "private, no-store" } });
  });
  app.get("/v1/doc-prep/cases/:caseId/events", async (context) => {
    const lastEventId = Number(context.req.header("last-event-id") || context.req.query("after") || 0);
    const events = await repository.events(context.req.param("caseId"), Number.isSafeInteger(lastEventId) && lastEventId > 0 ? lastEventId : 0);
    return streamSSE(context, async (stream) => { for (const event of events) await stream.writeSSE({ id: String(event.id), event: "case", data: JSON.stringify(event) }); await stream.writeSSE({ event: "heartbeat", data: JSON.stringify({ at: now() }) }); });
  });
  app.post("/v1/doc-prep/cases/:caseId/actions/:action", async (context) => {
    const body = await context.req.json().catch(() => ({})) as { revision?: unknown }; const revision = Number(body.revision); if (!Number.isInteger(revision) || revision < 1) return context.json({ ok: false, error: "revision_required" }, 400);
    try { const processCase = context.req.param("action") === "retry" ? await repository.retry(context.req.param("caseId"), revision, actorEmail(context.req.raw)) : context.req.param("action") === "cancel" ? await repository.cancel(context.req.param("caseId"), revision, actorEmail(context.req.raw)) : null; if (!processCase) return context.json({ ok: false, error: "unknown_action" }, 404); return context.json({ ok: true, case: publicCase(processCase) }); }
    catch (error) { return context.json(jsonError(error), error instanceof ProcessConflictError ? 409 : error instanceof ProcessTransitionError ? 422 : 500); }
  });
  app.post("/v1/doc-prep/exports/google-drive", async (context) => {
    const body = await context.req.json().catch(() => ({})) as { caseIds?: unknown; operatorIntent?: unknown };
    if (body.operatorIntent !== "export_verified_pdfs_to_google_drive") return context.json({ ok: false, error: "operator_intent_required" }, 400);
    const caseIds = Array.isArray(body.caseIds) ? [...new Set(body.caseIds.filter((value): value is string => typeof value === "string" && /^[a-f0-9-]{36}$/i.test(value)))].slice(0, 50) : [];
    if (!caseIds.length) return context.json({ ok: false, error: "verified_cases_required" }, 400);
    if (!googleDrive.getCredentials) return context.json({ ok: false, error: "google_drive_not_configured" }, 503);
    const operatorName = actorName(context.req.raw);
    try { operatorDriveFolderName(operatorName); }
    catch (error) { return context.json({ ok: false, error: error instanceof Error ? error.message : "trusted_operator_name_required" }, 400); }
    const resolved = await Promise.all(caseIds.map((caseId) => repository.get(caseId)));
    if (resolved.some((processCase) => !processCase)) return context.json({ ok: false, error: "case_not_found" }, 404);
    const completed: DriveExport[] = [];
    for (const processCase of resolved as NonNullable<typeof resolved[number]>[]) {
      const verified = await verifiedArtifactBytes(processCase, artifactStore).catch(() => null);
      if (!verified) return context.json({ ok: false, error: "verified_pdf_not_available", caseId: processCase.id }, 409);
      const claim = await repository.claimDriveExport(processCase.id, processCase.artifact!.sha256);
      if (claim.status === "completed") { completed.push(claim.export); continue; }
      if (claim.status === "in_progress") return context.json({ ok: false, error: "google_drive_export_in_progress", caseId: processCase.id, completed }, 409);
      try {
        const exported = await exportVerifiedPdfToGoogleDrive({ processCase, verified, credentialProvider: googleDrive.getCredentials, operatorName, fetcher });
        await repository.completeDriveExport(processCase.id, processCase.artifact!.sha256, exported);
        completed.push(exported);
      } catch (error) {
        await repository.releaseDriveExport(processCase.id, processCase.artifact!.sha256);
        return context.json({ ok: false, error: error instanceof Error ? error.message : "google_drive_export_failed", completed }, 502);
      }
    }
    return context.json({ ok: true, exports: completed, readbackStatus: "verified" });
  });
  return app;
};
