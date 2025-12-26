const passport = require("passport");
const { safeRelayStateTo } = require("../saml");

function buildSpIssuer(baseUrl, connectionId) {
  return `${baseUrl}/saml/metadata/${encodeURIComponent(connectionId)}`;
}

function buildAcsUrl(baseUrl, connectionId) {
  return `${baseUrl}/saml/acs/${encodeURIComponent(connectionId)}`;
}

function buildUnsolicitedSsoUrl(baseUrl, conn, targetUrl) {
  const connectionId = conn.id;
  const spEntityId = buildSpIssuer(baseUrl, connectionId);
  const idpBase = String(conn.idpBaseUrl || "").replace(/\/+$/, "");
  let url = `${idpBase}/profile/SAML2/Unsolicited/SSO?providerId=${encodeURIComponent(spEntityId)}`;
  if (targetUrl) url += `&target=${encodeURIComponent(targetUrl)}`;
  return url;
}

function authController({ store, views, allowedRelayStateOrigins }) {
  function ensure(req, res, next) {
    const id = req.params && req.params.connection ? String(req.params.connection) : null;
    const conn = store.get(id);
    if (!conn) {
      return res.status(404).send(
        views.renderError({
          baseUrl: req.app.locals.baseUrl,
          title: "Unknown connection",
          message: `No connection found for: ${id || "(missing)"}`,
          details: "Import metadata again to create a new connection.",
        })
      );
    }
    req.samlConnection = conn;
    next();
  }

  function login(req, res, next) {
    passport.authenticate("saml")(req, res, next);
  }

  function acs(req, res, next) {
    passport.authenticate("saml", (err, user) => {
      if (err) {
        return res.status(401).send(
          views.renderError({
            baseUrl: req.app.locals.baseUrl,
            title: "SAML validation failed",
            message: "The SAMLResponse could not be validated or parsed.",
            details: String(err.stack || err),
          })
        );
      }

      if (!user) {
        return res.status(401).send(
          views.renderError({
            baseUrl: req.app.locals.baseUrl,
            title: "Login failed",
            message: "No user was produced by the SAML strategy.",
            details: "",
          })
        );
      }

      req.logIn(user, (loginErr) => {
        if (loginErr) {
          return res.status(500).send(
            views.renderError({
              baseUrl: req.app.locals.baseUrl,
              title: "Session error",
              message: "User authenticated, but the session could not be established.",
              details: String(loginErr.stack || loginErr),
            })
          );
        }

        const relayState = req.body && req.body.RelayState;
        const safeTo = safeRelayStateTo(relayState, allowedRelayStateOrigins) || "/me";
        res.redirect(safeTo);
      });
    })(req, res, next);
  }

  function launch(req, res) {
    const baseUrl = req.app.locals.baseUrl;
    const conn = req.samlConnection;
    res.redirect(buildUnsolicitedSsoUrl(baseUrl, conn, `${baseUrl}/me`));
  }

  function me(req, res) {
    res.send(
      views.renderMe({
        baseUrl: req.app.locals.baseUrl,
        user: req.user || null,
        nowIso: new Date().toISOString(),
      })
    );
  }

  function logout(req, res) {
    req.logout(function () {
      if (req.session) {
        req.session.destroy(() => res.redirect("/"));
      } else {
        res.redirect("/");
      }
    });
  }

  function samlOptions(req, done) {
    const baseUrl = req.app.locals.baseUrl;
    const conn = req.samlConnection;
    const connectionId = conn.id;
    const issuer = buildSpIssuer(baseUrl, connectionId);
    const callbackUrl = buildAcsUrl(baseUrl, connectionId);

    done(null, {
      callbackUrl,
      callbackURL: callbackUrl,
      entryPoint: conn.idpSsoUrl,
      issuer,
      audience: issuer,
      idpIssuer: conn.idpEntityId,
      cert: conn.idpCertPem,
      idpCert: conn.idpCertPem,
      identifierFormat: conn.nameIdFormat || undefined,
      acceptedClockSkewMs: 3 * 60 * 1000,
      validateInResponseTo: "never",
      disableRequestedAuthnContext: true,
      forceAuthn: false,
    });
  }

 return { ensure, login, acs, launch, me, logout, samlOptions };
}

module.exports = { authController };
