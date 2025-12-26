const { parseIdpMetadataXml, fetchMetadataUrl } = require("../saml/metadata");

function importController({ store, views, baseUrl }) {
  return {
    get(req, res) {
      res.send(
        views.renderImport({
          baseUrl,
          error: null,
          values: {
            displayName: "",
            metadataMode: "url",
            metadataUrl: "",
            metadataXml: "",
            requestedNameIdFormat: "",
          },
        }),
      );
    },

    async post(req, res) {
      try {
        const displayName = String(req.body.displayName || "").trim();
        const metadataMode = String(req.body.metadataMode || "url").trim();
        const metadataUrl = String(req.body.metadataUrl || "").trim();
        const metadataXml = String(req.body.metadataXml || "").trim();
        const requestedNameIdFormat = String(req.body.requestedNameIdFormat || "").trim();

        const xml = metadataMode === "url" ? await fetchMetadataUrl(metadataUrl) : metadataXml;
        const parsed = parseIdpMetadataXml(xml);

        const conn = store.create({
          displayName: displayName || parsed.idpEntityId,
          idpEntityId: parsed.idpEntityId,
          idpSsoUrl: parsed.idpSsoUrl,
          idpCertPem: parsed.idpCertPem,
          nameIdFormats: parsed.nameIdFormats,
          requestedNameIdFormat: requestedNameIdFormat || "",
        });

        res.redirect(`/c/${encodeURIComponent(conn.id)}`);
      } catch (e) {
        res.status(400).send(
          views.renderImport({
            baseUrl,
            error: String(e.message || e),
            values: {
              displayName: String(req.body.displayName || ""),
              metadataMode: String(req.body.metadataMode || "url"),
              metadataUrl: String(req.body.metadataUrl || ""),
              metadataXml: String(req.body.metadataXml || ""),
              requestedNameIdFormat: String(req.body.requestedNameIdFormat || ""),
            },
          }),
        );
      }
    },
  };
}

module.exports = importController;
