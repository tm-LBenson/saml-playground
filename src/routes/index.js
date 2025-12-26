const express = require("express");

function routes({ controllers }) {
  const router = express.Router();

  router.get("/healthz", (_req, res) => res.status(200).send("ok"));

  router.get("/", controllers.home.home);

  router.get("/import", controllers.import.get);
  router.post("/import", controllers.import.post);

  router.get("/c/:connection", controllers.connection.load, controllers.connection.show);
  router.post("/c/:connection/delete", controllers.connection.load, controllers.connection.remove);

  router.get("/saml/metadata/:connection", controllers.connection.load, controllers.metadata.metadata);

  router.get("/login/:connection", controllers.connection.load, controllers.auth.login);
  router.post("/saml/acs/:connection", controllers.connection.load, controllers.auth.acs);

  router.get("/me", controllers.me.me);

  router.get("/logout", (req, res) => {
    req.logout(() => {
      if (req.session) {
        req.session.destroy(() => res.redirect("/"));
      } else {
        res.redirect("/");
      }
    });
  });

  return router;
}

module.exports = routes;
