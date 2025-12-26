function buildSpIssuer(baseUrl, connectionId) {
  return `${baseUrl}/saml/metadata/${encodeURIComponent(connectionId)}`;
}

function buildAcsUrl(baseUrl, connectionId) {
  return `${baseUrl}/saml/acs/${encodeURIComponent(connectionId)}`;
}

function buildMetadataUrl(baseUrl, connectionId) {
  return `${baseUrl}/saml/metadata/${encodeURIComponent(connectionId)}`;
}

function buildLoginUrl(baseUrl, connectionId) {
  return `${baseUrl}/login/${encodeURIComponent(connectionId)}`;
}

function buildConnectionUrl(baseUrl, connectionId) {
  return `${baseUrl}/c/${encodeURIComponent(connectionId)}`;
}

module.exports = {
  buildSpIssuer,
  buildAcsUrl,
  buildMetadataUrl,
  buildLoginUrl,
  buildConnectionUrl,
};
