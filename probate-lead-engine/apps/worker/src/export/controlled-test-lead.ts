import type { IntakeSeed } from "@ple/types";

type RuntimeEnv = Record<string, string | undefined>;

function compactStamp(now: Date): string {
  return now.toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
}

export function buildControlledPodioTestSeed(env: RuntimeEnv = {}, now = new Date()): IntakeSeed {
  const stamp = compactStamp(now);
  const label = env.PODIO_TEST_LEAD_NAME || `HeirRight Podio Test ${stamp}`;
  return {
    ownerName: label,
    estateName: label,
    propertyAddress: env.PODIO_TEST_PROPERTY_ADDRESS || "100 Controlled Test Lead, Miami, FL 33101",
    caseNumber: env.PODIO_TEST_CASE_NUMBER || `PODIO-TEST-${stamp}`,
    county: env.PODIO_TEST_COUNTY || "miami-dade",
    parcelId: env.PODIO_TEST_FOLIO || `TEST-${stamp}`,
    source: "operator_cli",
    seedBatchId: `podio-controlled-test-${stamp}`,
    seedSourceLabel: "HeirRight controlled Podio test lead",
    sourceOwner: "HeirRight operator UI",
    approvalMarker: "approved_controlled_podio_test_export",
  };
}
