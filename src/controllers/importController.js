const { parseIdpMetadataXml, fetchMetadataUrl } = require("../metadata");

function normalizeMode(body) {
  const raw = String(body.metadataSource || "").toLowerCase().trim();
  if (raw === "url" || raw === "xml") return raw;
  const url = String(body.metadataUrl || "").trim();
  const xml = String(body.metadataXml || "").trim();
  if (url) return "url";
  if (xml) return "xml";
  return "url";
}

function normalizeNameIdFormat(body) {
  const raw = String(body.nameIdFormat || "").trim();
  if (!raw) return "";
  const lowered = raw.toLowerCase();
  if (lowered === "any" || lowered === "none") return "";
  return raw;
}

function importController({ store, views }) {
  function get(req, res) {
    res.send(
      views.renderImport({
        baseUrl: req.app.locals.baseUrl,
        error: null,
        values: {
          metadataSource: "url",
          metadataUrl: "",
          metadataXml: "",
          displayName: "",
          allowIdpInitiated: true,
          nameIdFormat: "",
        },
      })
    );
  }

  async function post(req, res) {
    try {
      const metadataSource = normalizeMode(req.body || {});
      const metadataUrl = String(req.body.metadataUrl || "").trim();
      const metadataXml = String(req.body.metadataXml || "").trim();
      const displayName = String(req.body.displayName || "").trim();
      const allowIdpInitiated = req.body.allowIdpInitiated ? true : false;
      const nameIdFormat = normalizeNameIdFormat(req.body || {});

      if (metadataSource === "url" && !metadataUrl) throw new Error("Metadata URL is required.");
      if (metadataSource === "xml" && !metadataXml) throw new Error("Metadata XML is required.");

      const xml = metadataSource === "url" ? await fetchMetadataUrl(metadataUrl) : metadataXml;
      const parsed = parseIdpMetadataXml(xml);

      const conn = store.put({
        displayName: displayName || parsed.idpEntityId,
        idpEntityId: parsed.idpEntityId,
        idpSsoUrl: parsed.idpSsoUrl,
        idpCertPem: parsed.idpCertPem,
        idpBaseUrl: parsed.idpBaseUrl,
        allowIdpInitiated,
        nameIdFormat,
      });

      res.redirect(`/c/${encodeURIComponent(conn.id)}`);
    } catch (e) {
      res.status(400).send(
        views.renderImport({
          baseUrl: req.app.locals.baseUrl,
          error: String(e.message || e),
          values: {
            metadataSource: normalizeMode(req.body || {}),
            metadataUrl: String(req.body.metadataUrl || ""),
            metadataXml: String(req.body.metadataXml || ""),
            displayName: String(req.body.displayName || ""),
            allowIdpInitiated: req.body.allowIdpInitiated ? true : false,
            nameIdFormat: String(req.body.nameIdFormat || ""),
          },
        })
      );
    }
  }

  return { get, post };
}

module.exports = { importController };
