const ENTITY_OWNER_PATTERN = /\b(LLC|L\.L\.C\.|INC|CORP|CORPORATION|COMPANY|CO\.|LTD|LP|LLP|BANK|ASSOCIATION|ASSOC|FOUNDATION|ENTERPRISES?|HOLDINGS?|INVESTMENTS?|REALTY|PROPERTIES|CHURCH|IGLESIA|MINISTRIES|CONDO|COOPERATIVE)(?![A-Z0-9_])/i;
const TRUST_OR_ESTATE_OWNER_PATTERN = /\b(TRUST|TRUSTEE|ESTATE|EST\.?\s+OF)\b/i;

export function isEntityOwnerName(value: unknown): boolean {
  return ENTITY_OWNER_PATTERN.test(String(value || ""));
}

export function isTrustOrEstateOwnerName(value: unknown): boolean {
  return TRUST_OR_ESTATE_OWNER_PATTERN.test(String(value || ""));
}

export { ENTITY_OWNER_PATTERN, TRUST_OR_ESTATE_OWNER_PATTERN };
