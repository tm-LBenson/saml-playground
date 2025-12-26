module.exports = function homeController({ store, views }) {
  return {
    index(req, res) {
      res.send(
        views.renderHome({
          user: req.user || null,
          connections: store.list(),
        })
      );
    },
  };
};
