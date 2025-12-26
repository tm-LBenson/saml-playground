function toPemFromX509CertificateText(text) {
  const b64 = String(text || "").replace(/\s+/g, "");
  if (!b64) return null;
  const lines = b64.match(/.{1,64}/g) || [];
  return `-----BEGIN CERTIFICATE-----\n${lines.join("\n")}\n-----END CERTIFICATE-----\n`;
}

function pickSsoUrlFromMetadata(xml) {
  const all = [];
  const re = /SingleSignOnService[^>]*Binding="([^"]+)"[^>]*Location="([^"]+)"/gi;
  let m;
  while ((m = re.exec(xml)) !== null) {
    all.push({ binding: m[1], location: m[2] });
  }
  const preferred = all.find((x) => x.binding === "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect");
  if (preferred) return preferred.location;
  const post = all.find((x) => x.binding === "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST");
  if (post) return post.location;
  return all.length ? all[0].location : null;
}

function pickSigningCertFromMetadata(xml) {
  const keyBlock = xml.match(/<KeyDescriptor[^>]*use="signing"[^>]*>[\s\S]*?<\/KeyDescriptor>/i);
  const scope = keyBlock ? keyBlock[0] : xml;
  const certMatch = scope.match(/<(?:ds:)?X509Certificate>([\s\S]*?)<\/(?:ds:)?X509Certificate>/i);
  if (!certMatch) return null;
  return toPemFromX509CertificateText(certMatch[1]);
}

function deriveIdpBaseUrlFromSsoUrl(idpSsoUrl) {
  const s = String(idpSsoUrl || "");
  const idx = s.indexOf("/profile/");
  if (idx === -1) return null;
  return s.slice(0, idx);
}

function parseIdpMetadataXml(xml) {
  const text = String(xml || "").trim();
  if (!text) throw new Error("Metadata XML is empty.");
  const entityMatch = text.match(/<EntityDescriptor[^>]*\sentityID="([^"]+)"/i);
  const idpEntityId = entityMatch ? entityMatch[1] : null;
  const idpSsoUrl = pickSsoUrlFromMetadata(text);
  const idpCertPem = pickSigningCertFromMetadata(text);
  const idpBaseUrl = deriveIdpBaseUrlFromSsoUrl(idpSsoUrl);
  if (!idpEntityId) throw new Error("Could not find EntityDescriptor entityID in metadata.");
  if (!idpSsoUrl) throw new Error("Could not find SingleSignOnService Location in metadata.");
  if (!idpCertPem) throw new Error("Could not find a signing X509Certificate in metadata.");
  if (!idpBaseUrl) throw new Error("Could not derive IdP base URL from SSO URL.");
  return { idpEntityId, idpSsoUrl, idpCertPem, idpBaseUrl };
}

async function fetchMetadataUrl(url) {
  const u = String(url || "").trim();
  if (!u) throw new Error("Metadata URL is empty.");
  if (!u.startsWith("https://")) throw new Error("Metadata URL must start with https://");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const resp = await fetch(u, { signal: controller.signal, redirect: "follow" });
    if (!resp.ok) throw new Error(`Failed to fetch metadata. HTTP ${resp.status}`);
    return await resp.text();
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { parseIdpMetadataXml, fetchMetadataUrl };
