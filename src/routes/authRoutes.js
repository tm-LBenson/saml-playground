const express = require("express");

function authRoutes(ctrl) {
  const r = express.Router();
  r.get("/login/:connection", ctrl.ensure, ctrl.login);
  r.get("/launch/:connection", ctrl.ensure, ctrl.launch);
  r.post("/saml/acs/:connection", ctrl.ensure, ctrl.acs);
  r.get("/me", ctrl.me);
  r.all("/logout", ctrl.logout);
  return r;
}

module.exports = { authRoutes };
