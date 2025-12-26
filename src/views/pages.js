const { renderLayout, escapeHtml } = require("./layout");

function renderKeyValue(label, value, { mono = true } = {}) {
  const v = value == null || value === "" ? "<span class=\"muted\">(empty)</span>" : escapeHtml(String(value));
  return `<div class="kv">
    <div class="kv-label">${escapeHtml(label)}</div>
    <div class="kv-value ${mono ? "mono" : ""}">${v}</div>
  </div>`;
}

function renderHome({ user, connections }) {
  const list = connections.length
    ? `<div class="table">
        <div class="table-head">
          <div>Name</div>
          <div class="right">Actions</div>
        </div>
        ${connections
          .map((c) => {
            const name = c.displayName || c.id;
            return `<div class="table-row">
              <div>
                <div class="strong">${escapeHtml(name)}</div>
                <div class="muted mono">${escapeHtml(c.id)}</div>
              </div>
              <div class="right">
                <a class="btn" href="/c/${encodeURIComponent(c.id)}">Open</a>
                <a class="btn btn-secondary" href="/login/${encodeURIComponent(c.id)}">SP login</a>
              </div>
            </div>`;
          })
          .join("")}
      </div>`
    : `<div class="empty">
        <div class="muted">No connections yet.</div>
        <a class="btn" href="/import">Import IdP metadata</a>
      </div>`;

  const content = `
    <h1>Home</h1>
    <div class="card">
      <div class="card-title">Connections</div>
      ${list}
    </div>
  `;

  return renderLayout({ title: "Home", content });
}

function renderImport({ error, values }) {
  const content = `
    <h1>Import</h1>

    ${error ? `<div class="alert alert-error"><div class="strong">Import failed</div><div class="mono">${escapeHtml(error)}</div></div>` : ""}

    <form class="card form" method="post" action="/import">
      <div class="form-row">
        <label for="displayName">Connection name <span class="muted">(optional)</span></label>
        <input id="displayName" name="displayName" type="text" value="${escapeHtml(values.displayName || "")}" autocomplete="off" />
        <div class="hint">A friendly label for your connection list.</div>
      </div>

      <div class="form-row">
        <div class="label">IdP metadata source</div>
        <div class="radio-row">
          <label class="radio">
            <input type="radio" name="metadataMode" value="url" ${values.metadataMode !== "xml" ? "checked" : ""} />
            <span>URL</span>
          </label>
          <label class="radio">
            <input type="radio" name="metadataMode" value="xml" ${values.metadataMode === "xml" ? "checked" : ""} />
            <span>XML</span>
          </label>
        </div>
        <div class="hint">Use a live metadata URL when possible (easier to keep certs fresh).</div>
      </div>

      <div class="form-row" data-mode="url">
        <label for="metadataUrl">Metadata URL</label>
        <input id="metadataUrl" name="metadataUrl" type="url" value="${escapeHtml(values.metadataUrl || "")}" placeholder="https://idp.example.com/metadata" />
      </div>

      <div class="form-row" data-mode="xml">
        <label for="metadataXml">Metadata XML</label>
        <textarea id="metadataXml" name="metadataXml" rows="9" placeholder="Paste IdP metadata XML here...">${escapeHtml(values.metadataXml || "")}</textarea>
      </div>

      <details class="details">
        <summary>Advanced</summary>

        <div class="form-row">
          <label for="metadataNameIdFormat">SP metadata NameIDFormat</label>
          <input id="metadataNameIdFormat" name="metadataNameIdFormat" type="text" value="${escapeHtml(values.metadataNameIdFormat || "")}" placeholder="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress" />
          <div class="hint">This is what the SP <em>advertises</em> in its metadata.</div>
        </div>

        <div class="form-row">
          <label for="requestedNameIdFormat">SP-initiated requested NameIDFormat <span class="muted">(optional)</span></label>
          <input id="requestedNameIdFormat" name="requestedNameIdFormat" type="text" value="${escapeHtml(values.requestedNameIdFormat || "")}" placeholder="(leave blank to not force a NameIDPolicy)" />
          <div class="hint">If set, the AuthnRequest will include a NameIDPolicy. If the IdP rejects it, the playground auto-retries once without forcing.</div>
        </div>
      </details>

      <div class="form-actions">
        <button class="btn" type="submit">Create connection</button>
        <a class="btn btn-secondary" href="/">Cancel</a>
      </div>
    </form>
  `;

  return renderLayout({ title: "Import", content });
}

function renderConnection({ baseUrl, conn, sp }) {
  const content = `
    <div class="header-row">
      <div>
        <h1>Connection</h1>
        <div class="muted">${escapeHtml(conn.displayName || conn.id)}</div>
      </div>
      <form method="post" action="/c/${encodeURIComponent(conn.id)}/delete" onsubmit="return confirm('Delete this connection?')">
        <button class="btn btn-danger" type="submit">Delete</button>
      </form>
    </div>

    <div class="grid">
      <div class="card">
        <div class="card-title">SP values</div>
        ${renderKeyValue("Entity ID (Issuer / Audience)", sp.entityId)}
        ${renderKeyValue("ACS URL", sp.acsUrl)}
        ${renderKeyValue("Metadata URL", sp.metadataUrl)}
        ${renderKeyValue("SP-initiated login URL", sp.loginUrl)}
        <div class="hint">Use the metadata URL when configuring the IdP, and use the login URL for SP-initiated tests.</div>
      </div>

      <div class="card">
        <div class="card-title">IdP values (from metadata)</div>
        ${renderKeyValue("IdP Entity ID", conn.idpEntityId)}
        ${renderKeyValue("IdP SSO URL", conn.idpSsoUrl)}
        <details class="details">
          <summary>IdP signing certificate (PEM)</summary>
          <pre class="mono">${escapeHtml(conn.idpCertPem || "")}</pre>
        </details>
      </div>
    </div>
  `;

  return renderLayout({ title: "Connection", content });
}

function renderMe({ user }) {
  const content = `
    <h1>Me</h1>

    ${user ? "" : `<div class="alert"><div class="strong">Not logged in</div><div class="muted">Start from a connection and use SP login, or complete an IdP-initiated flow to the ACS.</div></div>`}

    <div class="card">
      <div class="card-title">Session</div>
      ${user ? renderKeyValue("Connection", user.connectionId, { mono: true }) : ""}
      ${user ? renderKeyValue("NameID", user.nameID, { mono: true }) : ""}
      ${user ? renderKeyValue("NameIDFormat", user.nameIDFormat, { mono: true }) : ""}
      ${user ? renderKeyValue("Logged in at", user.loggedInAt, { mono: true }) : ""}
    </div>

    ${user ? `<div class="card">
      <div class="card-title">Profile</div>
      <pre class="mono">${escapeHtml(JSON.stringify(user.profile || {}, null, 2))}</pre>
    </div>` : ""}

  `;

  return renderLayout({ title: "Me", content });
}

function renderError({ title, message, details, actionsHtml }) {
  const content = `
    <h1>${escapeHtml(title || "Error")}</h1>

    <div class="alert alert-error">
      <div class="strong">${escapeHtml(message || "Something went wrong.")}</div>
      ${details ? `<details class="details"><summary>Details</summary><pre class="mono">${escapeHtml(details)}</pre></details>` : ""}
      <div class="actions">
        ${actionsHtml || `<a class="btn" href="/">Home</a> <a class="btn btn-secondary" href="/import">Import</a>`}
      </div>
    </div>
  `;

  return renderLayout({ title: title || "Error", content });
}

module.exports = {
  renderHome,
  renderImport,
  renderConnection,
  renderMe,
  renderError,
};
