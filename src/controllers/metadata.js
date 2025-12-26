const { buildSpMetadataXml } = require("../saml");

module.exports = function metadataController({ baseUrl }) {
  return {
    spMetadata(req, res) {
      const conn = req.samlConnection;
      const xml = buildSpMetadataXml({
        baseUrl,
        connectionId: conn.id,
        nameIdFormat: conn.metadataNameIdFormat,
      });
      res.type("application/xml").send(xml);
    },
  };
};
