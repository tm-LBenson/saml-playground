function homeController({ store, views }) {
  return {
    home(req, res) {
      res.send(views.home({ connections: store.listConnections(), user: req.user || null }));
    },
  };
}

module.exports = { homeController };
