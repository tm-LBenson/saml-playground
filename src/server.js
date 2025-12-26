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
} = require("./config");

const { safeRelayStateTo } = require("./saml");
const {
  renderHome,
  renderMe,
  renderError,
  renderImport,
  renderConnection,
} = require("./views/pages");

const PORT = getPort();
const BASE_URL = getBaseUrl();
const TRUST_PROXY = getTrustProxy();
const ALLOWED_RELAYSTATE_ORIGINS = getAllowedRelayStateOrigins();

const runtimeConnections = new Map();
const RUNTIME_CONNECTION_TTL_MS = getRuntimeConnectionTtlMs();

function getConnectionIdFromReq(req) {
  if (req.params && req.params.connection) return String(req.params.connection);
  if (req.query && req.query.connection) return String(req.query.connection);
  return null;
}

function getConnectionById(id) {
  if (!id) return null;
  return runtimeConnections.get(id) || null;
}

function mustGetConnection(req) {
  const id = getConnectionIdFromReq(req);
  return getConnectionById(id);
}

function listAllConnections() {
  const arr = [...runtimeConnections.values()];
  arr.sort((a, b) =>
    String(a.displayName || a.id).localeCompare(String(b.displayName || b.id)),
  );
  return arr;
}

function createRuntimeConnection(conn) {
  const now = Date.now();
  const expiresAtMs = now + RUNTIME_CONNECTION_TTL_MS;
  const stored = {
    ...conn,
    runtime: true,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(expiresAtMs).toISOString(),
    expiresAtMs,
  };
  runtimeConnections.set(stored.id, stored);
  return stored;
}

function cleanupRuntimeConnections() {
  const now = Date.now();
  for (const [id, conn] of runtimeConnections.entries()) {
    if (conn.expiresAtMs && conn.expiresAtMs <= now)
      runtimeConnections.delete(id);
  }
}

function buildSpEntityId(connectionId) {
  return `${BASE_URL}/saml/metadata/${encodeURIComponent(connectionId)}`;
}

function buildAcsUrl(connectionId) {
  return `${BASE_URL}/saml/acs/${encodeURIComponent(connectionId)}`;
}

function buildUnsolicitedSsoUrl(conn, connectionId, targetUrl) {
  const idpBase = String(conn.idpEntityId || "").replace(/\/+$/, "");
  const providerId = buildSpEntityId(connectionId);
  let url = `${idpBase}/profile/SAML2/Unsolicited/SSO?providerId=${encodeURIComponent(
    providerId,
  )}`;
  if (targetUrl) url += `&target=${encodeURIComponent(targetUrl)}`;
  return url;
}

function randomConnectionId() {
  return "c-" + crypto.randomBytes(4).toString("hex");
}

function toPemFromX509CertificateText(text) {
  const b64 = String(text || "").replace(/\s+/g, "");
  if (!b64) return null;
  const lines = b64.match(/.{1,64}/g) || [];
  return `-----BEGIN CERTIFICATE-----\n${lines.join(
    "\n",
  )}\n-----END CERTIFICATE-----\n`;
}

function pickSsoUrlFromMetadata(xml) {
  const all = [];
  const re =
    /SingleSignOnService[^>]*Binding="([^"]+)"[^>]*Location="([^"]+)"/gi;
  let m;
  while ((m = re.exec(xml)) !== null)
    all.push({ binding: m[1], location: m[2] });
  const preferred = all.find(
    (x) => x.binding === "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect",
  );
  if (preferred) return preferred.location;
  const post = all.find(
    (x) => x.binding === "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST",
  );
  if (post) return post.location;
  return all.length ? all[0].location : null;
}

function pickSigningCertFromMetadata(xml) {
  const keyBlock = xml.match(
    /<KeyDescriptor[^>]*use="signing"[^>]*>[\s\S]*?<\/KeyDescriptor>/i,
  );
  const scope = keyBlock ? keyBlock[0] : xml;
  const certMatch = scope.match(
    /<(?:ds:)?X509Certificate>([\s\S]*?)<\/(?:ds:)?X509Certificate>/i,
  );
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
  if (!idpEntityId)
    throw new Error("Could not find EntityDescriptor entityID in metadata.");
  if (!idpSsoUrl)
    throw new Error("Could not find SingleSignOnService Location in metadata.");
  if (!idpCertPem)
    throw new Error("Could not find a signing X509Certificate in metadata.");
  return { idpEntityId, idpSsoUrl, idpCertPem };
}

async function fetchMetadataUrl(url) {
  const u = String(url || "").trim();
  if (!u) throw new Error("Metadata URL is empty.");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const resp = await fetch(u, {
      signal: controller.signal,
      redirect: "follow",
    });
    if (!resp.ok)
      throw new Error(`Failed to fetch metadata. HTTP ${resp.status}`);
    return await resp.text();
  } finally {
    clearTimeout(timer);
  }
}

function ensureConnectionExists(req, res, next) {
  const conn = mustGetConnection(req);
  if (!conn) {
    return res.status(404).send(
      renderError({
        baseUrl: BASE_URL,
        title: "Unknown connection",
        message: `No connection found for: ${
          getConnectionIdFromReq(req) || "(missing)"
        }`,
        details: "Use Import to create a connection.",
      }),
    );
  }
  req.samlConnection = conn;
  next();
}

const app = express();
app.set("trust proxy", TRUST_PROXY);

app.use(morgan("dev"));
app.use(compression());
app.use(
  helmet({
    contentSecurityPolicy: false,
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

cleanupRuntimeConnections();
setInterval(cleanupRuntimeConnections, 60 * 1000).unref();

passport.use(
  "saml",
  new MultiSamlStrategy(
    {
      passReqToCallback: true,
      getSamlOptions: function (req, done) {
        const conn = mustGetConnection(req);
        if (!conn)
          return done(
            new Error(
              `Unknown connection: ${
                getConnectionIdFromReq(req) || "(missing)"
              }`,
            ),
          );

        const connectionId = conn.id;
        const issuer = buildSpEntityId(connectionId);
        const callbackUrl = buildAcsUrl(connectionId);

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
        };

        if (
          conn.requestedNameIdFormat &&
          String(conn.requestedNameIdFormat).trim() !== ""
        ) {
          opts.identifierFormat = String(conn.requestedNameIdFormat).trim();
        }

        return done(null, opts);
      },
    },
    function verifySignOn(_req, profile, done) {
      const connectionId =
        _req && _req.samlConnection ? _req.samlConnection.id : "unknown";
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
    },
    function verifyLogout(_req, profile, done) {
      return done(null, profile);
    },
  ),
);

app.get("/healthz", (_req, res) => res.status(200).send("ok"));

app.get("/", (req, res) => {
  res.send(
    renderHome({
      baseUrl: BASE_URL,
      connections: listAllConnections(),
      user: req.user || null,
    }),
  );
});

app.get("/import", (req, res) => {
  res.send(
    renderImport({
      baseUrl: BASE_URL,
      error: null,
      values: {
        metadataSource: "url",
        metadataUrl: "",
        metadataXml: "",
        displayName: "",
        allowIdpInitiated: true,
        metadataNameIdFormat:
          "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress",
        requestedNameIdFormat: "",
      },
    }),
  );
});

app.post("/import", async (req, res) => {
  try {
    const displayName = String(req.body.displayName || "").trim();
    const metadataSource = String(req.body.metadataSource || "url").trim();
    const metadataUrl = String(req.body.metadataUrl || "").trim();
    const metadataXml = String(req.body.metadataXml || "").trim();
    const allowIdpInitiated =
      String(req.body.allowIdpInitiated || "").toLowerCase() !== "";
    const metadataNameIdFormat = String(
      req.body.metadataNameIdFormat || "",
    ).trim();
    const requestedNameIdFormat = String(
      req.body.requestedNameIdFormat || "",
    ).trim();

    const xml =
      metadataSource === "xml"
        ? metadataXml
        : await fetchMetadataUrl(metadataUrl);
    const parsed = parseIdpMetadataXml(xml);

    const id = randomConnectionId();
    const conn = createRuntimeConnection({
      id,
      displayName: displayName || parsed.idpEntityId,
      idpEntityId: parsed.idpEntityId,
      idpSsoUrl: parsed.idpSsoUrl,
      idpCertPem: parsed.idpCertPem,
      allowIdpInitiated,
      metadataNameIdFormat:
        metadataNameIdFormat ||
        "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress",
      requestedNameIdFormat,
    });

    res.redirect(`/c/${encodeURIComponent(conn.id)}`);
  } catch (e) {
    res.status(400).send(
      renderImport({
        baseUrl: BASE_URL,
        error: String(e.message || e),
        values: {
          metadataSource: String(req.body.metadataSource || "url"),
          metadataUrl: String(req.body.metadataUrl || ""),
          metadataXml: String(req.body.metadataXml || ""),
          displayName: String(req.body.displayName || ""),
          allowIdpInitiated: !!req.body.allowIdpInitiated,
          metadataNameIdFormat: String(req.body.metadataNameIdFormat || ""),
          requestedNameIdFormat: String(req.body.requestedNameIdFormat || ""),
        },
      }),
    );
  }
});

app.get("/c/:connection", ensureConnectionExists, (req, res) => {
  res.send(renderConnection({ baseUrl: BASE_URL, conn: req.samlConnection }));
});

app.post("/c/:connection/delete", ensureConnectionExists, (req, res) => {
  const conn = req.samlConnection;
  if (conn && conn.runtime) runtimeConnections.delete(conn.id);
  res.redirect("/");
});

app.get("/saml/metadata/:connection", ensureConnectionExists, (req, res) => {
  const conn = req.samlConnection;
  const connectionId = conn.id;

  const issuer = buildSpEntityId(connectionId);
  const acsUrl = buildAcsUrl(connectionId);

  const nameIdLine =
    conn.metadataNameIdFormat && String(conn.metadataNameIdFormat).trim() !== ""
      ? `    <NameIDFormat>${String(
          conn.metadataNameIdFormat,
        ).trim()}</NameIDFormat>\n`
      : "";

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<EntityDescriptor xmlns="urn:oasis:names:tc:SAML:2.0:metadata" entityID="${issuer}">
  <SPSSODescriptor protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol"
      AuthnRequestsSigned="false" WantAssertionsSigned="true">
${nameIdLine}    <AssertionConsumerService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
      Location="${acsUrl}" index="1" isDefault="true"/>
  </SPSSODescriptor>
</EntityDescriptor>
`;
  res.type("application/xml").send(xml);
});

app.get("/login/:connection", ensureConnectionExists, (req, res, next) => {
  passport.authenticate("saml")(req, res, next);
});

app.get("/launch/:connection", ensureConnectionExists, (req, res) => {
  const conn = req.samlConnection;
  if (!conn.allowIdpInitiated)
    return res.redirect(`/c/${encodeURIComponent(conn.id)}`);
  const url = buildUnsolicitedSsoUrl(conn, conn.id, `${BASE_URL}/me`);
  res.redirect(url);
});

app.post("/saml/acs/:connection", ensureConnectionExists, (req, res, next) => {
  passport.authenticate("saml", (err, user) => {
    if (err) {
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
          details: "",
        }),
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
          }),
        );
      }

      const relayState = req.body && req.body.RelayState;
      const safeTo =
        safeRelayStateTo(relayState, ALLOWED_RELAYSTATE_ORIGINS) || "/me";
      return res.redirect(safeTo);
    });
  })(req, res, next);
});

app.get("/me", (req, res) => {
  res.send(
    renderMe({
      baseUrl: BASE_URL,
      user: req.user || null,
      nowIso: new Date().toISOString(),
    }),
  );
});

app.get("/logout", (req, res) => {
  req.logout(function () {
    if (req.session) req.session.destroy(() => res.redirect("/"));
    else res.redirect("/");
  });
});

app.use((err, _req, res, _next) => {
  res.status(500).send(
    renderError({
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
