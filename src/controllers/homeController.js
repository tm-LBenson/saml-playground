function homeController({ store, views }) {
  return function home(req, res) {
    res.send(
      views.renderHome({
        baseUrl: req.app.locals.baseUrl,
        connections: store.all(),
        user: req.user || null,
      })
    );
  };
}

module.exports = { homeController };
