const express = require("express");

function connectionRoutes(ctrl) {
  const r = express.Router();
  r.get("/c/:connection", ctrl.ensure, ctrl.show);
  r.post("/c/:connection/delete", ctrl.ensure, ctrl.del);
  return r;
}

module.exports = { connectionRoutes };
