/** S45 architecture-only Closing contract. It remains disabled and has no renderer or route. */
export const S45_CLOSING_ENABLED = false;
export const S45_CLOSING_POLICY = Object.freeze({
  allowedFields: ["closing_date", "buyer", "seller", "property_address"],
  prohibitedOutputs: ["legal_conclusion", "legal_advice", "closing_pdf"],
});
export type S45ClosingFixture = { source: "fixture"; fields: Record<string, string | null> };
export const S45_CLOSING_TEMPLATE_CONTRACT = Object.freeze({ version: 1, flow: "closing-docs", enabled: false });
