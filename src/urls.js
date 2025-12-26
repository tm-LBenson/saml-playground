function stripTrailingSlashes(s) {
  return String(s || "").replace(/\/+$/, "");
}

function buildIdpInitiatedUrl({ idpEntityId, spEntityId, target, shire }) {
  const idpBase = stripTrailingSlashes(idpEntityId);
  if (!idpBase) throw new Error("Missing idpEntityId");
  if (!spEntityId) throw new Error("Missing spEntityId");

  let url = `${idpBase}/profile/SAML2/Unsolicited/SSO?providerId=${encodeURIComponent(
    spEntityId,
  )}`;

  if (shire) url += `&shire=${encodeURIComponent(shire)}`;
  if (target) url += `&target=${encodeURIComponent(target)}`;

  return url;
}

module.exports = { buildIdpInitiatedUrl };
