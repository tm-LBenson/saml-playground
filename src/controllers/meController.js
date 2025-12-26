function meController({ views, baseUrl }) {
  return {
    me(req, res) {
      res.send(
        views.renderMe({
          baseUrl,
          user: req.user || null,
        }),
      );
    },
  };
}

module.exports = meController;
