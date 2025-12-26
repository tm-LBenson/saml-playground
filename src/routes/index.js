const express = require("express");

function createRoutes({ store, views, baseUrl, allowedRelayStateOrigins }) {
  const router = express.Router();

  const { homeController } = require("../controllers/homeController");
  const { importController } = require("../controllers/importController");
  const { connectionController } = require("../controllers/connectionController");
  const { metadataController } = require("../controllers/metadataController");
  const { meController } = require("../controllers/meController");
  const { authController } = require("../controllers/authController");

  function ensureConnection(req, res, next) {
    const id = req.params.connection;
    const conn = store.getConnection(id);
    if (!conn) {
      res.status(404).send(views.error({ title: "Unknown connection", message: "Connection not found.", details: "" }));
      return;
    }
    req.samlConnection = conn;
    next();
  }

  const home = homeController({ store, views });
  const imp = importController({ store, views });
  const connCtrl = connectionController({ store, views, baseUrl });
  const meta = metadataController({ baseUrl });
  const me = meController({ views });
  const auth = authController({ views, baseUrl, allowedRelayStateOrigins });

  router.get("/", home.home);
  router.get("/import", imp.get);
  router.post("/import", imp.post);

  router.get("/c/:connection", ensureConnection, connCtrl.show);
  router.post("/c/:connection/delete", ensureConnection, connCtrl.delete);

  router.get("/saml/metadata/:connection", ensureConnection, meta.metadata);

  router.get("/login/:connection", ensureConnection, auth.login);
  router.get("/launch/:connection", ensureConnection, auth.launch);
  router.post("/saml/acs/:connection", ensureConnection, auth.acs);

  router.get("/me", me.me);
  router.get("/logout", auth.logout);

  return router;
}

module.exports = { createRoutes };
