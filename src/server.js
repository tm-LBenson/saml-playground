const path = require("path");
const express = require("express");
const session = require("express-session");
const passport = require("passport");
const morgan = require("morgan");
const helmet = require("helmet");
const compression = require("compression");

const { getPort, getBaseUrl, getSessionSecret, getTrustProxy, getAllowedRelayStateOrigins, getRuntimeConnectionTtlMs } = require("./config");
const { ConnectionStore } = require("./store/connectionStore");

const views = require("./views/pages");

const homeController = require("./controllers/homeController");
const importController = require("./controllers/importController");
const connectionController = require("./controllers/connectionController");
const metadataController = require("./controllers/metadataController");
const meController = require("./controllers/meController");
const authController = require("./controllers/authController");

const routes = require("./routes");

const PORT = getPort();
const BASE_URL = getBaseUrl();
const TRUST_PROXY = getTrustProxy();
const ALLOWED_RELAYSTATE_ORIGINS = getAllowedRelayStateOrigins();

const store = new ConnectionStore({ ttlMs: getRuntimeConnectionTtlMs() });

const app = express();
app.set("trust proxy", TRUST_PROXY);

app.use(morgan("dev"));
app.use(compression());
app.use(
  helmet({
    contentSecurityPolicy: false, // keep simple for a lab app
  }),
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
  }),
);

app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

// Cleanup expired runtime connections
store.cleanup();
setInterval(() => store.cleanup(), 60 * 1000).unref();

const controllers = {
  home: homeController({ store, views, baseUrl: BASE_URL }),
  import: importController({ store, views, baseUrl: BASE_URL }),
  connection: connectionController({ store, views, baseUrl: BASE_URL }),
  metadata: metadataController({ views, baseUrl: BASE_URL }),
  me: meController({ views, baseUrl: BASE_URL }),
  auth: authController({
    passport,
    store,
    views,
    baseUrl: BASE_URL,
    allowedRelayStateOrigins: ALLOWED_RELAYSTATE_ORIGINS,
  }),
};

app.use(routes({ controllers }));

app.use((err, req, res, _next) => {
  console.error(err);
  res.status(500).send(
    views.renderError({
      baseUrl: BASE_URL,
      title: "Server error",
      message: "Unhandled exception.",
      details: String(err.stack || err),
    }),
  );
});

app.listen(PORT, () => {
  console.log("SAML Playground running");
  console.log(`Public: ${BASE_URL}`);
});
