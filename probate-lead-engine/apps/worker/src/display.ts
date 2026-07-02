export function formatCountyName(value: unknown, fallback = "County needs review"): string {
  const raw = String(value ?? fallback).trim();
  if (!raw) return fallback;
  if (/needs review|missing|blocked|unknown/i.test(raw)) {
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  }
  const normalized = raw
    .replace(/_/g, " ")
    .replace(/\s*-\s*/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/\b([a-z])/g, (letter) => letter.toUpperCase())
    .replace(/\bFl\b/g, "FL");
  return normalized
    .replace(/\bMiami Dade\b/g, "Miami-Dade")
    .replace(/\bCounty,\s*Fl\b/g, "County, FL")
    .replace(/\bCounty\s+Fl\b/g, "County, FL");
}
