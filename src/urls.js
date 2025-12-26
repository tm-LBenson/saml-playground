function normalizeBaseUrl(url) {
  return String(url || "").replace(/\/+$/, "");
}

function buildSpEntityId(baseUrl, connectionId) {
  return `${normalizeBaseUrl(baseUrl)}/saml/metadata/${encodeURIComponent(connectionId)}`;
}

function buildAcsUrl(baseUrl, connectionId) {
  return `${normalizeBaseUrl(baseUrl)}/saml/acs/${encodeURIComponent(connectionId)}`;
}

function buildUnsolicitedUrl({ idpEntityId, spEntityId, target }) {
  const base = normalizeBaseUrl(idpEntityId);
  if (!base.toLowerCase().startsWith("http")) return null;
  let url = `${base}/profile/SAML2/Unsolicited/SSO?providerId=${encodeURIComponent(spEntityId)}`;
  if (target) url += `&target=${encodeURIComponent(target)}`;
  return url;
}

function safeRelayStateTo(relayState, allowedOrigins) {
  const raw = String(relayState || "").trim();
  if (!raw) return null;
  if (raw.startsWith("/")) return raw;
  try {
    const u = new URL(raw);
    const origin = `${u.protocol}//${u.host}`;
    if (allowedOrigins.includes(origin)) return raw;
    return null;
  } catch {
    return null;
  }
}

module.exports = { buildSpEntityId, buildAcsUrl, buildUnsolicitedUrl, safeRelayStateTo };
