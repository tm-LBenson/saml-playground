const path = require("path");
const express = require("express");
const session = require("express-session");
const passport = require("passport");
const morgan = require("morgan");
const helmet = require("helmet");
const compression = require("compression");

const { MultiSamlStrategy } = require("@node-saml/passport-saml");

const {
  getPort,
  getBaseUrl,
  getSessionSecret,
  getTrustProxy,
  getAllowedRelayStateOrigins,
  getConnectionTtlMs,
} = require("./config");

const { createStore } = require("./store");
const { buildAcsUrl, buildSpEntityId } = require("./saml");

const views = require("./views/pages");

const PORT = getPort();
const BASE_URL = getBaseUrl();
const TRUST_PROXY = getTrustProxy();
const ALLOWED_RELAYSTATE_ORIGINS = getAllowedRelayStateOrigins();

const store = createStore({ ttlMs: getConnectionTtlMs() });

function getConnectionIdFromReq(req) {
  if (req.params && req.params.connection) return String(req.params.connection);
  if (req.query && req.query.connection) return String(req.query.connection);
  return null;
}

function ensureConnectionExists(req, res, next) {
  const id = getConnectionIdFromReq(req);
  const conn = store.get(id);
  if (!conn) {
    return res.status(404).send(
      views.renderError({
        title: "Unknown connection",
        message: `No connection found for: ${id || "(missing)"}`,
        details: "Create a new connection at /import.",
      })
    );
  }
  req.samlConnection = conn;
  next();
}

function shouldSkipNameIdPolicy(req, connectionId) {
  return !!(req.session && req.session._skipNameIdPolicy && req.session._skipNameIdPolicy[connectionId]);
}

// ---- Express app ----
const app = express();
app.set("trust proxy", TRUST_PROXY);

app.use(morgan("dev"));
app.use(compression());
app.use(
  helmet({
    // Keep the playground simple (no CSP headaches). Tighten for real apps.
    contentSecurityPolicy: false,
  })
);

app.use("/public", express.static(path.join(__dirname, "..", "public")));
app.use(express.urlencoded({ extended: false, limit: "10mb" }));

const cookieSecure = BASE_URL.startsWith("https://");
app.use(
  session({
    name: "saml_playground_sid",
    secret: getSessionSecret(),
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: cookieSecure ? "none" : "lax",
      secure: cookieSecure,
      maxAge: 8 * 60 * 60 * 1000,
    },
  })
);

app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

// ---- SAML Strategy (multi-tenant) ----
passport.use(
  "saml",
  new MultiSamlStrategy(
    {
      passReqToCallback: true,
      getSamlOptions: function (req, done) {
        const conn = store.get(getConnectionIdFromReq(req));
        if (!conn) return done(new Error("Unknown connection."));

        const connectionId = conn.id;
        const issuer = buildSpEntityId(BASE_URL, connectionId);
        const callbackUrl = buildAcsUrl(BASE_URL, connectionId);

        const opts = {
          callbackUrl,
          callbackURL: callbackUrl, // compatibility across versions
          entryPoint: conn.idpSsoUrl,
          issuer,
          audience: issuer,
          idpIssuer: conn.idpEntityId,
          // IdP signing cert
          cert: conn.idpCertPem,
          idpCert: conn.idpCertPem,

          // Enable IdP-initiated and keep flows forgiving (training/debugging)
          validateInResponseTo: "never",
          disableRequestedAuthnContext: true,
          acceptedClockSkewMs: 3 * 60 * 1000,
        };

        // Only force a NameIDPolicy if explicitly requested AND not disabled by a retry.
        if (conn.requestedNameIdFormat && !shouldSkipNameIdPolicy(req, connectionId)) {
          opts.identifierFormat = conn.requestedNameIdFormat;
        }

        return done(null, opts);
      },
    },
    function verifySignOn(req, profile, done) {
      try {
        const connId = (req.samlConnection && req.samlConnection.id) || getConnectionIdFromReq(req) || "unknown";
        const user = {
          id: `${connId}:${profile.nameID || Date.now()}`,
          connectionId: connId,
          nameID: profile.nameID,
          nameIDFormat: profile.nameIDFormat,
          sessionIndex: profile.sessionIndex,
          profile,
          loggedInAt: new Date().toISOString(),
        };
        done(null, user);
      } catch (e) {
        done(e);
      }
    }
  )
);

// ---- Controllers & routes ----
const homeController = require("./controllers/home")({ store, views });
const importController = require("./controllers/import")({ store, views });
const connectionController = require("./controllers/connection")({ store, views, baseUrl: BASE_URL });
const metadataController = require("./controllers/metadata")({ baseUrl: BASE_URL });
const authController = require("./controllers/auth")({
  passport,
  views,
  allowedRelayStateOrigins: ALLOWED_RELAYSTATE_ORIGINS,
  baseUrl: BASE_URL,
});
const meController = require("./controllers/me")({ views });

require("./routes")(app, {
  controllers: {
    home: homeController,
    import: importController,
    connection: connectionController,
    metadata: metadataController,
    auth: authController,
    me: meController,
  },
  ensureConnectionExists,
});

// ---- Error handler ----
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).send(
    views.renderError({
      title: "Server error",
      message: "Unhandled exception.",
      details: String(err && (err.stack || err.message) ? (err.stack || err.message) : err),
    })
  );
});

app.listen(PORT, () => {
  console.log(`\n✅ SAML Playground running`);
  console.log(`   Local:  http://localhost:${PORT}`);
  console.log(`   Public: ${BASE_URL}`);
});
