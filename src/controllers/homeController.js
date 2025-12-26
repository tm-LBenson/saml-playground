function homeController({ store, views, baseUrl }) {
  return {
    home(req, res) {
      res.send(
        views.renderHome({
          baseUrl,
          connections: store.list(),
          user: req.user || null,
        }),
      );
    },
  };
}

module.exports = homeController;
