const urls = require("../urls");

function metadataController({ views, baseUrl }) {
  return {
    metadata(req, res) {
      const conn = req.samlConnection;
      const issuer = urls.buildSpIssuer(baseUrl, conn.id);
      const acsUrl = urls.buildAcsUrl(baseUrl, conn.id);

      // Keep the SP metadata simple: advertise a single, common NameIDFormat by default.
      // If the user explicitly requests a NameID format in the AuthnRequest, we also
      // include it here so IdPs that validate SP metadata stay in sync.
      const nameIdFormats = new Set([
        "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress",
      ]);

      if (conn.requestedNameIdFormat) nameIdFormats.add(conn.requestedNameIdFormat);

      const nameIdXml = [...nameIdFormats]
        .map((f) => `    <NameIDFormat>${f}</NameIDFormat>`)
        .join("\n");

      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<EntityDescriptor xmlns="urn:oasis:names:tc:SAML:2.0:metadata" entityID="${issuer}">
  <SPSSODescriptor protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol"
      AuthnRequestsSigned="false" WantAssertionsSigned="true">
${nameIdXml}
    <AssertionConsumerService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
      Location="${acsUrl}" index="1" isDefault="true"/>
  </SPSSODescriptor>
</EntityDescriptor>
`;

      res.type("application/xml").send(xml);
    },
  };
}

module.exports = metadataController;
