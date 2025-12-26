const express = require("express");

function homeRoutes(home) {
  const r = express.Router();
  r.get("/", home);
  return r;
}

module.exports = { homeRoutes };
