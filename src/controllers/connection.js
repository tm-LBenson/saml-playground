const { buildAcsUrl, buildSpEntityId } = require("../saml");

module.exports = function connectionController({ store, views, baseUrl }) {
  return {
    show(req, res) {
      const conn = req.samlConnection;
      const id = conn.id;

      const sp = {
        entityId: buildSpEntityId(baseUrl, id),
        acsUrl: buildAcsUrl(baseUrl, id),
        metadataUrl: buildSpEntityId(baseUrl, id),
        loginUrl: `${baseUrl}/login/${encodeURIComponent(id)}`,
      };

      res.send(views.renderConnection({ baseUrl, conn, sp }));
    },

    delete(req, res) {
      const conn = req.samlConnection;
      store.remove(conn.id);
      res.redirect("/");
    },
  };
};
