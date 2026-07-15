const VERIFIED_ARTIFACT_ROUTES = Object.freeze({
  "/api/reports/pdf": "artifactId",
  "/api/documents/attachments": "attachmentId",
});

function verifiedArtifactHref(candidate, artifactId, applicationOrigin) {
  const id = String(artifactId || "").trim();
  const origin = String(applicationOrigin || "").trim();
  if (!id || !candidate || !origin) throw new Error("The verified file identity is unavailable.");
  let url;
  let normalizedOrigin;
  try {
    normalizedOrigin = new URL(origin).origin;
    url = new URL(String(candidate), normalizedOrigin);
  } catch {
    throw new Error("The verified file link is unavailable.");
  }
  const identityParameter = VERIFIED_ARTIFACT_ROUTES[url.pathname];
  const parameterNames = [...url.searchParams.keys()];
  if (
    !["http:", "https:"].includes(url.protocol)
    || url.origin !== normalizedOrigin
    || url.username
    || url.password
    || url.hash
    || !identityParameter
    || parameterNames.length !== 1
    || parameterNames[0] !== identityParameter
    || url.searchParams.getAll(identityParameter).length !== 1
    || url.searchParams.get(identityParameter) !== id
  ) {
    throw new Error("The verified file link did not match its HeirRight artifact.");
  }
  return `${url.pathname}${url.search}`;
}

export { VERIFIED_ARTIFACT_ROUTES, verifiedArtifactHref };
