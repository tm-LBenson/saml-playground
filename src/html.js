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
    <p class="sub">A reusable Service Provider you control - built for learning and troubleshooting (SP initiated and IdP initiated)</p>
  </header>
  <main>
    ${content}
  </main>
  <footer>
    <small>Tip: Use a browser extension like <code>SAML-tracer</code> to inspect requests and responses. This playground also shows decoded XML on /me.</small>
  </footer>
</body>
</html>`;
}

function renderHome({ baseUrl, connections, user }) {
  const banner = "";

  const cards = (connections || [])
    .map((c) => {
      const issuer = `${baseUrl}/saml/metadata/${encodeURIComponent(c.id)}`;
      const acs = `${baseUrl}/saml/acs/${encodeURIComponent(c.id)}`;
      const login = `${baseUrl}/login/${encodeURIComponent(c.id)}`;
      const details = `${baseUrl}/c/${encodeURIComponent(c.id)}`;
      const runtimeInfo = c.runtime
        ? `<p><span class="pill">Runtime</span> Expires: <code>${escapeHtml(c.expiresAt || "")}</code></p>`
        : `<p><span class="pill">File</span></p>`;

      return `<div class="card">
  <h2>${escapeHtml(c.displayName || c.id)}</h2>
  <p>Connection: <code>${escapeHtml(c.id)}</code> (<a href="${details}">details</a>)</p>
  ${runtimeInfo}
  <p>SP Entity ID (Issuer, Audience):</p>
  <pre><code>${escapeHtml(issuer)}</code></pre>
  <p>ACS URL:</p>
  <pre><code>${escapeHtml(acs)}</code></pre>
  <p>SP initiated login:</p>
  <pre><code>${escapeHtml(login)}</code></pre>
</div>`;
    })
    .join("");

  const empty = connections && connections.length
    ? ""
    : `<div class="card">
  <h2>No connections yet</h2>
  <p>Import your IdP metadata to create a connection.</p>
  <p><a class="btn" href="/import">Import IdP metadata</a></p>
</div>`;

  const session = user
    ? `<div class="card ok">
  <h2>Signed in</h2>
  <p>Connection: <code>${escapeHtml(user.connectionId || "")}</code></p>
  <p>NameID: <code>${escapeHtml(user.nameID || "")}</code></p>
  <p><a class="btn" href="/me">View session and decoded XML</a></p>
  <form method="post" action="/logout">
    <button class="btn danger" type="submit">Logout</button>
  </form>
</div>`
    : `<div class="card">
  <h2>Not signed in</h2>
  <p><a class="btn" href="/me">View session details</a></p>
</div>`;

  return layout({
    title: "Home",
    baseUrl,
    content: `
${banner}
<div class="card">
  <h2>Import</h2>
  <p><a class="btn" href="/import">Import IdP metadata</a></p>
  <p>Each import creates a unique connection id so multiple people can test at the same time.</p>
</div>
${session}
${empty}
${cards}
`,
  });
}

function renderImport({ baseUrl, error, values }) {
  const v = values || {};
  const checked = v.allowIdpInitiated ? "checked" : "";
  const err = error
    ? `<div class="card bad">
  <h2>Import failed</h2>
  <pre><code>${escapeHtml(error)}</code></pre>
</div>`
    : "";

  return layout({
    title: "Import",
    baseUrl,
    content: `
${err}
<div class="card">
  <h2>Import IdP metadata</h2>
  <form method="post" action="/import">
    <label>Display name</label>
    <input name="displayName" value="${escapeHtml(v.displayName || "")}" placeholder="Optional" />

    <label>Metadata URL</label>
    <input name="metadataUrl" value="${escapeHtml(v.metadataUrl || "")}" placeholder="https://.../idp/profile/Metadata/SAML" />

    <label>Or paste metadata XML</label>
    <textarea name="metadataXml" rows="10" placeholder="Paste IdP metadata XML here">${escapeHtml(v.metadataXml || "")}</textarea>

    <label>NameID format</label>
    <input name="nameIdFormat" value="${escapeHtml(v.nameIdFormat || "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress")}" />

    <div class="row">
      <label class="check">
        <input type="checkbox" name="allowIdpInitiated" value="on" ${checked} />
        Allow IdP initiated
      </label>
    </div>

    <button class="btn" type="submit">Create connection</button>
    <a class="btn ghost" href="/">Cancel</a>
  </form>
</div>
`,
  });
}

function renderConnection({ baseUrl, conn }) {
  const issuer = `${baseUrl}/saml/metadata/${encodeURIComponent(conn.id)}`;
  const acs = `${baseUrl}/saml/acs/${encodeURIComponent(conn.id)}`;
  const login = `${baseUrl}/login/${encodeURIComponent(conn.id)}`;
  const deleteButton = conn.runtime
    ? `<form method="post" action="/c/${encodeURIComponent(conn.id)}/delete">
  <button class="btn danger" type="submit">Delete runtime connection</button>
</form>`
    : "";

  return layout({
    title: `Connection ${conn.id}`,
    baseUrl,
    content: `
<div class="card">
  <h2>${escapeHtml(conn.displayName || conn.id)}</h2>
  <p>Connection id: <code>${escapeHtml(conn.id)}</code></p>
  ${conn.runtime ? `<p><span class="pill">Runtime</span> Expires: <code>${escapeHtml(conn.expiresAt || "")}</code></p>` : `<p><span class="pill">File</span></p>`}
</div>

<div class="card">
  <h2>SP values for RI Federation Partner</h2>
  <p>SP Entity ID (Issuer, Audience):</p>
  <pre><code>${escapeHtml(issuer)}</code></pre>
  <p>ACS URL:</p>
  <pre><code>${escapeHtml(acs)}</code></pre>
  <p>SP metadata URL:</p>
  <pre><code>${escapeHtml(issuer)}</code></pre>
  <p>SP initiated login test:</p>
  <pre><code>${escapeHtml(login)}</code></pre>
</div>

<div class="card">
  <h2>IdP values parsed from metadata</h2>
  <p>IdP Entity ID:</p>
  <pre><code>${escapeHtml(conn.idpEntityId || "")}</code></pre>
  <p>IdP SSO URL:</p>
  <pre><code>${escapeHtml(conn.idpSsoUrl || "")}</code></pre>
</div>

${deleteButton}
<div class="card">
  <a class="btn" href="/">Home</a>
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
  <p>Go back to <a href="/">home</a> and start an SP initiated login, or use IdP initiated from your IdP portal.</p>
</div>
`,
    });
  }

  const samlReqXml = lastSaml && lastSaml.requestXml ? escapeHtml(lastSaml.requestXml) : "";
  const samlRespXml = lastSaml && lastSaml.responseXml ? escapeHtml(lastSaml.responseXml) : "";
  const reqMeta = lastSaml && lastSaml.requestAt ? `<p>Request decoded at: <code>${escapeHtml(lastSaml.requestAt)}</code></p>` : "";
  const respMeta = lastSaml && lastSaml.responseAt ? `<p>Response decoded at: <code>${escapeHtml(lastSaml.responseAt)}</code></p>` : "";

  const profile = escapeHtml(JSON.stringify(user.profile || {}, null, 2));

  return layout({
    title: "/me",
    baseUrl,
    content: `
<div class="card ok">
  <h2>Session</h2>
  <p>Now: <code>${escapeHtml(nowIso)}</code></p>
  <p>Connection: <code>${escapeHtml(user.connectionId || "")}</code></p>
  <p>NameID: <code>${escapeHtml(user.nameID || "")}</code></p>
  <p>NameIDFormat: <code>${escapeHtml(user.nameIDFormat || "")}</code></p>
  <p>SessionIndex: <code>${escapeHtml(user.sessionIndex || "")}</code></p>
  <p>Logged in at: <code>${escapeHtml(user.loggedInAt || "")}</code></p>
</div>

<div class="card">
  <h2>Profile</h2>
  <pre><code>${profile}</code></pre>
</div>

<div class="card">
  <h2>Decoded SAMLRequest</h2>
  ${reqMeta}
  <pre><code>${samlReqXml}</code></pre>
</div>

<div class="card">
  <h2>Decoded SAMLResponse</h2>
  ${respMeta}
  <pre><code>${samlRespXml}</code></pre>
</div>

<div class="card">
  <a class="btn" href="/">Home</a>
  <form method="post" action="/logout">
    <button class="btn danger" type="submit">Logout</button>
  </form>
</div>
`,
  });
}

function renderError({ title, baseUrl, message, details }) {
  return layout({
    title,
    baseUrl,
    content: `
<div class="card bad">
  <h2>${escapeHtml(title)}</h2>
  <p>${escapeHtml(message)}</p>
  <pre><code>${escapeHtml(details || "")}</code></pre>
</div>
`,
  });
}

module.exports = {
  renderHome,
  renderImport,
  renderConnection,
  renderMe,
  renderError,
};
