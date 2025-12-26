const { parseIdpMetadataXml, fetchMetadataUrl } = require("../metadata");

function importController({ store, views }) {
  function get(req, res) {
    res.send(
      views.renderImport({
        baseUrl: req.app.locals.baseUrl,
        error: null,
        values: {
          metadataUrl: "",
          metadataXml: "",
          displayName: "",
          allowIdpInitiated: true,
          nameIdFormat: "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress",
        },
      })
    );
  }

  async function post(req, res) {
    try {
      const displayName = String(req.body.displayName || "").trim();
      const metadataUrl = String(req.body.metadataUrl || "").trim();
      const metadataXml = String(req.body.metadataXml || "").trim();
      const allowIdpInitiated = String(req.body.allowIdpInitiated || "").toLowerCase() !== "";
      const nameIdFormat =
        String(req.body.nameIdFormat || "").trim() || "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress";

      if (!metadataUrl && !metadataXml) {
        throw new Error("Provide a metadata URL or paste metadata XML.");
      }

      const xml = metadataUrl ? await fetchMetadataUrl(metadataUrl) : metadataXml;
      const parsed = parseIdpMetadataXml(xml);

      const conn = store.put({
        displayName: displayName || parsed.idpEntityId,
        idpEntityId: parsed.idpEntityId,
        idpSsoUrl: parsed.idpSsoUrl,
        idpCertPem: parsed.idpCertPem,
        idpBaseUrl: parsed.idpBaseUrl,
        nameIdFormat,
        allowIdpInitiated,
      });

      res.redirect(`/c/${encodeURIComponent(conn.id)}`);
    } catch (e) {
      res.status(400).send(
        views.renderImport({
          baseUrl: req.app.locals.baseUrl,
          error: String(e.message || e),
          values: {
            metadataUrl: String(req.body.metadataUrl || ""),
            metadataXml: String(req.body.metadataXml || ""),
            displayName: String(req.body.displayName || ""),
            allowIdpInitiated: req.body.allowIdpInitiated ? true : false,
            nameIdFormat: String(req.body.nameIdFormat || "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress"),
          },
        })
      );
    }
  }

  return { get, post };
}

module.exports = { importController };
