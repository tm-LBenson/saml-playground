const { parseIdpMetadataXml, randomConnectionId } = require("../saml");

async function fetchMetadataUrl(url) {
  const u = String(url || "").trim();
  if (!u) throw new Error("Metadata URL is empty.");

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

module.exports = function importController({ store, views }) {
  return {
    form(req, res) {
      res.send(
        views.renderImport({
          error: null,
          values: {
            metadataMode: "url",
            metadataUrl: "",
            metadataXml: "",
            displayName: "",
            metadataNameIdFormat: "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress",
            requestedNameIdFormat: "",
          },
        })
      );
    },

    async submit(req, res) {
      try {
        const displayName = String(req.body.displayName || "").trim();

        const metadataMode = String(req.body.metadataMode || "url").trim();
        const metadataUrl = String(req.body.metadataUrl || "").trim();
        const metadataXml = String(req.body.metadataXml || "").trim();

        const metadataNameIdFormat = String(req.body.metadataNameIdFormat || "").trim() ||
          "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress";

        const requestedNameIdFormat = String(req.body.requestedNameIdFormat || "").trim();

        const xml = metadataMode === "url" ? await fetchMetadataUrl(metadataUrl) : metadataXml;
        const parsed = parseIdpMetadataXml(xml);

        const id = randomConnectionId();
        const conn = store.create({
          id,
          displayName: displayName || parsed.idpEntityId,
          idpEntityId: parsed.idpEntityId,
          idpSsoUrl: parsed.idpSsoUrl,
          idpCertPem: parsed.idpCertPem,
          metadataNameIdFormat,
          requestedNameIdFormat: requestedNameIdFormat || null,
        });

        res.redirect(`/c/${encodeURIComponent(conn.id)}`);
      } catch (e) {
        res.status(400).send(
          views.renderImport({
            error: String(e.message || e),
            values: {
              metadataMode: String(req.body.metadataMode || "url"),
              metadataUrl: String(req.body.metadataUrl || ""),
              metadataXml: String(req.body.metadataXml || ""),
              displayName: String(req.body.displayName || ""),
              metadataNameIdFormat: String(req.body.metadataNameIdFormat || ""),
              requestedNameIdFormat: String(req.body.requestedNameIdFormat || ""),
            },
          })
        );
      }
    },
  };
};
