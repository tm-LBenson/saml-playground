const { escapeHtml } = require("./saml");

function layout({ title, content, baseUrl }) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${escapeHtml(title)}</title>
  <link rel="stylesheet" href="/public/styles.css"/>
</head>
<body>
  <header>
    <h1>SAML Playground <span class="badge">${escapeHtml(baseUrl)}</span></h1>
    <p class="sub">A reusable Service Provider you control — built for learning + troubleshooting (SP-initiated + IdP-initiated)</p>
  </header>
  <main>
    ${content}
  </main>
  <footer>
    <small>Tip: Use a browser extension like <code>SAML-tracer</code> to inspect requests/responses. This playground also shows the decoded XML.</small>
  </footer>
</body>
</html>`;
}

function renderHome({ baseUrl, connections, user }) {
  const cards = Array.from(connections.values())
    .map((c) => {
      const issuer = `${baseUrl}/saml/metadata/${encodeURIComponent(c.id)}`;
      const acs = `${baseUrl}/saml/acs/${encodeURIComponent(c.id)}`;
      const md = `${baseUrl}/saml/metadata/${encodeURIComponent(c.id)}`;
      const idp = c.idpEntityId ? escapeHtml(c.idpEntityId) : "<em>(not set)</em>";
      return `
<div class="card">
  <h2>${escapeHtml(c.displayName)} <span class="badge">${escapeHtml(c.id)}</span></h2>
  <div class="kv">
    <div class="key">SP Entity ID (Issuer)</div><div class="val"><code>${escapeHtml(issuer)}</code></div>
    <div class="key">ACS URL</div><div class="val"><code>${escapeHtml(acs)}</code></div>
    <div class="key">SP Metadata</div><div class="val"><a href="${escapeHtml(md)}">${escapeHtml(md)}</a></div>
    <div class="key">IdP Entity ID</div><div class="val">${idp}</div>
    <div class="key">IdP SSO URL</div><div class="val"><code>${escapeHtml(c.idpSsoUrl)}</code></div>
    <div class="key">IdP-initiated allowed</div><div class="val">${c.allowIdpInitiated ? "<span style='color:var(--ok)'>Yes</span>" : "<span style='color:var(--danger)'>No</span>"}</div>
  </div>

  <div class="btnrow">
    <a class="btn ok" href="/login/${encodeURIComponent(c.id)}">SP-initiated login</a>
    <a class="btn" href="/saml/metadata/${encodeURIComponent(c.id)}">View SP metadata</a>
    <a class="btn" href="/me">/me</a>
  </div>

  <p class="notice">
    For <strong>IdP-initiated</strong> SSO, configure your IdP app to POST an assertion to:
    <code>${escapeHtml(acs)}</code>
  </p>
</div>`;
    })
    .join("\n");

  const userPanel = user
    ? `
<div class="card">
  <h2>Current session</h2>
  <p>You're signed in as <code>${escapeHtml(user.nameID || user.email || user.id || "unknown")}</code> via <code>${escapeHtml(user.connectionId)}</code>.</p>
  <div class="btnrow">
    <a class="btn" href="/me">View session details</a>
    <a class="btn danger" href="/logout">Logout</a>
  </div>
</div>`
    : `
<div class="card">
  <h2>Current session</h2>
  <p>Not signed in.</p>
</div>`;

  const instructions = `
<div class="card">
  <h2>Quick setup checklist</h2>
  <p>
    1) Copy <code>connections.example.json</code> to <code>connections.json</code> and fill in your RapidIdentity IdP SSO URL + signing cert.<br/>
    2) Set <code>BASE_URL</code> to your public HTTPS URL (ngrok / Cloud Run / etc).<br/>
    3) Configure your RapidIdentity app with the SP Entity ID + ACS URL shown in a card above.
  </p>
  <p class="notice">
    This is a playground. If you enable IdP-initiated SSO, you're accepting unsolicited assertions (fine for learning, not ideal for production).
  </p>
</div>`;

  return layout({
    title: "SAML Playground",
    baseUrl,
    content: `
<div class="grid">
  ${userPanel}
  ${instructions}
</div>

<h2 style="margin-top:16px;">Connections</h2>
<div class="grid">
  ${cards || `<div class="card"><p>No connections found. Add some to <code>connections.json</code>.</p></div>`}
</div>
`,
  });
}

function renderMe({ baseUrl, user, lastSaml, nowIso }) {
  if (!user) {
    return layout({
      title: "/me",
      baseUrl,
      content: `
<div class="card">
  <h2>Not signed in</h2>
  <p>Go back to <a href="/">home</a> and start an SP-initiated login, or use IdP-initiated from your IdP portal.</p>
</div>
`,
    });
  }

  const samlReqXml = lastSaml?.requestXml ? escapeHtml(lastSaml.requestXml) : "";
  const samlResXml = lastSaml?.responseXml ? escapeHtml(lastSaml.responseXml) : "";
  const samlReqB64 = lastSaml?.requestB64 ? escapeHtml(lastSaml.requestB64) : "";
  const samlResB64 = lastSaml?.responseB64 ? escapeHtml(lastSaml.responseB64) : "";
  const relayState = lastSaml?.relayState ? escapeHtml(lastSaml.relayState) : "";

  return layout({
    title: "/me",
    baseUrl,
    content: `
<div class="grid">
  <div class="card">
    <h2>Session</h2>
    <div class="kv">
      <div class="key">Time (server)</div><div class="val"><code>${escapeHtml(nowIso)}</code></div>
      <div class="key">Connection</div><div class="val"><code>${escapeHtml(user.connectionId)}</code></div>
      <div class="key">NameID</div><div class="val"><code>${escapeHtml(user.nameID || "")}</code></div>
      <div class="key">NameIDFormat</div><div class="val"><code>${escapeHtml(user.nameIDFormat || "")}</code></div>
      <div class="key">SessionIndex</div><div class="val"><code>${escapeHtml(user.sessionIndex || "")}</code></div>
    </div>
    <div class="btnrow">
      <a class="btn" href="/">Home</a>
      <a class="btn danger" href="/logout">Logout</a>
    </div>
  </div>

  <div class="card">
    <h2>Parsed profile (what Passport sees)</h2>
    <p class="notice">This is the friendly attribute view that’s easiest to compare with your RapidIdentity mappings.</p>
    <pre>${escapeHtml(JSON.stringify(user.profile, null, 2))}</pre>
  </div>
</div>

<div class="grid" style="margin-top:14px;">
  <div class="card">
    <h2>Last SAMLRequest (SP-initiated)</h2>
    <p>If you started login from this app, the redirect URL contained a <code>SAMLRequest</code> param. We decode it here.</p>
    ${relayState ? `<p><small class="mono">RelayState (from IdP POST): <code>${relayState}</code></small></p>` : ""}
    ${samlReqXml ? `<pre>${samlReqXml}</pre>` : `<p class="notice">No request captured yet (likely IdP-initiated flow).</p>`}
    ${samlReqB64 ? `<details><summary><small class="mono">Show raw SAMLRequest (base64)</small></summary><pre>${samlReqB64}</pre></details>` : ""}
  </div>

  <div class="card">
    <h2>Last SAMLResponse (IdP → ACS)</h2>
    <p>The IdP posts <code>SAMLResponse</code> to the ACS endpoint. We show the decoded XML below.</p>
    ${samlResXml ? `<pre>${samlResXml}</pre>` : `<p class="notice danger">No SAMLResponse captured in this session.</p>`}
    ${samlResB64 ? `<details><summary><small class="mono">Show raw SAMLResponse (base64)</small></summary><pre>${samlResB64}</pre></details>` : ""}
  </div>
</div>
`,
  });
}

function renderError({ baseUrl, title, message, details }) {
  return layout({
    title: title || "Error",
    baseUrl,
    content: `
<div class="card">
  <h2>${escapeHtml(title || "Error")}</h2>
  <p class="notice danger">${escapeHtml(message || "Something went wrong.")}</p>
  ${details ? `<pre>${escapeHtml(details)}</pre>` : ""}
  <div class="btnrow">
    <a class="btn" href="/">Home</a>
    <a class="btn" href="/me">/me</a>
  </div>
</div>
`,
  });
}

module.exports = {
  renderHome,
  renderMe,
  renderError,
};
