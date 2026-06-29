export const TEXAS_EQUITY_PROS_LEADS_APP_ID = "24265877";
export const TEXAS_EQUITY_PROS_LEADS_SPACE_ID = "7008942";
export const TEXAS_EQUITY_PROS_LEADS_WORKSPACE = "Texas Equity Pros LLC";
export const TEXAS_EQUITY_PROS_LEADS_APP = "Leads";
export const PODIO_LIVE_WRITE_APPROVAL_KEY = "PODIO_LIVE_WRITE_APPROVED";
export const PODIO_CSV_BACKUP_CONFIRMATION_KEY = "PODIO_CSV_BACKUP_CONFIRMED";

type RuntimeEnv = Record<string, string | undefined>;

export type PodioMappedValue = string | number | boolean;
export type PodioFieldKind = "text" | "category" | "date" | "location" | "contact";

export type PodioFieldMapEntry =
  | string
  | {
    field: string;
    kind?: PodioFieldKind;
    requiredForLive?: boolean;
    defaultValue?: PodioMappedValue | "today";
    defaultEnv?: string;
    valueByInput?: Record<string, PodioMappedValue>;
  };

export type PodioFieldMap = Record<string, PodioFieldMapEntry>;

export interface PodioFieldMapResolution {
  map: PodioFieldMap;
  source: "env" | "texas_equity_pros_leads_preset" | "missing";
  blockers: string[];
}

export const TEXAS_EQUITY_PROS_LEADS_FIELD_MAP: PodioFieldMap = {
  estate_name: "address-2",
  lead_status: {
    field: "lead-status",
    kind: "category",
    defaultValue: 2,
    valueByInput: {
      cold: 2,
      controlled_test: 2,
      hot: 6,
      internal_draft: 2,
      review_required: 2,
      warm: 4,
    },
  },
  report_status: {
    field: "lead-status",
    kind: "category",
    defaultValue: 2,
    valueByInput: {
      controlled_test: 2,
      internal_draft: 2,
      review_required: 2,
    },
  },
  deal_status: {
    field: "deal-status",
    kind: "category",
    defaultValue: 5,
    valueByInput: {
      controlled_test: 5,
      follow_up: 4,
      needs_to_be_contacted: 5,
      review_required: 5,
    },
  },
  phone: {
    field: "phone",
    defaultEnv: "PODIO_TEST_PHONE",
    requiredForLive: true,
  },
  date_created: {
    field: "date",
    kind: "date",
    defaultValue: "today",
  },
  spanish_lead: {
    field: "spanish-lead",
    kind: "category",
    defaultValue: 2,
    valueByInput: {
      no: 2,
      yes: 1,
    },
  },
  property_address: {
    field: "map-address",
    kind: "location",
  },
  email: {
    field: "email-2",
    defaultEnv: "PODIO_TEST_EMAIL",
    requiredForLive: true,
  },
  lead_source: {
    field: "campaign-list",
    defaultValue: "HeirRight controlled API test",
  },
  lead_point: {
    field: "who-is-in-charge-of-lead",
    kind: "contact",
    defaultEnv: "PODIO_LEAD_POINT_PROFILE_ID",
    requiredForLive: true,
  },
  first_call: {
    field: "first-call",
    kind: "category",
    defaultValue: 1,
    valueByInput: {
      emailed: 4,
      n_a: 1,
      no: 3,
      not_reached: 5,
      yes: 2,
    },
  },
  asking_price: {
    field: "asking-price",
    defaultValue: "0",
  },
  occupancy: {
    field: "is-anyone-living-at-the-house",
    kind: "category",
    defaultValue: 3,
    valueByInput: {
      owner_occupied: 1,
      rented: 2,
      vacant: 3,
    },
  },
  best_call_time: {
    field: "when-is-the-best-time-to-call",
    kind: "category",
    defaultValue: 1,
    valueByInput: {
      afternoon: 3,
      anytime: 1,
      evening: 4,
      morning: 2,
    },
  },
  listed: {
    field: "listed",
    kind: "category",
    defaultValue: 2,
    valueByInput: {
      no: 2,
      yes: 1,
    },
  },
  report_link: "family-tree-link",
  case_number: "case-number",
};

function parsePodioFieldMap(raw: string): PodioFieldMapResolution {
  try {
    const parsed = JSON.parse(raw) as PodioFieldMap;
    return { map: parsed, source: "env", blockers: [] };
  } catch (error) {
    return {
      map: {},
      source: "missing",
      blockers: [`PODIO_FIELD_MAP_JSON is not valid JSON: ${error instanceof Error ? error.message : String(error)}`],
    };
  }
}

export function resolvePodioFieldMap(env: RuntimeEnv): PodioFieldMapResolution {
  const hasTexasPreset = env.PODIO_APP_ID === TEXAS_EQUITY_PROS_LEADS_APP_ID;
  if (env.PODIO_FIELD_MAP_JSON) {
    const parsed = parsePodioFieldMap(env.PODIO_FIELD_MAP_JSON);
    if (parsed.blockers.length) return parsed;
    return {
      map: hasTexasPreset
        ? { ...TEXAS_EQUITY_PROS_LEADS_FIELD_MAP, ...parsed.map }
        : parsed.map,
      source: "env",
      blockers: [],
    };
  }

  if (hasTexasPreset) {
    return {
      map: TEXAS_EQUITY_PROS_LEADS_FIELD_MAP,
      source: "texas_equity_pros_leads_preset",
      blockers: [],
    };
  }

  return {
    map: {},
    source: "missing",
    blockers: ["Missing Podio export config: PODIO_FIELD_MAP_JSON or PODIO_APP_ID=24265877"],
  };
}

export function podioMissingExportConfig(env: RuntimeEnv): string[] {
  const missing = ["PODIO_ACCESS_TOKEN", "PODIO_APP_ID"].filter((key) => !env[key]);
  const fieldMap = resolvePodioFieldMap(env);
  if (fieldMap.blockers.length) {
    missing.push("PODIO_FIELD_MAP_JSON or PODIO_APP_ID=24265877");
  }
  return missing;
}

export function podioLiveWriteApproved(env: RuntimeEnv): boolean {
  return env[PODIO_LIVE_WRITE_APPROVAL_KEY] === "true";
}

export function podioCsvBackupConfirmed(env: RuntimeEnv): boolean {
  return env[PODIO_CSV_BACKUP_CONFIRMATION_KEY] === "true";
}
