const passport = require("passport");

const { safeRelayStateTo } = require("../saml");
const { buildIdpInitiatedUrl } = require("../urls");
const { renderError } = require("../views/pages");

function initAuthController({
  BASE_URL,
  ALLOWED_RELAYSTATE_ORIGINS,
  ensureConnectionExists,
}) {
  function login(req, res, next) {
    passport.authenticate("saml")(req, res, next);
  }

  function launch(req, res) {
    const conn = req.samlConnection;
    if (!conn.allowIdpInitiated) {
      return res.status(400).send(
        renderError({
          baseUrl: BASE_URL,
          title: "IdP-initiated disabled",
          message:
            "This connection was created with IdP-initiated disabled. Re-import and enable it.",
          details: "",
        }),
      );
    }

    const url = buildIdpInitiatedUrl({
      idpEntityId: conn.idpEntityId,
      spEntityId: `${BASE_URL}/saml/metadata/${encodeURIComponent(conn.id)}`,
      target: `${BASE_URL}/me`,
    });

    return res.redirect(url);
  }

  function acs(req, res, next) {
    passport.authenticate("saml", (err, user) => {
      if (err) {
        const conn = req.samlConnection;
        const msg = String(err.message || err);

        // Auto-fix: if the IdP rejects a requested NameID format, clear it and retry once.
        if (
          conn &&
          conn.nameIdFormat &&
          /nameid.*format.*not supported/i.test(msg)
        ) {
          if (req.session) {
            if (!req.session.autoFix) req.session.autoFix = {};
            const key = `clearNameIdFormat:${conn.id}`;
            if (!req.session.autoFix[key]) {
              req.session.autoFix[key] = true;
              conn.nameIdFormat = "";
              return req.session.save(() =>
                res.redirect(`/login/${encodeURIComponent(conn.id)}`),
              );
            }
          } else {
            conn.nameIdFormat = "";
            return res.redirect(`/login/${encodeURIComponent(conn.id)}`);
          }
        }

        return res.status(401).send(
          renderError({
            baseUrl: BASE_URL,
            title: "SAML validation failed",
            message: "The SAMLResponse could not be validated/parsed.",
            details: String(err.stack || err),
          }),
        );
      }

      if (!user) {
        return res.status(401).send(
          renderError({
            baseUrl: BASE_URL,
            title: "Login failed",
            message: "No user was produced by the SAML strategy.",
            details: "Check the IdP attribute mappings and signing cert.",
          }),
        );
      }

      req.logIn(user, (loginErr) => {
        if (loginErr) {
          return res.status(500).send(
            renderError({
              baseUrl: BASE_URL,
              title: "Session error",
              message:
                "User authenticated, but we couldn't establish a session.",
              details: String(loginErr.stack || loginErr),
            }),
          );
        }

        const relayState = req.body && req.body.RelayState;
        const safeTo =
          safeRelayStateTo(relayState, ALLOWED_RELAYSTATE_ORIGINS) || "/me";
        return res.redirect(safeTo);
      });
    })(req, res, next);
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

  return {
    login: [ensureConnectionExists, login],
    launch: [ensureConnectionExists, launch],
    acs: [ensureConnectionExists, acs],
    logout,
  };
}

module.exports = { initAuthController };
