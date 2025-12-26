function connectionController({ store, views, baseUrl }) {
  function load(req, res, next) {
    const id = String(req.params.connection || "");
    const conn = store.get(id);
    if (!conn) {
      return res.status(404).send(
        views.renderError({
          baseUrl,
          title: "Unknown connection",
          message: `No connection found for: ${id || "(missing)"}`,
          details: "Use /import to create a temporary connection.",
        }),
      );
    }
    req.samlConnection = conn;
    next();
  }

  function show(req, res) {
    res.send(
      views.renderConnection({
        baseUrl,
        conn: req.samlConnection,
      }),
    );
  }

  function remove(req, res) {
    store.delete(req.samlConnection.id);
    res.redirect("/");
  }

  return { load, show, remove };
}

module.exports = connectionController;
