const path = require("path");
const crypto = require("crypto");
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
  loadConnections,
} = require("./config");

const {
  decodeSamlRequest,
  decodeSamlResponse,
  formatXml,
  safeRelayStateTo,
} = require("./saml");

const { renderHome, renderMe, renderError, renderImport, renderConnection } = require("./html");

const PORT = getPort();
const BASE_URL = getBaseUrl();
const TRUST_PROXY = getTrustProxy();
const ALLOWED_RELAYSTATE_ORIGINS = getAllowedRelayStateOrigins();
let fileConnections = new Map();
let fileConnectionsError = null;
try {
  fileConnections = loadConnections();
} catch (e) {
  fileConnectionsError = String(e.message || e);
  fileConnections = new Map();
}

const runtimeConnections = new Map();
const RUNTIME_CONNECTION_TTL_MS = getRuntimeConnectionTtlMs();
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

function getConnectionById(id) {
  if (!id) return null;
  return runtimeConnections.get(id) || fileConnections.get(id) || null;
}

function mustGetConnection(req) {
  const id = getConnectionIdFromReq(req);
  return getConnectionById(id);
}

function listAllConnections() {
  const arr = [...fileConnections.values(), ...runtimeConnections.values()];
  arr.sort((a, b) => String(a.displayName || a.id).localeCompare(String(b.displayName || b.id)));
  return arr;
}

function createRuntimeConnection(conn) {
  const now = Date.now();
  const expiresAtMs = now + RUNTIME_CONNECTION_TTL_MS;
  const stored = { ...conn, runtime: true, createdAt: new Date(now).toISOString(), expiresAt: new Date(expiresAtMs).toISOString(), expiresAtMs };
  runtimeConnections.set(stored.id, stored);
  return stored;
}

function cleanupRuntimeConnections() {
  const now = Date.now();
  for (const [id, conn] of runtimeConnections.entries()) {
    if (conn.expiresAtMs && conn.expiresAtMs <= now) {
      runtimeConnections.delete(id);
    }
  }
}

function buildSpIssuer(connectionId) {
  // Using the metadata URL as issuer keeps it unique per connection and easy to copy/paste.
  return `${BASE_URL}/saml/metadata/${encodeURIComponent(connectionId)}`;
}

function buildAcsUrl(connectionId) {
  return `${BASE_URL}/saml/acs/${encodeURIComponent(connectionId)}`;
}

function randomConnectionId() {
  return "c-" + crypto.randomBytes(4).toString("hex");
}

function toPemFromX509CertificateText(text) {
  const b64 = String(text || "").replace(/\s+/g, "");
  if (!b64) return null;
  const lines = b64.match(/.{1,64}/g) || [];
  return `-----BEGIN CERTIFICATE-----\n${lines.join("\n")}\n-----END CERTIFICATE-----\n`;
}

function pickSsoUrlFromMetadata(xml) {
  const all = [];
  const re = /SingleSignOnService[^>]*Binding="([^"]+)"[^>]*Location="([^"]+)"/gi;
  let m;
  while ((m = re.exec(xml)) !== null) {
    all.push({ binding: m[1], location: m[2] });
  }
  const preferred = all.find((x) => x.binding === "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect");
  if (preferred) return preferred.location;
  const post = all.find((x) => x.binding === "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST");
  if (post) return post.location;
  return all.length ? all[0].location : null;
}

function pickSigningCertFromMetadata(xml) {
  const keyBlock = xml.match(/<KeyDescriptor[^>]*use="signing"[^>]*>[\s\S]*?<\/KeyDescriptor>/i);
  const scope = keyBlock ? keyBlock[0] : xml;
  const certMatch = scope.match(/<(?:ds:)?X509Certificate>([\s\S]*?)<\/(?:ds:)?X509Certificate>/i);
  if (!certMatch) return null;
  return toPemFromX509CertificateText(certMatch[1]);
}

function parseIdpMetadataXml(xml) {
  const text = String(xml || "").trim();
  if (!text) throw new Error("Metadata XML is empty.");
  const entityMatch = text.match(/<EntityDescriptor[^>]*\sentityID="([^"]+)"/i);
  const idpEntityId = entityMatch ? entityMatch[1] : null;
  const idpSsoUrl = pickSsoUrlFromMetadata(text);
  const idpCertPem = pickSigningCertFromMetadata(text);
  if (!idpEntityId) throw new Error("Could not find EntityDescriptor entityID in metadata.");
  if (!idpSsoUrl) throw new Error("Could not find SingleSignOnService Location in metadata.");
  if (!idpCertPem) throw new Error("Could not find a signing X509Certificate in metadata.");
  return { idpEntityId, idpSsoUrl, idpCertPem };
}

async function fetchMetadataUrl(url) {
  const u = String(url || "").trim();
  if (!u) throw new Error("Metadata URL is empty.");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const resp = await fetch(u, { signal: controller.signal, redirect: "follow" });
    if (!resp.ok) throw new Error(`Failed to fetch metadata. HTTP ${resp.status}`);
    return await resp.text();
  } finally {
    clearTimeout(timer);
  }
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
            "Check the URL, or add a connection at /import.",
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

cleanupRuntimeConnections();
setInterval(cleanupRuntimeConnections, 60 * 1000).unref();

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
        const validateInResponseTo = "never";

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

app.get("/import", (req, res) => {
  res.send(
    renderImport({
      baseUrl: BASE_URL,
      error: null,
      values: { metadataUrl: "", metadataXml: "", displayName: "", allowIdpInitiated: "on", nameIdFormat: "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress" },
    })
  );
});

app.post("/import", async (req, res) => {
  try {
    const displayName = String(req.body.displayName || "").trim();
    const metadataUrl = String(req.body.metadataUrl || "").trim();
    const metadataXml = String(req.body.metadataXml || "").trim();
    const allowIdpInitiated = String(req.body.allowIdpInitiated || "").toLowerCase() !== "";
    const nameIdFormat = String(req.body.nameIdFormat || "").trim() || "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress";

    const xml = metadataUrl ? await fetchMetadataUrl(metadataUrl) : metadataXml;
    const parsed = parseIdpMetadataXml(xml);
    const id = randomConnectionId();
    const conn = createRuntimeConnection({
      id,
      displayName: displayName || parsed.idpEntityId,
      idpEntityId: parsed.idpEntityId,
      idpSsoUrl: parsed.idpSsoUrl,
      idpCertPem: parsed.idpCertPem,
      nameIdFormat,
      allowIdpInitiated,
    });

    res.redirect(`/c/${encodeURIComponent(conn.id)}`);
  } catch (e) {
    res.status(400).send(
      renderImport({
        baseUrl: BASE_URL,
        error: String(e.message || e),
        values: {
          metadataUrl: String(req.body.metadataUrl || ""),
          metadataXml: String(req.body.metadataXml || ""),
          displayName: String(req.body.displayName || ""),
          allowIdpInitiated: req.body.allowIdpInitiated ? "on" : "",
          nameIdFormat: String(req.body.nameIdFormat || "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress"),
        },
      })
    );
  }
});

app.get("/c/:connection", ensureConnectionExists, (req, res) => {
  const conn = req.samlConnection;
  res.send(renderConnection({ baseUrl: BASE_URL, conn }));
});

app.post("/c/:connection/delete", ensureConnectionExists, (req, res) => {
  const conn = req.samlConnection;
  if (conn.runtime) {
    runtimeConnections.delete(conn.id);
  }
  res.redirect("/");
});


app.get("/", (req, res) => {
  res.send(
    renderHome({
      baseUrl: BASE_URL,
      connections: listAllConnections(),
      fileConnectionsError: fileConnectionsError,
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

app.all("/logout", (req, res) => {
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
  console.log(`\nFile connections: ${fileConnections.size}`);
  console.log(`Runtime connections: ${runtimeConnections.size}`);
  console.log(`\nTip: most IdPs require HTTPS. Use ngrok/cloudflared or deploy to Cloud Run.\n`);
});
