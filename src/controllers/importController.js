const { parseIdpMetadataXml, fetchMetadataUrl } = require("../metadata");

function importController({ store, views }) {
  return {
    get(req, res) {
      res.send(views.import({ error: null, values: { metadataSource: "url", metadataUrl: "", metadataXml: "", label: "", metadataNameIdFormat: "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress", requestedNameIdFormat: "" } }));
    },

    async post(req, res) {
      try {
        const metadataSource = String(req.body.metadataSource || "url").trim();
        const metadataUrl = String(req.body.metadataUrl || "").trim();
        const metadataXml = String(req.body.metadataXml || "").trim();
        const label = String(req.body.label || "").trim();
        const metadataNameIdFormat = String(req.body.metadataNameIdFormat || "").trim();
        const requestedNameIdFormat = String(req.body.requestedNameIdFormat || "").trim();

        const xml = metadataSource === "xml" ? metadataXml : await fetchMetadataUrl(metadataUrl);
        const parsed = parseIdpMetadataXml(xml);

        const conn = store.createConnection({
          label: label || parsed.idpEntityId,
          idpEntityId: parsed.idpEntityId,
          idpSsoUrl: parsed.idpSsoUrl,
          idpCertPem: parsed.idpCertPem,
          metadataNameIdFormat,
          requestedNameIdFormat,
        });

        res.redirect(`/c/${encodeURIComponent(conn.id)}`);
      } catch (e) {
        res.status(400).send(views.import({
          error: String(e.message || e),
          values: {
            metadataSource: String(req.body.metadataSource || "url"),
            metadataUrl: String(req.body.metadataUrl || ""),
            metadataXml: String(req.body.metadataXml || ""),
            label: String(req.body.label || ""),
            metadataNameIdFormat: String(req.body.metadataNameIdFormat || ""),
            requestedNameIdFormat: String(req.body.requestedNameIdFormat || ""),
          },
        }));
      }
    },
  };
}

module.exports = { importController };
