import type { IntakeSeed, ReviewFlag, SourceFact } from "@ple/types";
import { fact, intakeSubject, nowIso, seedIdentity, slug } from "../lib";

type RuntimeEnv = Record<string, string | undefined>;

export interface EnrichedAddressHistory {
  address: string;
  county?: string;
  dates?: string;
  sourceUrl?: string;
}

export interface EnrichedContactProfile {
  name: string;
  role?: string;
  age?: number;
  likelyCurrentAddress?: string;
  addressHistory: EnrichedAddressHistory[];
  phones: string[];
  emails: string[];
  relatives: string[];
  profileUrl?: string;
  provider: string;
  confidence: number;
  fetchedAt: string;
}

export interface SkipTraceResult {
  ok: boolean;
  provider: string;
  profiles: EnrichedContactProfile[];
  reason?: string;
  reviewFlags: ReviewFlag[];
}

const DEFAULT_APIFY_ACTOR = "apivault_labs/skip-trace-people-finder";

function clean(input: unknown): string | undefined {
  if (typeof input !== "string") return undefined;
  const value = input.trim();
  return value || undefined;
}

function arrayOfStrings(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return Array.from(new Set(input.map(clean).filter((item): item is string => Boolean(item))));
}

function numberValue(input: unknown): number | undefined {
  if (typeof input === "number" && Number.isFinite(input)) return input;
  if (typeof input !== "string") return undefined;
  const parsed = Number(input.replace(/[^\d.]/g, ""));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function firstString(item: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = clean(item[key]);
    if (value) return value;
  }
  return undefined;
}

function stringsFromUnknown(input: unknown): string[] {
  if (Array.isArray(input)) {
    return arrayOfStrings(input.map((item) => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object") {
        const record = item as Record<string, unknown>;
        return firstString(record, ["phone", "number", "value", "email", "address", "fullAddress", "name"]);
      }
      return undefined;
    }));
  }
  const value = clean(input);
  return value ? [value] : [];
}

function addressesFromUnknown(input: unknown): EnrichedAddressHistory[] {
  if (!Array.isArray(input)) return [];
  return input.flatMap((item) => {
    if (typeof item === "string") return [{ address: item }];
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const address = firstString(record, ["address", "fullAddress", "streetAddress", "value"]);
    if (!address) return [];
    return [{
      address,
      county: firstString(record, ["county", "countyName", "parish", "borough"]),
      dates: firstString(record, ["dates", "dateRange", "range", "period"]),
      sourceUrl: firstString(record, ["url", "sourceUrl", "profileUrl"]),
    }];
  });
}

function profileFromItem(item: Record<string, unknown>, provider: string, fetchedAt: string): EnrichedContactProfile | null {
  const name = firstString(item, ["name", "fullName", "personName", "ownerName"]);
  if (!name) return null;
  const phones = [
    ...stringsFromUnknown(item.phones),
    ...stringsFromUnknown(item.phoneNumbers),
    ...stringsFromUnknown(item.phone),
  ];
  const emails = [
    ...stringsFromUnknown(item.emails),
    ...stringsFromUnknown(item.emailAddresses),
    ...stringsFromUnknown(item.email),
  ];
  const addressHistory = [
    ...addressesFromUnknown(item.addresses),
    ...addressesFromUnknown(item.addressHistory),
    ...addressesFromUnknown(item.previousAddresses),
  ];
  const likelyCurrentAddress = firstString(item, ["currentAddress", "likelyCurrentAddress", "address", "fullAddress"])
    ?? addressHistory[0]?.address;
  return {
    name,
    role: firstString(item, ["role", "relationship"]),
    age: numberValue(item.age),
    likelyCurrentAddress,
    addressHistory,
    phones: Array.from(new Set(phones)),
    emails: Array.from(new Set(emails)),
    relatives: stringsFromUnknown(item.relatives),
    profileUrl: firstString(item, ["profileUrl", "url", "sourceUrl"]),
    provider,
    confidence: numberValue(item.confidence) ?? 0.72,
    fetchedAt,
  };
}

function profilesFromItems(items: unknown[], provider: string, fetchedAt: string): EnrichedContactProfile[] {
  return items.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    if (Array.isArray(record.people)) return profilesFromItems(record.people, provider, fetchedAt);
    if (Array.isArray(record.results)) return profilesFromItems(record.results, provider, fetchedAt);
    const profile = profileFromItem(record, provider, fetchedAt);
    return profile ? [profile] : [];
  });
}

async function runApifyProvider(seed: IntakeSeed, env: RuntimeEnv, fetchImpl: typeof fetch): Promise<SkipTraceResult> {
  const token = env.APIFY_TOKEN ?? env.SKIPTRACE_API_KEY;
  if (!token) {
    return {
      ok: false,
      provider: "apify",
      profiles: [],
      reason: "Missing APIFY_TOKEN or SKIPTRACE_API_KEY.",
      reviewFlags: ["MISSING_SKIPTRACE_CONFIG", "NO_ENRICHMENT_RUN", "CONTACT_REVIEW_REQUIRED"],
    };
  }

  const actor = (env.APIFY_SKIPTRACE_ACTOR ?? env.SKIPTRACE_APIFY_ACTOR ?? DEFAULT_APIFY_ACTOR).replace("/", "~");
  const url = `https://api.apify.com/v2/acts/${actor}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}`;
  const queryName = seed.estateName?.replace(/^estate\s+of\s+/i, "").replace(/\s+est\s+of$/i, "").trim() || seed.ownerName;
  const payload = {
    name: queryName ? [queryName] : [],
    ownerName: seed.ownerName,
    estateName: seed.estateName,
    propertyAddress: seed.propertyAddress,
    address: seed.propertyAddress,
    county: seed.county,
    parcelId: seed.parcelId,
    queries: [{
      name: seed.estateName?.replace(/^estate\s+of\s+/i, "").replace(/\s+est\s+of$/i, "").trim() || seed.ownerName,
      address: seed.propertyAddress,
      county: seed.county,
    }],
  };

  try {
    const response = await fetchImpl(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await response.json().catch(() => []);
    const items = Array.isArray(body) ? body : [body];
    const profiles = profilesFromItems(items, "apify", nowIso());
    return {
      ok: response.ok && profiles.length > 0,
      provider: "apify",
      profiles,
      reason: response.ok ? undefined : `Apify skip-trace actor returned HTTP ${response.status}.`,
      reviewFlags: response.ok && profiles.length
        ? ["CONTACT_REVIEW_REQUIRED"]
        : ["SKIPTRACE_PROVIDER_FAILED", "CONTACT_REVIEW_REQUIRED"],
    };
  } catch (error) {
    return {
      ok: false,
      provider: "apify",
      profiles: [],
      reason: error instanceof Error ? error.message : String(error),
      reviewFlags: ["SKIPTRACE_PROVIDER_FAILED", "CONTACT_REVIEW_REQUIRED"],
    };
  }
}

export async function fetchSkipTraceFacts(runId: string, seed: IntakeSeed, env: RuntimeEnv = {}, fetchImpl: typeof fetch = fetch): Promise<SourceFact[]> {
  const fetchedAt = nowIso();
  const subject = intakeSubject(seed);
  const identity = slug(seedIdentity(seed));
  const provider = (env.SKIPTRACE_PROVIDER ?? (env.APIFY_TOKEN ? "apify" : "")).toLowerCase();
  const result = provider === "apify"
    ? await runApifyProvider(seed, env, fetchImpl)
    : {
      ok: false,
      provider: provider || "not_configured",
      profiles: [],
      reason: "Set SKIPTRACE_PROVIDER=apify and APIFY_TOKEN, or set SKIPTRACE_API_KEY for the configured provider.",
      reviewFlags: ["MISSING_SKIPTRACE_CONFIG", "NO_ENRICHMENT_RUN", "CONTACT_REVIEW_REQUIRED"] as ReviewFlag[],
    };

  return [
    fact({
      runId,
      source: "skip_trace",
      rawId: `skip-trace:${identity}:status`,
      fetchedAt,
      county: seed.county,
      subject,
      factType: "skip_trace_status",
      value: {
        provider: result.provider,
        ok: result.ok,
        profileCount: result.profiles.length,
        reason: result.reason,
      },
      confidence: result.ok ? 0.75 : 0,
      reviewFlags: result.reviewFlags,
    }),
    ...result.profiles.map((profile, index) => fact({
      runId,
      source: "skip_trace",
      rawId: `skip-trace:${identity}:profile:${index + 1}`,
      fetchedAt: profile.fetchedAt,
      county: seed.county,
      subject,
      factType: "enriched_contact_profile",
      value: profile,
      confidence: profile.confidence,
      sourceUrl: profile.profileUrl,
      reviewFlags: ["CONTACT_REVIEW_REQUIRED"],
    })),
  ];
}
