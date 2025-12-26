const { MultiSamlStrategy } = require("@node-saml/passport-saml");
const urls = require("../urls");
const { safeRelayStateTo } = require("../saml/relayState");

function authController({ passport, store, views, baseUrl, allowedRelayStateOrigins }) {
  passport.use(
    "saml",
    new MultiSamlStrategy(
      {
        passReqToCallback: true,
        getSamlOptions: (req, done) => {
          const id = String((req.params && req.params.connection) || (req.query && req.query.connection) || "");
          const conn = store.get(id);

          if (!conn) return done(new Error(`Unknown connection: ${id || "(missing)"}`));

          const issuer = urls.buildSpIssuer(baseUrl, conn.id);
          const callbackUrl = urls.buildAcsUrl(baseUrl, conn.id);

          const opts = {
            callbackUrl,
            callbackURL: callbackUrl,
            entryPoint: conn.idpSsoUrl,
            issuer,
            audience: issuer,
            idpIssuer: conn.idpEntityId,
            cert: conn.idpCertPem,
            idpCert: conn.idpCertPem,
            acceptedClockSkewMs: 3 * 60 * 1000,
            validateInResponseTo: "never", // required for IdP-initiated flows in a simple playground
            disableRequestedAuthnContext: true,

            // IMPORTANT:
            // passport-saml/node-saml will otherwise default to sending a NameIDPolicy Format.
            // Some IdPs (including RI in some configs) will reject SP-initiated requests when a
            // specific NameIDPolicy is required.
            // Setting this to null omits NameIDPolicy entirely so the IdP can choose.
            identifierFormat: null,
          };

          // Only request a specific NameID format if the user explicitly configured it.
          if (conn.requestedNameIdFormat) {
            opts.identifierFormat = conn.requestedNameIdFormat;
          }

          return done(null, opts);
        },
      },
      (req, profile, done) => {
        try {
          const id = String((req.params && req.params.connection) || "");
          const conn = store.get(id);
          const connectionId = conn ? conn.id : id || "unknown";

          const user = {
            id: `${connectionId}:${profile?.nameID || profile?.email || Date.now()}`,
            connectionId,
            nameID: profile?.nameID,
            nameIDFormat: profile?.nameIDFormat,
            sessionIndex: profile?.sessionIndex,
            profile,
          };

          return done(null, user);
        } catch (e) {
          return done(e);
        }
      },
      (req, profile, done) => done(null, profile),
    ),
  );

  function login(req, res, next) {
    return passport.authenticate("saml")(req, res, next);
  }

  function acs(req, res, next) {
    return passport.authenticate("saml", (err, user) => {
      if (err) {
        const msg = String(err.message || err);

        let details = String(err.stack || err);
        const actions = [{ label: "Back to connection", href: `/c/${encodeURIComponent(req.params.connection)}`, primary: true }];

        // Common training pain: requested NameID format not supported.
        if (msg.toLowerCase().includes("nameid") && msg.toLowerCase().includes("not supported")) {
          details =
            `${msg}\n\n` +
            `This usually means the AuthnRequest asked for a NameID format your IdP doesn't support.\n` +
            `Fix: In Import, leave "Requested NameID format" blank, or pick one your IdP supports.`;
        }

        return res.status(401).send(
          views.renderError({
            baseUrl,
            title: "SAML validation failed",
            message: "The SAMLResponse could not be validated or parsed.",
            details,
            actions,
          }),
        );
      }

      if (!user) {
        return res.status(401).send(
          views.renderError({
            baseUrl,
            title: "Login failed",
            message: "No user was produced by the SAML strategy.",
            details: "Check the IdP attribute mappings and signing certificate.",
            actions: [{ label: "Back to connection", href: `/c/${encodeURIComponent(req.params.connection)}`, primary: true }],
          }),
        );
      }

      req.logIn(user, (loginErr) => {
        if (loginErr) {
          return res.status(500).send(
            views.renderError({
              baseUrl,
              title: "Session error",
              message: "User authenticated, but we couldn't establish a session.",
              details: String(loginErr.stack || loginErr),
            }),
          );
        }

        const relayState = req.body && req.body.RelayState;
        const safeTo = safeRelayStateTo(relayState, allowedRelayStateOrigins) || "/me";
        return res.redirect(safeTo);
      });
    })(req, res, next);
  }

  return { login, acs };
}

module.exports = authController;
