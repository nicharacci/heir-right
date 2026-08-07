export type S45NousEnv = {
  NOUS_API_KEY?: string;
  NOUS_BASE_URL?: string;
  NOUS_MODEL?: string;
};

type JsonRecord = Record<string, unknown>;
const stringValue = (value: unknown) => typeof value === "string" ? value.trim() : "";
const record = (value: unknown): JsonRecord => value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};

function outputText(response: JsonRecord): string {
  const direct = stringValue(response.output_text);
  if (direct) return direct;
  const output = Array.isArray(response.output) ? response.output : [];
  return output.flatMap((item) => { const content = record(item).content; return Array.isArray(content) ? content : []; })
    .map((item) => stringValue(record(item).text)).filter(Boolean).join(" ").trim();
}

function compliant(value: string): string {
  const text = value.replace(/\s+/g, " ").trim();
  if (!text || text.length >= 500) throw new Error("nous_backstory_not_compliant");
  if (/\b(heir|inherit|inheritance|legal conclusion|entitled|ownership)\b/i.test(text)) throw new Error("nous_backstory_unsupported_legal_conclusion");
  return text;
}

/** Generates a concise factual Back Story from verified Browserbase obituary evidence. */
export async function generateS45Backstory(env: S45NousEnv, input: { ownerName: string; dateOfBirth: string; dateOfDeath: string; obituarySnapshot: string }): Promise<string> {
  const apiKey = stringValue(env.NOUS_API_KEY);
  const apiBase = stringValue(env.NOUS_BASE_URL).replace(/\/$/, "");
  const model = stringValue(env.NOUS_MODEL);
  if (!apiKey || !apiBase || !model) throw new Error("nous_backstory_unconfigured");
  if (!input.obituarySnapshot) throw new Error("nous_backstory_source_missing");
  const prompt = [
    "Write one concise professional Back Story for a Discovery Family Tree.",
    "Use only the supplied obituary facts. Keep it below 500 characters.",
    "Do not state or imply legal status, inheritance, ownership, or entitlement.",
    "Do not include a heading, citation, source text, or analysis.",
    "Subject: " + input.ownerName,
    "DOB: " + input.dateOfBirth,
    "DOD: " + input.dateOfDeath,
    "Verified obituary source text: " + input.obituarySnapshot,
  ].join("\n");
  const response = await fetch(apiBase + "/responses", {
    method: "POST",
    headers: { authorization: "Bearer " + apiKey, accept: "application/json", "content-type": "application/json" },
    body: JSON.stringify({ model, input: prompt, max_output_tokens: 160, temperature: 0.2 }),
  });
  if (!response.ok) throw new Error("nous_backstory_request_failed_" + response.status);
  return compliant(outputText(record(await response.json().catch(() => ({})))));
}
