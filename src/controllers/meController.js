function meController({ views }) {
  return {
    me(req, res) {
      res.send(views.me({ user: req.user || null, nowIso: new Date().toISOString() }));
    },
  };
}

module.exports = { meController };
