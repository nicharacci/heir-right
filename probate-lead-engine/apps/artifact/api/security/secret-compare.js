const { createHash, timingSafeEqual } = require("node:crypto");

function digest(value) {
  return createHash("sha256").update(String(value || "")).digest();
}

function secretMatches(actual, expected) {
  const actualValue = String(actual || "");
  const expectedValue = String(expected || "");
  const matches = timingSafeEqual(digest(actualValue), digest(expectedValue));
  return Boolean(actualValue && expectedValue && matches);
}

module.exports = { secretMatches };
