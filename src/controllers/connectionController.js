function buildUrls(baseUrl, conn) {
  const connectionId = conn.id;
  const spEntityId = `${baseUrl}/saml/metadata/${encodeURIComponent(connectionId)}`;
  const acsUrl = `${baseUrl}/saml/acs/${encodeURIComponent(connectionId)}`;
  const spMetadataUrl = spEntityId;
  const spLoginUrl = `${baseUrl}/login/${encodeURIComponent(connectionId)}`;
  const tileUrl = `${baseUrl}/launch/${encodeURIComponent(connectionId)}`;
  const idpInitiatedUrl = `${String(conn.idpBaseUrl || "").replace(/\/+$/, "")}/profile/SAML2/Unsolicited/SSO?providerId=${encodeURIComponent(
    spEntityId
  )}&target=${encodeURIComponent(`${baseUrl}/me`)}`;

  return { spEntityId, acsUrl, spMetadataUrl, spLoginUrl, tileUrl, idpInitiatedUrl };
}

function connectionController({ store, views }) {
  function ensure(req, res, next) {
    const id = req.params && req.params.connection ? String(req.params.connection) : null;
    const conn = store.get(id);
    if (!conn) {
      return res.status(404).send(
        views.renderError({
          baseUrl: req.app.locals.baseUrl,
          title: "Unknown connection",
          message: `No connection found for: ${id || "(missing)"}`,
          details: "Import metadata again to create a new connection.",
        })
      );
    }
    req.samlConnection = conn;
    next();
  }

  function show(req, res) {
    const baseUrl = req.app.locals.baseUrl;
    const conn = req.samlConnection;
    res.send(
      views.renderConnection({
        baseUrl,
        conn,
        urls: buildUrls(baseUrl, conn),
      })
    );
  }

  function del(req, res) {
    const conn = req.samlConnection;
    if (conn && conn.id) store.del(conn.id);
    res.redirect("/");
  }

  return { ensure, show, del };
}

module.exports = { connectionController };
