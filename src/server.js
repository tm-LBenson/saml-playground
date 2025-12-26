const express = require("express");
const session = require("express-session");
const passport = require("passport");
const morgan = require("morgan");
const helmet = require("helmet");
const compression = require("compression");

const { getPort, getBaseUrl, getSessionSecret, getTrustProxy, getRuntimeConnectionTtlMs } = require("./config");
const { createStore } = require("./store");
const { createRoutes } = require("./routes");
const { configureSaml } = require("./samlStrategy");
const pages = require("./views/pages");

const PORT = getPort();
const BASE_URL = getBaseUrl();
const TRUST_PROXY = getTrustProxy();
const TTL_MS = getRuntimeConnectionTtlMs();

const allowedRelayStateOrigins = [new URL(BASE_URL).origin];

const store = createStore({ ttlMs: TTL_MS });

const app = express();
app.locals.baseUrl = BASE_URL;

app.set("trust proxy", TRUST_PROXY);

app.use(morgan("dev"));
app.use(compression());
app.use(helmet({ contentSecurityPolicy: false }));

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

configureSaml({ baseUrl: BASE_URL });

setInterval(() => store.cleanup(), 60 * 1000).unref();

app.get("/healthz", (_req, res) => res.status(200).send("ok"));

app.use(
  createRoutes({
    store,
    views: {
      home: pages.renderHome,
      import: pages.renderImport,
      connection: pages.renderConnection,
      me: pages.renderMe,
      error: pages.renderError,
    },
    baseUrl: BASE_URL,
    allowedRelayStateOrigins,
  }),
);

app.use((err, _req, res, _next) => {
  res.status(500).send(pages.renderError({ title: "Server error", message: "Unhandled exception.", details: String(err.stack || err) }));
});

app.listen(PORT, () => {
  console.log("SAML Playground running");
  console.log(`Public: ${BASE_URL}`);
});
