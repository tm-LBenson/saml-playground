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
  loadConnections,
} = require("./config");

const {
  decodeSamlRequest,
  decodeSamlResponse,
  formatXml,
  safeRelayStateTo,
} = require("./saml");

const { renderHome, renderMe, renderError } = require("./html");

const PORT = getPort();
const BASE_URL = getBaseUrl();
const TRUST_PROXY = getTrustProxy();
const ALLOWED_RELAYSTATE_ORIGINS = getAllowedRelayStateOrigins();

let connections;
try {
  connections = loadConnections();
} catch (e) {
  console.error("\n❌ Failed to load connections.\n");
  console.error(String(e.message || e));
  console.error("\nFix: copy connections.example.json to connections.json, then fill in your IdP details.\n");
  process.exit(1);
}

function getConnectionIdFromReq(req) {
  // Prefer path param
  if (req.params && req.params.connection) return String(req.params.connection);
  // Fallback to query
  if (req.query && req.query.connection) return String(req.query.connection);
  // Sometimes RelayState contains connection id in a URL; we intentionally do NOT parse it (security).
  return null;
}

function mustGetConnection(req) {
  const id = getConnectionIdFromReq(req);
  if (!id) return null;
  return connections.get(id) || null;
}

function buildSpIssuer(connectionId) {
  // Using the metadata URL as issuer keeps it unique per connection and easy to copy/paste.
  return `${BASE_URL}/saml/metadata/${encodeURIComponent(connectionId)}`;
}

function buildAcsUrl(connectionId) {
  return `${BASE_URL}/saml/acs/${encodeURIComponent(connectionId)}`;
}

function ensureConnectionExists(req, res, next) {
  const conn = mustGetConnection(req);
  if (!conn) {
    return res
      .status(404)
      .send(
        renderError({
          baseUrl: BASE_URL,
          title: "Unknown connection",
          message: `No connection found for: ${getConnectionIdFromReq(req) || "(missing)"}`,
          details:
            "Check the URL and your connections.json. Each connection must have a unique \"id\".",
        })
      );
  }
  req.samlConnection = conn;
  next();
}

function getOrInitLastSaml(req) {
  if (!req.session) return null;
  if (!req.session.lastSaml) req.session.lastSaml = {};
  return req.session.lastSaml;
}

// ----- Express app -----
const app = express();
app.set("trust proxy", TRUST_PROXY);

app.use(morgan("dev"));
app.use(compression());
// Disable CSP because we do inline <details> / <summary> and want easy debugging. Tighten for real apps.
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
      sameSite: "lax",
      secure: cookieSecure,
      maxAge: 8 * 60 * 60 * 1000, // 8 hours
    },
  })
);

app.use(passport.initialize());
app.use(passport.session());

// For a playground, we can serialize the whole user object.
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

// ----- SAML Strategy (multi-tenant) -----
passport.use(
  "saml",
  new MultiSamlStrategy(
    {
      passReqToCallback: true,
      getSamlOptions: function (req, done) {
        const conn = mustGetConnection(req);
        if (!conn) {
          return done(new Error(`Unknown connection: ${getConnectionIdFromReq(req) || "(missing)"}`));
        }

        const connectionId = conn.id;
        const issuer = buildSpIssuer(connectionId);
        const callbackUrl = buildAcsUrl(connectionId);

        // NOTE: For learning, we allow IdP-initiated (unsolicited) if configured.
        // That means we do NOT validate InResponseTo. For production SPs, you generally want this on.
        const validateInResponseTo = conn.allowIdpInitiated ? false : false;

        const opts = {
          callbackUrl,
          callbackURL: callbackUrl, // some examples use callbackURL
          entryPoint: conn.idpSsoUrl,
          issuer,
          audience: issuer,
          idpIssuer: conn.idpEntityId, // optional
          // cert naming differs across versions; set both.
          cert: conn.idpCertPem,
          idpCert: conn.idpCertPem,
          identifierFormat: conn.nameIdFormat || undefined,
          // Keep things forgiving; tweak as needed.
          acceptedClockSkewMs: 3 * 60 * 1000,
          validateInResponseTo,
          disableRequestedAuthnContext: true,
        };

        return done(null, opts);
      },
    },
    function verifySignOn(req, profile, done) {
      try {
        const conn = mustGetConnection(req);
        const connectionId = conn ? conn.id : getConnectionIdFromReq(req) || "unknown";

        const last = getOrInitLastSaml(req);

        const samlResponseB64 = req.body && req.body.SAMLResponse;
        const relayState = req.body && req.body.RelayState;

        let responseXml = null;
        try {
          responseXml = formatXml(decodeSamlResponse(samlResponseB64));
        } catch (e) {
          responseXml = `<<failed to decode SAMLResponse>>\n${String(e.message || e)}`;
        }

        last.connectionId = connectionId;
        last.relayState = relayState || null;
        last.responseB64 = samlResponseB64 || null;
        last.responseXml = responseXml || null;
        last.responseAt = new Date().toISOString();

        const user = {
          id: `${connectionId}:${profile.nameID || profile.email || Date.now()}`,
          connectionId,
          nameID: profile.nameID,
          nameIDFormat: profile.nameIDFormat,
          sessionIndex: profile.sessionIndex,
          profile,
          loggedInAt: new Date().toISOString(),
        };

        return done(null, user);
      } catch (e) {
        return done(e);
      }
    },
    function verifyLogout(req, profile, done) {
      // Not used in this playground.
      return done(null, profile);
    }
  )
);

// ----- Routes -----
app.get("/healthz", (_req, res) => res.status(200).send("ok"));

app.get("/", (req, res) => {
  res.send(
    renderHome({
      baseUrl: BASE_URL,
      connections,
      user: req.user || null,
    })
  );
});

/**
 * SP metadata endpoint (per connection)
 * Many IdPs accept this minimal metadata. If your IdP requires signing keys here,
 * you can extend this to include KeyDescriptor(s).
 */
app.get("/saml/metadata/:connection", ensureConnectionExists, (req, res) => {
  const conn = req.samlConnection;
  const connectionId = conn.id;

  const issuer = buildSpIssuer(connectionId);
  const acsUrl = buildAcsUrl(connectionId);

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<EntityDescriptor xmlns="urn:oasis:names:tc:SAML:2.0:metadata" entityID="${issuer}">
  <SPSSODescriptor protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol"
      AuthnRequestsSigned="false" WantAssertionsSigned="true">
    <NameIDFormat>${conn.nameIdFormat || "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress"}</NameIDFormat>
    <AssertionConsumerService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
      Location="${acsUrl}" index="1" isDefault="true"/>
  </SPSSODescriptor>
</EntityDescriptor>
`;

  res.type("application/xml").send(xml);
});

app.get("/login/:connection", ensureConnectionExists, (req, res, next) => {
  // Capture the redirect URL (with SAMLRequest) so we can decode it in /me.
  const originalRedirect = res.redirect.bind(res);
  res.redirect = function patchedRedirect(statusOrUrl, maybeUrl) {
    const redirectUrl = typeof statusOrUrl === "string" ? statusOrUrl : maybeUrl;
    try {
      const u = new URL(redirectUrl);
      const samlRequestB64 = u.searchParams.get("SAMLRequest");
      if (samlRequestB64) {
        const last = getOrInitLastSaml(req);
        last.connectionId = req.samlConnection.id;
        last.requestB64 = samlRequestB64;
        last.requestAt = new Date().toISOString();
        try {
          last.requestXml = formatXml(decodeSamlRequest(samlRequestB64));
        } catch (e) {
          last.requestXml = `<<failed to decode SAMLRequest>>\n${String(e.message || e)}`;
        }
        last.requestRedirectUrl = redirectUrl;
      }
    } catch {
      // ignore
    }
    return originalRedirect(statusOrUrl, maybeUrl);
  };

  passport.authenticate("saml")(req, res, next);
});

// ACS endpoint (IdP posts SAMLResponse here)
app.post("/saml/acs/:connection", ensureConnectionExists, (req, res, next) => {
  passport.authenticate("saml", (err, user) => {
    if (err) {
      const last = getOrInitLastSaml(req);
      if (last) {
        last.errorAt = new Date().toISOString();
        last.error = String(err.message || err);
      }
      return res.status(401).send(
        renderError({
          baseUrl: BASE_URL,
          title: "SAML validation failed",
          message: "The SAMLResponse could not be validated/parsed.",
          details: String(err.stack || err),
        })
      );
    }

    if (!user) {
      return res.status(401).send(
        renderError({
          baseUrl: BASE_URL,
          title: "Login failed",
          message: "No user was produced by the SAML strategy.",
          details: "Check the IdP attribute mappings and signing cert.",
        })
      );
    }

    req.logIn(user, (loginErr) => {
      if (loginErr) {
        return res.status(500).send(
          renderError({
            baseUrl: BASE_URL,
            title: "Session error",
            message: "User authenticated, but we couldn't establish a session.",
            details: String(loginErr.stack || loginErr),
          })
        );
      }

      const relayState = req.body && req.body.RelayState;
      const safeTo = safeRelayStateTo(relayState, ALLOWED_RELAYSTATE_ORIGINS) || "/me";
      return res.redirect(safeTo);
    });
  })(req, res, next);
});

app.get("/me", (req, res) => {
  res.send(
    renderMe({
      baseUrl: BASE_URL,
      user: req.user || null,
      lastSaml: req.session ? req.session.lastSaml : null,
      nowIso: new Date().toISOString(),
    })
  );
});

app.get("/logout", (req, res) => {
  // passport@0.7 supports async logout
  req.logout(function () {
    if (req.session) {
      req.session.destroy(() => res.redirect("/"));
    } else {
      res.redirect("/");
    }
  });
});

// Fallback error handler
app.use((err, req, res, _next) => {
  console.error(err);
  res.status(500).send(
    renderError({
      baseUrl: BASE_URL,
      title: "Server error",
      message: "Unhandled exception.",
      details: String(err.stack || err),
    })
  );
});

app.listen(PORT, () => {
  console.log(`\n✅ SAML Playground running`);
  console.log(`   Local:   http://localhost:${PORT}`);
  console.log(`   Public:  ${BASE_URL}`);
  console.log(`\nConnections loaded: ${connections.size}`);
  console.log(`\nTip: most IdPs require HTTPS. Use ngrok/cloudflared or deploy to Cloud Run.\n`);
});
