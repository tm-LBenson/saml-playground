const urls = require("../urls");

function metadataController({ baseUrl }) {
  return {
    metadata(req, res) {
      const conn = req.samlConnection;
      const spEntityId = urls.buildSpEntityId(baseUrl, conn.id);
      const acsUrl = urls.buildAcsUrl(baseUrl, conn.id);

      const metaFormat = String(conn.metadataNameIdFormat || "").trim();
      const nameIdXml = metaFormat ? `    <NameIDFormat>${metaFormat}</NameIDFormat>` : "";

      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<EntityDescriptor xmlns="urn:oasis:names:tc:SAML:2.0:metadata" entityID="${spEntityId}">
  <SPSSODescriptor protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol" AuthnRequestsSigned="false" WantAssertionsSigned="true">
${nameIdXml}
    <AssertionConsumerService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" Location="${acsUrl}" index="1" isDefault="true"/>
  </SPSSODescriptor>
</EntityDescriptor>
`;
      res.type("application/xml").send(xml);
    },
  };
}

module.exports = { metadataController };
