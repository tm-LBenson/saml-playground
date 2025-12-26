const { safeRelayStateTo } = require("../saml");

module.exports = function authController({ passport, views, allowedRelayStateOrigins, baseUrl }) {
  function rememberLastError(req, err) {
    if (!req.session) return;
    req.session.lastErrorAt = new Date().toISOString();
    req.session.lastError = String(err && (err.stack || err.message) ? (err.stack || err.message) : err);
  }

  function shouldRetryWithoutNameIdPolicy(conn, err) {
    if (!conn || !conn.requestedNameIdFormat) return false;
    const msg = String(err && (err.message || err) ? (err.message || err) : "");
    return /required\s+nameid\s+format\s+not\s+supported/i.test(msg);
  }

  function setSkipNameIdPolicy(req, connectionId) {
    if (!req.session) return;
    if (!req.session._skipNameIdPolicy) req.session._skipNameIdPolicy = {};
    req.session._skipNameIdPolicy[connectionId] = true;
  }

  function didRetry(req, connectionId) {
    return !!(req.session && req.session._nameIdRetry && req.session._nameIdRetry[connectionId]);
  }

  function markRetried(req, connectionId) {
    if (!req.session) return;
    if (!req.session._nameIdRetry) req.session._nameIdRetry = {};
    req.session._nameIdRetry[connectionId] = true;
  }

  function clearRetryFlags(req, connectionId) {
    if (!req.session) return;
    if (req.session._nameIdRetry) delete req.session._nameIdRetry[connectionId];
    if (req.session._skipNameIdPolicy) delete req.session._skipNameIdPolicy[connectionId];
  }

  return {
    spLogin(req, res, next) {
      // Clear previous retry so each login attempt can retry once
      if (req.samlConnection) clearRetryFlags(req, req.samlConnection.id);
      passport.authenticate("saml")(req, res, next);
    },

    acs(req, res, next) {
      passport.authenticate("saml", (err, user) => {
        const conn = req.samlConnection;

        if (err) {
          // Auto-retry once without NameIDPolicy if the IdP rejects the requested format.
          if (conn && shouldRetryWithoutNameIdPolicy(conn, err) && !didRetry(req, conn.id)) {
            markRetried(req, conn.id);
            setSkipNameIdPolicy(req, conn.id);
            return res.redirect(`/login/${encodeURIComponent(conn.id)}`);
          }

          rememberLastError(req, err);
          return res.status(401).send(
            views.renderError({
              title: "SAML validation failed",
              message: "The SAMLResponse could not be validated or parsed.",
              details: String(err && (err.stack || err.message) ? (err.stack || err.message) : err),
            })
          );
        }

        if (!user) {
          rememberLastError(req, "No user returned by SAML strategy.");
          return res.status(401).send(
            views.renderError({
              title: "Login failed",
              message: "No user was produced by the SAML strategy.",
              details: "Check the IdP attribute mappings and signing certificate.",
            })
          );
        }

        req.logIn(user, (loginErr) => {
          if (loginErr) {
            rememberLastError(req, loginErr);
            return res.status(500).send(
              views.renderError({
                title: "Session error",
                message: "User authenticated, but the session could not be established.",
                details: String(loginErr && (loginErr.stack || loginErr.message) ? (loginErr.stack || loginErr.message) : loginErr),
              })
            );
          }

          const relayState = req.body && req.body.RelayState;
          const safeTo = safeRelayStateTo(relayState, allowedRelayStateOrigins, baseUrl) || "/me";
          return res.redirect(safeTo);
        });
      })(req, res, next);
    },

    logout(req, res) {
      req.logout(function () {
        if (req.session) {
          req.session.destroy(() => res.redirect("/"));
        } else {
          res.redirect("/");
        }
      });
    },
  };
};
