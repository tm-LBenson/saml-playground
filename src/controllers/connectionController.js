const urls = require("../urls");

function connectionController({ store, views, baseUrl }) {
  return {
    show(req, res) {
      const conn = req.samlConnection;
      const spEntityId = urls.buildSpEntityId(baseUrl, conn.id);
      const acsUrl = urls.buildAcsUrl(baseUrl, conn.id);
      const metadataUrl = spEntityId;
      const spLoginUrl = `${baseUrl}/login/${encodeURIComponent(conn.id)}`;
      const launchUrl = `${baseUrl}/launch/${encodeURIComponent(conn.id)}`;
      const unsolicitedUrl = urls.buildUnsolicitedUrl({ idpEntityId: conn.idpEntityId, spEntityId, target: `${baseUrl}/me` });

      res.send(views.connection({ conn, baseUrl, spEntityId, acsUrl, metadataUrl, spLoginUrl, launchUrl, unsolicitedUrl }));
    },

    delete(req, res) {
      const conn = req.samlConnection;
      store.deleteConnection(conn.id);
      res.redirect("/");
    },
  };
}

module.exports = { connectionController };
