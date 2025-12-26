module.exports = function meController({ views }) {
  return {
    show(req, res) {
      res.send(
        views.renderMe({
          user: req.user || null,
        })
      );
    },
  };
};
