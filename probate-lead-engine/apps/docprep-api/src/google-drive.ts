export type GoogleDriveCredentials = {
  accessToken: string;
  parentFolderId?: string;
  expiresAt?: string;
};

export type GoogleDriveCredentialProvider = (options?: { forceRefresh?: boolean }) => Promise<GoogleDriveCredentials>;

type GoogleDriveCredentialProviderConfig = {
  workerUrl?: string;
  brokerToken?: string;
  fetcher?: typeof fetch;
  now?: () => number;
};

const CACHE_MARGIN_MS = 60_000;

function cacheUsable(credentials: GoogleDriveCredentials | null, now: number): credentials is GoogleDriveCredentials {
  if (!credentials?.accessToken) return false;
  const expiresAt = Date.parse(credentials.expiresAt || "");
  return Number.isFinite(expiresAt) && expiresAt > now + CACHE_MARGIN_MS;
}

/**
 * Resolves a short-lived Drive access token from the internal Cloudflare broker.
 * The browser never sees this response, and the refresh token remains encrypted
 * in the existing Workspace connection record.
 */
export function createGoogleDriveCredentialProvider({
  workerUrl,
  brokerToken,
  fetcher = fetch,
  now = () => Date.now(),
}: GoogleDriveCredentialProviderConfig): GoogleDriveCredentialProvider {
  const base = String(workerUrl || "").replace(/\/+$/, "");
  const token = String(brokerToken || "");
  let cached: GoogleDriveCredentials | null = null;
  let inFlight: Promise<GoogleDriveCredentials> | null = null;

  async function requestCredentials(): Promise<GoogleDriveCredentials> {
    if (!base || !token) throw new Error("Google Drive credential broker is not configured.");
    const response = await fetcher(`${base}/internal/doc-prep/google-drive-credentials`, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${token}`,
      },
    });
    const body = await response.json().catch(() => ({})) as {
      ok?: boolean;
      accessToken?: unknown;
      parentFolderId?: unknown;
      expiresAt?: unknown;
    };
    if (!response.ok || body.ok !== true || typeof body.accessToken !== "string" || !body.accessToken) {
      throw new Error(response.status === 401 || response.status === 403
        ? "Google Drive credential broker rejected this service."
        : "Google Drive credential broker is unavailable.");
    }
    const expiresAt = typeof body.expiresAt === "string" && Number.isFinite(Date.parse(body.expiresAt))
      ? body.expiresAt
      : new Date(now() + CACHE_MARGIN_MS).toISOString();
    return {
      accessToken: body.accessToken,
      ...(typeof body.parentFolderId === "string" && body.parentFolderId ? { parentFolderId: body.parentFolderId } : {}),
      expiresAt,
    };
  }

  return async ({ forceRefresh = false } = {}) => {
    if (!forceRefresh && cacheUsable(cached, now())) return cached;
    if (!forceRefresh && inFlight) return inFlight;
    const request = requestCredentials();
    if (!forceRefresh) inFlight = request;
    try {
      const resolved = await request;
      cached = resolved;
      return resolved;
    } finally {
      if (inFlight === request) inFlight = null;
    }
  };
}
