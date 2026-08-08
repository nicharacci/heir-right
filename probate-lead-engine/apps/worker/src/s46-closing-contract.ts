export const S46_CLOSING_ENABLED = false as const;

export const S46_CLOSING_POLICY = Object.freeze({
  version: 1,
  executionEnabled: S46_CLOSING_ENABLED,
  acceptedDiscoveryReceiptVersion: 1,
  legalConclusionsAllowed: false,
});

export type S46ClosingInput = {
  version: 1;
  discoveryJobId: string;
  discoveryArtifactSha256: string;
  verifiedFieldReceiptIds: string[];
};

export const S46_CLOSING_INPUT_SCHEMA = Object.freeze({
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  additionalProperties: false,
  required: ["version", "discoveryJobId", "discoveryArtifactSha256", "verifiedFieldReceiptIds"],
  properties: {
    version: { const: 1 },
    discoveryJobId: { type: "string", minLength: 1 },
    discoveryArtifactSha256: { type: "string", pattern: "^[a-f0-9]{64}$" },
    verifiedFieldReceiptIds: { type: "array", items: { type: "string", minLength: 1 } },
  },
});
