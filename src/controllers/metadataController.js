function metadataController() {
  function metadata(req, res) {
    const baseUrl = req.app.locals.baseUrl;
    const conn = req.samlConnection;
    const connectionId = conn.id;
    const issuer = `${baseUrl}/saml/metadata/${encodeURIComponent(connectionId)}`;
    const acsUrl = `${baseUrl}/saml/acs/${encodeURIComponent(connectionId)}`;
    const nameIdFormat = conn.nameIdFormat && String(conn.nameIdFormat).trim() ? String(conn.nameIdFormat).trim() : "";

    const nameIdLine = nameIdFormat ? `    <NameIDFormat>${nameIdFormat}</NameIDFormat>
` : "";

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<EntityDescriptor xmlns="urn:oasis:names:tc:SAML:2.0:metadata" entityID="${issuer}">
  <SPSSODescriptor protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol"
      AuthnRequestsSigned="false" WantAssertionsSigned="true">
${nameIdLine}    <AssertionConsumerService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
      Location="${acsUrl}" index="1" isDefault="true"/>
  </SPSSODescriptor>
</EntityDescriptor>
`;
    res.type("application/xml").send(xml);
  }

  return { metadata };
}

module.exports = { metadataController };
