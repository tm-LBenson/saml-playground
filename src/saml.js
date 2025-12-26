const crypto = require("crypto");

/** @returns {string} */
function randomConnectionId() {
  return "c-" + crypto.randomBytes(4).toString("hex");
}

function stripTrailingSlash(s) {
  return String(s || "").replace(/\/+$/, "");
}

/** @returns {string} */
function buildAcsUrl(baseUrl, connectionId) {
  return `${stripTrailingSlash(baseUrl)}/saml/acs/${encodeURIComponent(connectionId)}`;
}

/**
 * Using a per-connection metadata URL as the SP entityID keeps it easy to copy/paste.
 * @returns {string}
 */
function buildSpEntityId(baseUrl, connectionId) {
  return `${stripTrailingSlash(baseUrl)}/saml/metadata/${encodeURIComponent(connectionId)}`;
}

/** @returns {string|null} */
function safeRelayStateTo(relayState, allowedOrigins, baseUrl) {
  const raw = String(relayState || "").trim();
  if (!raw) return null;

  // Allow relative paths
  if (raw.startsWith("/")) return raw;

  try {
    const u = new URL(raw);
    const origin = stripTrailingSlash(u.origin);
    if (allowedOrigins.includes(origin)) {
      return `${u.pathname}${u.search}${u.hash}`;
    }
  } catch {
    // ignore
  }

  // As a safety net, only allow baseUrl same-origin absolute URLs
  try {
    const u = new URL(raw, baseUrl);
    const origin = stripTrailingSlash(u.origin);
    if (allowedOrigins.includes(origin)) {
      return `${u.pathname}${u.search}${u.hash}`;
    }
  } catch {
    // ignore
  }

  return null;
}

/** @returns {string|null} */
function toPemFromX509CertificateText(text) {
  const b64 = String(text || "").replace(/\s+/g, "");
  if (!b64) return null;
  const lines = b64.match(/.{1,64}/g) || [];
  return `-----BEGIN CERTIFICATE-----\n${lines.join("\n")}\n-----END CERTIFICATE-----\n`;
}

/**
 * Best-effort IdP metadata parsing (enough for most test tenants):
 * - entityID
 * - SingleSignOnService Location (prefer Redirect)
 * - Signing certificate (first X509Certificate in IDPSSODescriptor)
 */
function parseIdpMetadataXml(xml) {
  const text = String(xml || "").trim();
  if (!text) throw new Error("Metadata XML is empty.");

  const entityMatch = text.match(/<EntityDescriptor[^>]*\sentityID="([^"]+)"/i);
  const idpEntityId = entityMatch ? entityMatch[1] : null;

  // Pick SSO URL
  const sso = [];
  const re = /<SingleSignOnService[^>]*Binding="([^"]+)"[^>]*Location="([^"]+)"/gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    sso.push({ binding: m[1], location: m[2] });
  }
  const redirect = sso.find((x) => x.binding === "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect");
  const post = sso.find((x) => x.binding === "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST");
  const idpSsoUrl = (redirect || post || sso[0] || {}).location || null;

  // Cert from IDPSSODescriptor scope only (avoid picking AA cert)
  const idpBlock = (text.match(/<IDPSSODescriptor[\s\S]*?<\/IDPSSODescriptor>/i) || [null])[0] || text;
  const certMatch = idpBlock.match(/<(?:ds:)?X509Certificate>([\s\S]*?)<\/(?:ds:)?X509Certificate>/i);
  const idpCertPem = certMatch ? toPemFromX509CertificateText(certMatch[1]) : null;

  if (!idpEntityId) throw new Error("Could not find EntityDescriptor entityID in metadata.");
  if (!idpSsoUrl) throw new Error("Could not find SingleSignOnService Location in metadata.");
  if (!idpCertPem) throw new Error("Could not find an X509Certificate in IdP metadata.");

  return { idpEntityId, idpSsoUrl, idpCertPem };
}

/** @returns {string} */
function buildSpMetadataXml({ baseUrl, connectionId, nameIdFormat }) {
  const issuer = buildSpEntityId(baseUrl, connectionId);
  const acsUrl = buildAcsUrl(baseUrl, connectionId);

  const chosen = String(nameIdFormat || "").trim() || "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress";

  // Keep this minimal on purpose.
  return `<?xml version="1.0" encoding="UTF-8"?>
<EntityDescriptor xmlns="urn:oasis:names:tc:SAML:2.0:metadata" entityID="${issuer}">
  <SPSSODescriptor protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol"
      AuthnRequestsSigned="false" WantAssertionsSigned="true">
    <NameIDFormat>${chosen}</NameIDFormat>
    <AssertionConsumerService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
      Location="${acsUrl}" index="1" isDefault="true"/>
  </SPSSODescriptor>
</EntityDescriptor>
`;
}

module.exports = {
  randomConnectionId,
  buildAcsUrl,
  buildSpEntityId,
  safeRelayStateTo,
  parseIdpMetadataXml,
  buildSpMetadataXml,
};
