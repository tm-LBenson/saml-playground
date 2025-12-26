const express = require("express");

function importRoutes(ctrl) {
  const r = express.Router();
  r.get("/import", ctrl.get);
  r.post("/import", ctrl.post);
  return r;
}

module.exports = { importRoutes };
