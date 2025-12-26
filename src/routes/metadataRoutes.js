const express = require("express");

function metadataRoutes(ensure, ctrl) {
  const r = express.Router();
  r.get("/saml/metadata/:connection", ensure, ctrl.metadata);
  return r;
}

module.exports = { metadataRoutes };
