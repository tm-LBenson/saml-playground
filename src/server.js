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
  getRuntimeConnectionTtlMs,
} = require("./config");

const { createStore } = require("./store");

const views = require("./views/pages");

const { homeController } = require("./controllers/homeController");
const { importController } = require("./controllers/importController");
const { connectionController } = require("./controllers/connectionController");
const { authController } = require("./controllers/authController");
const { metadataController } = require("./controllers/metadataController");

const { homeRoutes } = require("./routes/homeRoutes");
const { importRoutes } = require("./routes/importRoutes");
const { connectionRoutes } = require("./routes/connectionRoutes");
const { authRoutes } = require("./routes/authRoutes");
const { metadataRoutes } = require("./routes/metadataRoutes");

const PORT = getPort();
const BASE_URL = getBaseUrl();
const TRUST_PROXY = getTrustProxy();
const ALLOWED_RELAYSTATE_ORIGINS = getAllowedRelayStateOrigins();

const store = createStore(getRuntimeConnectionTtlMs());

const app = express();
app.locals.baseUrl = BASE_URL;

app.set("trust proxy", TRUST_PROXY);

app.use(morgan("dev"));
app.use(compression());
app.use(
  helmet({
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

setInterval(store.cleanup, 60 * 1000).unref();

const connCtrl = connectionController({ store, views });
const impCtrl = importController({ store, views });
const authCtrl = authController({ store, views, allowedRelayStateOrigins: ALLOWED_RELAYSTATE_ORIGINS });
const metaCtrl = metadataController();

passport.use(
  "saml",
  new MultiSamlStrategy(
    {
      passReqToCallback: true,
      getSamlOptions: function (req, done) {
        const id = req.params && req.params.connection ? String(req.params.connection) : null;
        const conn = store.get(id);
        if (!conn) return done(new Error(`Unknown connection: ${id || "(missing)"}`));
        req.samlConnection = conn;
        authCtrl.samlOptions(req, done);
      },
    },
    function verifySignOn(req, profile, done) {
      const conn = req.samlConnection;
      const connectionId = conn ? conn.id : "";

      done(null, {
        id: `${connectionId || "unknown"}:${profile.nameID || profile.email || Date.now()}`,
        connectionId,
        nameID: profile.nameID,
        nameIDFormat: profile.nameIDFormat,
        sessionIndex: profile.sessionIndex,
        profile,
        loggedInAt: new Date().toISOString(),
      });
    },
    function verifyLogout(req, profile, done) {
      done(null, profile);
    }
  )
);

app.get("/healthz", (_req, res) => res.status(200).send("ok"));

app.use(homeRoutes(homeController({ store, views })));
app.use(importRoutes(impCtrl));
app.use(connectionRoutes(connCtrl));
app.use(authRoutes(authCtrl));
app.use(metadataRoutes(connCtrl.ensure, metaCtrl));

app.use((err, req, res, _next) => {
  res.status(500).send(
    views.renderError({
      baseUrl: BASE_URL,
      title: "Server error",
      message: "Unhandled exception.",
      details: String(err.stack || err),
    })
  );
});

app.listen(PORT, () => {
  console.log("SAML Playground");
  console.log(`Public: ${BASE_URL}`);
});
