import type { SourceRunner, SourceResult } from "./worker.js";

type FetchLike = typeof fetch;
type DiscoveryPacketReference = {
  artifactUrl?: unknown;
  flow?: unknown;
  contentType?: unknown;
  readbackStatus?: unknown;
};
type DiscoveryFile = {
  ok?: unknown;
  exists?: unknown;
  dossier?: unknown;
  packetArtifacts?: unknown;
};
type PacketExport = {
  ok?: unknown;
  artifactUrl?: unknown;
  blockers?: unknown;
};

const reviewRequired = (detail: string, nextAction: string): SourceResult => ({ kind: "review_required", detail, nextAction });
const blocked = (detail: string, nextAction: string): SourceResult => ({ kind: "blocked", detail, nextAction });

const isObject = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const sourceHeaders = (token: string) => ({ authorization: `Bearer ${token}`, accept: "application/json" });

function packetReference(file: DiscoveryFile): DiscoveryPacketReference | null {
  if (!Array.isArray(file.packetArtifacts)) return null;
  return file.packetArtifacts
    .filter(isObject)
    .find((artifact) => artifact.flow === "discovery" && artifact.contentType === "application/pdf" && artifact.readbackStatus === "verified") ?? null;
}

function workerArtifactUrl(workerUrl: string, value: unknown): string | null {
  if (typeof value !== "string" || !value.startsWith("/api/")) return null;
  return `${workerUrl}${value}`;
}

async function readVerifiedPdf(fetcher: FetchLike, workerUrl: string, token: string, artifactUrl: unknown): Promise<Uint8Array | null> {
  const url = workerArtifactUrl(workerUrl, artifactUrl);
  if (!url) return null;
  const response = await fetcher(url, { headers: { authorization: `Bearer ${token}`, accept: "application/pdf" } });
  if (!response.ok || !response.headers.get("content-type")?.toLowerCase().startsWith("application/pdf")) return null;
  const bytes = new Uint8Array(await response.arrayBuffer());
  return bytes.byteLength >= 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d
    ? bytes
    : null;
}

/**
 * Reads only the stored Discovery File and its existing packet renderer. It never
 * invents packet content or bypasses the source system's review gates.
 */
export function createCloudflareSourceRunner({ workerUrl, apiToken, fetcher = fetch }: { workerUrl: string; apiToken: string; fetcher?: FetchLike }): SourceRunner {
  const baseUrl = workerUrl.replace(/\/+$/, "");
  return async (processCase) => {
    let discoveryResponse: Response;
    try {
      discoveryResponse = await fetcher(`${baseUrl}/api/discovery/file?estateId=${encodeURIComponent(processCase.estate.estateId)}`, { headers: sourceHeaders(apiToken) });
    } catch {
      return blocked("The Discovery File could not be reached from the document-prep worker.", "Retry when the source service is available.");
    }
    if (!discoveryResponse.ok) return blocked("The Discovery File is unavailable for document preparation.", "Review the estate's source service and retry.");
    const file = await discoveryResponse.json().catch(() => null) as DiscoveryFile | null;
    if (!file || file.ok !== true || file.exists !== true) {
      return reviewRequired("A persisted Discovery File is required before packet rendering.", "Run and review Discovery, including the approved IDI report import, before retrying.");
    }

    const existing = packetReference(file);
    const existingPdf = await readVerifiedPdf(fetcher, baseUrl, apiToken, existing?.artifactUrl);
    if (existingPdf) return { kind: "ready", pdf: existingPdf };

    if (!isObject(file.dossier)) {
      return reviewRequired("Discovery has no reviewed dossier ready for a packet render.", "Complete the source and IDI review, then run Discovery again before retrying.");
    }

    let exportResponse: Response;
    try {
      exportResponse = await fetcher(`${baseUrl}/api/exports`, {
        method: "POST",
        headers: { ...sourceHeaders(apiToken), "content-type": "application/json" },
        body: JSON.stringify({ dossier: file.dossier, estateId: processCase.estate.estateId, flow: "discovery", operatorIntent: "generate_packet", dryRun: true, routes: [] }),
      });
    } catch {
      return blocked("The verified Discovery packet renderer could not be reached.", "Retry when the source service is available.");
    }
    const exported = await exportResponse.json().catch(() => null) as PacketExport | null;
    if (!exportResponse.ok || exported?.ok !== true) {
      const firstBlocker = Array.isArray(exported?.blockers) && typeof exported.blockers[0] === "string" ? exported.blockers[0] : "Discovery packet validation needs review.";
      return reviewRequired(firstBlocker, "Resolve the visible Discovery review requirement, then retry document preparation.");
    }
    const generatedPdf = await readVerifiedPdf(fetcher, baseUrl, apiToken, exported.artifactUrl);
    if (!generatedPdf) {
      return blocked("The Discovery packet did not pass PDF readback from the source renderer.", "Retry after the source artifact is available and verified.");
    }
    return { kind: "ready", pdf: generatedPdf };
  };
}
