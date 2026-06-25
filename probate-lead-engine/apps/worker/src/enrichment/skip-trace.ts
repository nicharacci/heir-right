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
const DEFAULT_APIFY_SOURCE = "merge";
const DEFAULT_APIFY_MAX_RESULTS = 10;

function readProcessEnv(): RuntimeEnv {
  return typeof process !== "undefined" ? process.env : {};
}

function runtimeEnv(env: RuntimeEnv = {}): RuntimeEnv {
  return { ...readProcessEnv(), ...env };
}

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

function clampNumber(input: unknown, fallback: number, min: number, max: number): number {
  const value = numberValue(input) ?? fallback;
  return Math.max(min, Math.min(max, Math.round(value)));
}

function confidenceValue(input: unknown): number {
  const parsed = numberValue(input);
  if (!parsed || parsed <= 0) return 0.72;
  if (parsed > 1) return Math.min(parsed / 100, 1);
  return parsed;
}

function firstString(item: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = clean(item[key]);
    if (value) return value;
    if (item[key] && typeof item[key] === "object") {
      const nested = item[key] as Record<string, unknown>;
      const nestedValue = firstString(nested, ["formatted", "full", "value", "address", "phone", "email", "name"]);
      if (nestedValue) return nestedValue;
    }
  }
  return undefined;
}

function stringsFromUnknown(input: unknown, keys: string[] = [
  "phone",
  "phoneNumber",
  "phone_number",
  "number",
  "value",
  "email",
  "emailAddress",
  "email_address",
  "address",
  "fullAddress",
  "full_address",
  "formatted",
  "name",
  "fullName",
  "full_name",
]): string[] {
  if (Array.isArray(input)) {
    return Array.from(new Set(input.flatMap((item) => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object") {
        const record = item as Record<string, unknown>;
        return firstString(record, keys);
      }
      return undefined;
    }).map(clean).filter((item): item is string => Boolean(item))));
  }
  if (input && typeof input === "object") {
    const value = firstString(input as Record<string, unknown>, keys);
    return value ? [value] : [];
  }
  const value = clean(input);
  return value ? [value] : [];
}

function addressesFromUnknown(input: unknown): EnrichedAddressHistory[] {
  const items = Array.isArray(input) ? input : input ? [input] : [];
  return items.flatMap((item) => {
    if (typeof item === "string") return [{ address: item }];
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const address = firstString(record, [
      "address",
      "fullAddress",
      "full_address",
      "formatted",
      "streetAddress",
      "street_address",
      "street_citystatezip",
      "value",
    ]);
    if (!address) return [];
    return [{
      address,
      county: firstString(record, ["county", "countyName", "county_name", "parish", "borough"]),
      dates: firstString(record, ["dates", "dateRange", "date_range", "range", "period"]),
      sourceUrl: firstString(record, ["url", "sourceUrl", "source_url", "profileUrl", "profile_url"]),
    }];
  });
}

function profileFromItem(item: Record<string, unknown>, provider: string, fetchedAt: string): EnrichedContactProfile | null {
  const name = firstString(item, ["name", "fullName", "full_name", "personName", "person_name", "ownerName", "displayName"])
    ?? arrayOfStrings([item.firstName, item.first_name, item.lastName, item.last_name]).join(" ");
  if (!name) return null;
  const phones = [
    ...stringsFromUnknown(item.phones),
    ...stringsFromUnknown(item.phoneNumbers),
    ...stringsFromUnknown(item.phone_numbers),
    ...stringsFromUnknown(item.mobilePhones),
    ...stringsFromUnknown(item.mobile_phones),
    ...stringsFromUnknown(item.landlinePhones),
    ...stringsFromUnknown(item.landline_phones),
    ...stringsFromUnknown(item.bestPhone),
    ...stringsFromUnknown(item.best_phone),
    ...stringsFromUnknown(item.phone_number),
    ...stringsFromUnknown(item.phone),
  ];
  const emails = [
    ...stringsFromUnknown(item.emails),
    ...stringsFromUnknown(item.emailAddresses),
    ...stringsFromUnknown(item.email_addresses),
    ...stringsFromUnknown(item.bestEmail),
    ...stringsFromUnknown(item.best_email),
    ...stringsFromUnknown(item.email),
  ];
  const addressHistory = [
    ...addressesFromUnknown(item.currentAddress),
    ...addressesFromUnknown(item.current_address),
    ...addressesFromUnknown(item.likelyCurrentAddress),
    ...addressesFromUnknown(item.likely_current_address),
    ...addressesFromUnknown(item.address),
    ...addressesFromUnknown(item.addresses),
    ...addressesFromUnknown(item.addressHistory),
    ...addressesFromUnknown(item.address_history),
    ...addressesFromUnknown(item.previousAddresses),
    ...addressesFromUnknown(item.previous_addresses),
    ...addressesFromUnknown(item.pastAddresses),
    ...addressesFromUnknown(item.past_addresses),
  ];
  const likelyCurrentAddress = firstString(item, [
    "currentAddress",
    "current_address",
    "likelyCurrentAddress",
    "likely_current_address",
    "address",
    "fullAddress",
    "full_address",
    "street_citystatezip",
  ])
    ?? addressHistory[0]?.address;
  return {
    name,
    role: firstString(item, ["role", "relationship"]),
    age: numberValue(item.age),
    likelyCurrentAddress,
    addressHistory: addressHistory.filter((address, index, list) => list.findIndex((item) => item.address === address.address) === index),
    phones: Array.from(new Set(phones)),
    emails: Array.from(new Set(emails)),
    relatives: Array.from(new Set([
      ...stringsFromUnknown(item.relatives),
      ...stringsFromUnknown(item.relatedPeople),
      ...stringsFromUnknown(item.related_people),
      ...stringsFromUnknown(item.family),
      ...stringsFromUnknown(item.associates),
    ])),
    profileUrl: firstString(item, ["profileUrl", "profile_url", "url", "sourceUrl", "source_url"]),
    provider,
    confidence: confidenceValue(item.confidence),
    fetchedAt,
  };
}

function profilesFromItems(items: unknown[], provider: string, fetchedAt: string): EnrichedContactProfile[] {
  return items.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    if (Array.isArray(record.people)) return profilesFromItems(record.people, provider, fetchedAt);
    if (Array.isArray(record.results)) return profilesFromItems(record.results, provider, fetchedAt);
    if (Array.isArray(record.records)) return profilesFromItems(record.records, provider, fetchedAt);
    if (Array.isArray(record.items)) return profilesFromItems(record.items, provider, fetchedAt);
    if (Array.isArray(record.data)) return profilesFromItems(record.data, provider, fetchedAt);
    if (Array.isArray(record.matches)) return profilesFromItems(record.matches, provider, fetchedAt);
    if (Array.isArray(record.matchedPeople)) return profilesFromItems(record.matchedPeople, provider, fetchedAt);
    if (Array.isArray(record.matched_people)) return profilesFromItems(record.matched_people, provider, fetchedAt);
    if (record.data && typeof record.data === "object") return profilesFromItems([record.data], provider, fetchedAt);
    if (record.result && typeof record.result === "object") return profilesFromItems([record.result], provider, fetchedAt);
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
  const location = arrayOfStrings([seed.propertyAddress, seed.county]).join("; ");
  const source = env.APIFY_SKIPTRACE_SOURCE ?? env.SKIPTRACE_SOURCE ?? DEFAULT_APIFY_SOURCE;
  const maxResults = clampNumber(env.APIFY_SKIPTRACE_MAX_RESULTS ?? env.SKIPTRACE_MAX_RESULTS, DEFAULT_APIFY_MAX_RESULTS, 1, 50);
  const payload = {
    ...(queryName ? { name: [location ? `${queryName}; ${location}` : queryName] } : {}),
    ...(seed.propertyAddress ? { street_citystatezip: [seed.propertyAddress] } : {}),
    source,
    max_results: maxResults,
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
  const resolvedEnv = runtimeEnv(env);
  const fetchedAt = nowIso();
  const subject = intakeSubject(seed);
  const identity = slug(seedIdentity(seed));
  const provider = (resolvedEnv.SKIPTRACE_PROVIDER ?? (resolvedEnv.APIFY_TOKEN || resolvedEnv.SKIPTRACE_API_KEY ? "apify" : "")).toLowerCase();
  const result = provider === "apify"
    ? await runApifyProvider(seed, resolvedEnv, fetchImpl)
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
