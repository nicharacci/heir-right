const DEFAULT_NOUS_BASE_URL = "https://inference-api.nousresearch.com/v1";
const DYNAMIC_FREE_CATALOG = "dynamic-free-catalog";
const CATALOG_CACHE_MS = 5 * 60 * 1_000;

export interface NousFreeModelCredential {
  provider: "nous";
  authType: "api_key";
  credential: string;
  refreshToken: null;
  baseUrl: string;
  model: string;
  verifiedModels: string[];
  verifiedFreeModels: string[];
  lastVerifiedAt: string;
  expiresAt: null;
}

interface NousCatalogEntry {
  id: string;
  pricing?: { prompt?: unknown; completion?: unknown };
  architecture?: { output_modalities?: unknown; modality?: unknown };
}

interface CachedNousCatalog {
  expiresAt: number;
  credential: NousFreeModelCredential | null;
}

let cachedCatalog: CachedNousCatalog | null = null;

export interface ServerNousCredentialDependencies {
  fetcher?: typeof fetch;
  now?: () => number;
  apiKey?: string | null;
  baseUrl?: string | null;
  configuredModel?: string | null;
}

// The shared Nous allowance is deliberately broker-only. A personal ready
// connection always wins before this fallback is consulted.
export async function getServerNousCredential(
  dependencies: ServerNousCredentialDependencies = {},
): Promise<NousFreeModelCredential | null> {
  const token = dependencies.apiKey === undefined
    ? nodeEnvValue("NOUS_API_KEY")
    : String(dependencies.apiKey || "").trim();
  if (!token) return null;
  const now = dependencies.now?.() ?? Date.now();
  if (cachedCatalog && cachedCatalog.expiresAt > now) {
    return cachedCatalog.credential;
  }

  const configured = dependencies.configuredModel === undefined
    ? configuredNousModel()
    : String(dependencies.configuredModel || "").trim() || null;
  const credential = await discoverServerNousCredential({
    token,
    configured,
    fetcher: dependencies.fetcher ?? fetch,
    baseUrl: dependencies.baseUrl,
  });
  cachedCatalog = { expiresAt: now + CATALOG_CACHE_MS, credential };
  return credential;
}

export function resetServerNousCredentialCache(): void {
  cachedCatalog = null;
}

async function discoverServerNousCredential(input: {
  token: string;
  configured: string | null;
  fetcher: typeof fetch;
  baseUrl?: string | null;
}): Promise<NousFreeModelCredential | null> {
  const fallback = credentialFromModels(input.token, input.configured, [], input.baseUrl);
  try {
    const response = await input.fetcher(`${serverNousBaseUrl(input.baseUrl)}/models`, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${input.token}`,
      },
      redirect: "error",
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) return fallback;
    const body = await response.json().catch(() => null);
    const models = modelEntries(body);
    return credentialFromModels(input.token, input.configured, models, input.baseUrl);
  } catch {
    return fallback;
  }
}

function credentialFromModels(
  token: string,
  configured: string | null,
  entries: NousCatalogEntry[],
  baseUrl?: string | null,
): NousFreeModelCredential | null {
  const modelIds = unique(entries.map((entry) => entry.id));
  const freeModels = unique(
    entries.filter(isFreeTextModel).map((entry) => entry.id),
  );
  const selected = configured ?? freeModels[0] ?? null;
  if (!selected) return null;
  const verifiedModels = unique([...modelIds, selected]);
  const verifiedFreeModels = unique(
    configured && !freeModels.length ? [configured] : freeModels,
  );
  if (!verifiedFreeModels.length) return null;
  return {
    provider: "nous",
    authType: "api_key",
    credential: token,
    refreshToken: null,
    baseUrl: serverNousBaseUrl(baseUrl),
    model: selected,
    verifiedModels,
    verifiedFreeModels,
    lastVerifiedAt: new Date().toISOString(),
    expiresAt: null,
  };
}

function serverNousBaseUrl(baseUrl?: string | null): string {
  return (
    String(baseUrl === undefined ? nodeEnvValue("NOUS_BASE_URL") : baseUrl || "").trim().replace(/\/+$/, "") ||
    DEFAULT_NOUS_BASE_URL
  );
}

function configuredNousModel(): string | null {
  const value = nodeEnvValue("NOUS_MODEL");
  return value && value !== DYNAMIC_FREE_CATALOG ? value : null;
}

function nodeEnvValue(name: string): string {
  if (typeof process === "undefined" || !process.env) return "";
  return String(process.env[name] || "").trim();
}

function modelEntries(value: unknown): NousCatalogEntry[] {
  if (!value || typeof value !== "object") return [];
  const data = (value as { data?: unknown }).data;
  if (!Array.isArray(data)) return [];
  return data.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const candidate = entry as NousCatalogEntry;
    return typeof candidate.id === "string" && candidate.id.trim()
      ? [{ ...candidate, id: candidate.id.trim() }]
      : [];
  });
}

function isFreeTextModel(entry: NousCatalogEntry): boolean {
  if (!isTextOutput(entry)) return false;
  const id = entry.id.toLowerCase();
  if (id.includes(":free") || id.endsWith("-free")) return true;
  return (
    price(entry.pricing?.prompt) === 0 && price(entry.pricing?.completion) === 0
  );
}

function isTextOutput(entry: NousCatalogEntry): boolean {
  const modalities = entry.architecture?.output_modalities;
  if (Array.isArray(modalities)) return modalities.includes("text");
  const modality = entry.architecture?.modality;
  return (
    typeof modality !== "string" ||
    modality.endsWith("->text") ||
    modality.includes("text")
  );
}

function price(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function unique(values: string[]): string[] {
  return Array.from(
    new Set(values.map((value) => value.trim()).filter(Boolean)),
  );
}

export const nousDynamicModelId = DYNAMIC_FREE_CATALOG;

export function publicNousFreeModelStatus(credential: NousFreeModelCredential | null): {
  available: boolean;
  provider: "nous";
  model: string | null;
  freeModels: string[];
  route: "dynamic-free-catalog" | "configured-free-model" | "unavailable";
} {
  const model = credential?.model || null;
  return {
    available: Boolean(credential && model),
    provider: "nous",
    model,
    freeModels: credential?.verifiedFreeModels || [],
    route: credential
      ? credential.verifiedFreeModels.length > 1 || credential.model === credential.verifiedFreeModels[0]
        ? "dynamic-free-catalog"
        : "configured-free-model"
      : "unavailable",
  };
}
