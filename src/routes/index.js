module.exports = function registerRoutes(app, { controllers, ensureConnectionExists }) {
  app.get("/healthz", (_req, res) => res.status(200).send("ok"));

  app.get("/", controllers.home.index);

  app.get("/import", controllers.import.form);
  app.post("/import", controllers.import.submit);

  app.get("/c/:connection", ensureConnectionExists, controllers.connection.show);
  app.post("/c/:connection/delete", ensureConnectionExists, controllers.connection.delete);

  app.get("/saml/metadata/:connection", ensureConnectionExists, controllers.metadata.spMetadata);

  app.get("/login/:connection", ensureConnectionExists, controllers.auth.spLogin);
  app.post("/saml/acs/:connection", ensureConnectionExists, controllers.auth.acs);

  app.get("/me", controllers.me.show);
  app.get("/logout", controllers.auth.logout);
};
