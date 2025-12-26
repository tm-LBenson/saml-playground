const passport = require("passport");
const { MultiSamlStrategy } = require("@node-saml/passport-saml");
const urls = require("./urls");

function configureSaml({ baseUrl }) {
  passport.use(
    "saml",
    new MultiSamlStrategy(
      {
        passReqToCallback: true,
        getSamlOptions: (req, done) => {
          const conn = req.samlConnection;
          if (!conn) return done(new Error("Missing connection."));

          const issuer = urls.buildSpEntityId(baseUrl, conn.id);
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
            validateInResponseTo: "never",
            disableRequestedAuthnContext: true,
            forceAuthn: false,
            identifierFormat: null,
          };

          const requested = String(conn.requestedNameIdFormat || "").trim();
          if (requested) opts.identifierFormat = requested;

          return done(null, opts);
        },
      },
      (req, profile, done) => {
        const user = {
          id: `${req.samlConnection.id}:${profile.nameID || Date.now()}`,
          connectionId: req.samlConnection.id,
          nameID: profile.nameID,
          nameIDFormat: profile.nameIDFormat,
          sessionIndex: profile.sessionIndex,
          profile,
        };
        done(null, user);
      },
      (_req, profile, done) => done(null, profile),
    ),
  );

  passport.serializeUser((user, done) => done(null, user));
  passport.deserializeUser((user, done) => done(null, user));
}

module.exports = { configureSaml };
