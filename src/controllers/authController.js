const passport = require("passport");
const urls = require("../urls");
const { decodeRedirectPayload, summarizeXml, renderInspectionPage } = require("../samlDebug");

function authController({ views, baseUrl, allowedRelayStateOrigins }) {
  function handlePostAcs(req, res, next) {
    passport.authenticate("saml", (err, user) => {
      if (err) {
        const conn = req.samlConnection;
        const msg = String(err.message || err);

        if (conn && conn.requestedNameIdFormat && /required nameid format not supported/i.test(msg)) {
          if (req.session) {
            req.session.retry = req.session.retry || {};
            const key = `nameid:${conn.id}`;
            if (!req.session.retry[key]) {
              req.session.retry[key] = true;
              conn.requestedNameIdFormat = "";
              return req.session.save(() => res.redirect(`/login/${encodeURIComponent(conn.id)}`));
            }
          } else {
            conn.requestedNameIdFormat = "";
            return res.redirect(`/login/${encodeURIComponent(conn.id)}`);
          }
        }

        return res.status(401).send(
          views.error({
            title: "SAML validation failed",
            message: "The SAMLResponse could not be validated or parsed.",
            details: String(err.stack || err),
          }),
        );
      }

      if (!user) {
        return res.status(401).send(
          views.error({
            title: "Login failed",
            message: "No user was produced by the SAML strategy.",
            details: "",
          }),
        );
      }

      req.logIn(user, (loginErr) => {
        if (loginErr) {
          return res.status(500).send(
            views.error({
              title: "Session error",
              message: "Authenticated, but could not establish a session.",
              details: String(loginErr.stack || loginErr),
            }),
          );
        }

        const relayState = req.body && req.body.RelayState;
        const safeTo = urls.safeRelayStateTo(relayState, allowedRelayStateOrigins) || "/me";
        return res.redirect(safeTo);
      });
    })(req, res, next);
  }

  function handleGetAcs(req, res) {
    const samlResponse = String((req.query && req.query.SAMLResponse) || "").trim();
    const samlRequest = String((req.query && req.query.SAMLRequest) || "").trim();

    if (!samlResponse && !samlRequest) {
      return res.status(400).send(
        views.error({
          title: "Missing SAML payload",
          message: "Expected SAMLResponse or SAMLRequest on the query string.",
          details: "",
        }),
      );
    }

    const which = samlResponse ? "SAMLResponse" : "SAMLRequest";
    const decoded = decodeRedirectPayload(samlResponse || samlRequest);
    const details = summarizeXml(decoded.xml);

    return res.status(200).send(
      renderInspectionPage({
        title: `Observed ${which} via HTTP Redirect`,
        method: "GET",
        binding: "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect",
        note:
          which === "SAMLResponse"
            ? "This playground can validate browser SSO responses over HTTP POST. This page is a debug receiver for Redirect-bound SAML payloads so you can confirm transport and inspect the decoded XML."
            : "This playground received a SAMLRequest over HTTP Redirect. This page shows the decoded XML for troubleshooting.",
        xml: decoded.xml,
        details,
      }),
    );
  }

  return {
    login(req, res, next) {
      passport.authenticate("saml")(req, res, next);
    },

    acs(req, res, next) {
      if (req.method === "GET") return handleGetAcs(req, res, next);
      return handlePostAcs(req, res, next);
    },

    launch(req, res) {
      const conn = req.samlConnection;
      const spEntityId = urls.buildSpEntityId(baseUrl, conn.id);
      const url = urls.buildUnsolicitedUrl({ idpEntityId: conn.idpEntityId, spEntityId, target: `${baseUrl}/me` });
      if (!url) return res.redirect(`/c/${encodeURIComponent(conn.id)}`);
      res.redirect(url);
    },

    logout(req, res) {
      req.logout(() => {
        if (req.session) req.session.destroy(() => res.redirect("/"));
        else res.redirect("/");
      });
    },
  };
}

module.exports = { authController };
